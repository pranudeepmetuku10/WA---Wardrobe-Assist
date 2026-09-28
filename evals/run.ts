import "dotenv/config";

import {
  UNIVERSAL_CHECKS,
  type Check,
  type CheckContext,
  type TestGarment,
  type TestOutfit,
} from "./checks";
import { FIXTURE_WARDROBE } from "./fixtures/wardrobe";
import { SCENARIOS, type Scenario } from "./scenarios";
import { FIXTURE_USER_ID, clearFixtureOutfits, prisma, seedFixtures } from "./seed";

/**
 * The eval harness.
 *
 * Runs every scenario against the live pipeline over HTTP — the same path the
 * app uses — then applies the deterministic checks and an LLM judge. Change a
 * prompt, run this, and see immediately whether it got better or worse.
 *
 *   npm run eval                 # everything
 *   npm run eval -- --no-judge   # rules only, no model grading
 *   npm run eval -- --only=hot-humid-date-night
 */

const BASE_URL = process.env.EVAL_BASE_URL ?? "http://localhost:3000";
const JUDGE_PASS_MARK = 3;

interface ScenarioResult {
  scenario: Scenario;
  ok: boolean;
  skipped?: string;
  outfitCount: number;
  relaxed: string[];
  failures: Array<{ checkId: string; outfit: string; detail: string }>;
  checksRun: number;
  judgeScore: number | null;
  judgeVerdict: string;
  latencyMs: number;
  costUsd: number;
  gap: string | null;
}

async function main() {
  const args = process.argv.slice(2);
  const noJudge = args.includes("--no-judge");
  const only = args.find((a) => a.startsWith("--only="))?.split("=")[1];

  const scenarios = only ? SCENARIOS.filter((s) => s.id === only) : SCENARIOS;
  if (!scenarios.length) {
    console.error(`no scenario matched "${only}"`);
    process.exitCode = 1;
    return;
  }

  await assertServerUp();
  const seeded = await seedFixtures();
  await clearFixtureOutfits();
  console.log(
    `\n${seeded} fixture garments · ${scenarios.length} scenarios · judge ${noJudge ? "off" : "on"}\n`,
  );

  const knownIds = new Set(FIXTURE_WARDROBE.map((g) => g.id));
  const results: ScenarioResult[] = [];

  for (const [index, scenario] of scenarios.entries()) {
    process.stdout.write(
      `[${String(index + 1).padStart(2)}/${scenarios.length}] ${scenario.id.padEnd(26)} `,
    );
    const result = await runScenario(scenario, knownIds, noJudge);
    results.push(result);
    console.log(summariseLine(result));
  }

  report(results, noJudge);
  await prisma.$disconnect();
}

async function runScenario(
  scenario: Scenario,
  knownIds: Set<string>,
  noJudge: boolean,
): Promise<ScenarioResult> {
  await applySetup(scenario);

  const started = Date.now();
  let body: RecommendBody;
  try {
    const response = await fetch(`${BASE_URL}/api/recommend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: FIXTURE_USER_ID,
        occasion: scenario.occasion,
        weather: {
          temperatureC: scenario.weather.temperatureC,
          humidity: scenario.weather.humidity,
          precipitationChance: scenario.weather.precipitationChance ?? 0,
          windKph: scenario.weather.windKph,
        },
        timeOfDay: scenario.timeOfDay,
        indoorOutdoor: scenario.indoorOutdoor,
        userRequest: scenario.userRequest,
        persist: false,
      }),
    });
    body = (await response.json()) as RecommendBody;
  } catch (error) {
    await undoSetup(scenario);
    return {
      scenario,
      ok: false,
      skipped: error instanceof Error ? error.message : String(error),
      outfitCount: 0,
      relaxed: [],
      failures: [],
      checksRun: 0,
      judgeScore: null,
      judgeVerdict: "",
      latencyMs: Date.now() - started,
      costUsd: 0,
      gap: null,
    };
  }

  const outfits = body.outfits ?? [];
  const gap = body.gap?.item ?? null;

  // A scenario can expect the honest "this cannot be dressed" answer.
  if (scenario.expectNoOutfit) {
    await undoSetup(scenario);
    const correct = !body.ok || outfits.length === 0;
    return {
      scenario,
      ok: correct,
      outfitCount: outfits.length,
      relaxed: body.relaxed ?? [],
      failures: correct
        ? []
        : [
            {
              checkId: "expect_no_outfit",
              outfit: outfits[0]?.title ?? "",
              detail: `expected no outfit, got ${outfits.length}`,
            },
          ],
      checksRun: 1,
      judgeScore: null,
      judgeVerdict: correct ? "correctly refused" : "",
      latencyMs: body.diagnostics?.latencyMs ?? Date.now() - started,
      costUsd: body.diagnostics?.costUsd ?? 0,
      gap,
    };
  }

  const garmentById = new Map<string, TestGarment>(
    FIXTURE_WARDROBE.map((g) => [
      g.id,
      {
        id: g.id,
        subcategory: g.subcategory,
        category: g.category,
        formality: g.formality,
        warmth: g.warmth,
        materials: g.materials,
        status: "AVAILABLE",
      },
    ]),
  );
  // Reflect this scenario's laundry state in what the checks see.
  for (const id of scenario.setup?.inLaundry ?? []) {
    const garment = garmentById.get(id);
    if (garment) garmentById.set(id, { ...garment, status: "IN_LAUNDRY" });
  }

  const ctx: CheckContext = {
    occasion: scenario.occasion,
    formalityWindow: windowFor(body),
    temperatureC: scenario.weather.temperatureC,
    precipitationChance: scenario.weather.precipitationChance ?? 0,
    relaxed: body.relaxed ?? [],
    knownIds,
  };

  const checks: Check[] = [...UNIVERSAL_CHECKS, ...(scenario.checks ?? [])];
  const failures: ScenarioResult["failures"] = [];
  let checksRun = 0;

  if (!outfits.length) {
    failures.push({
      checkId: "produced_outfits",
      outfit: "-",
      detail: body.error ?? "no outfits returned",
    });
    checksRun = 1;
  }

  for (const outfit of outfits) {
    const testOutfit: TestOutfit = {
      title: outfit.title,
      reasoning: outfit.reasoning,
      garments: outfit.garments
        .map((g) => garmentById.get(g.id))
        .filter((g): g is TestGarment => Boolean(g)),
    };

    // Any id the fixture doesn't know is a hallucination, checked separately.
    const unknown = outfit.garments.filter((g) => !knownIds.has(g.id));
    if (unknown.length) {
      failures.push({
        checkId: "real_ids",
        outfit: outfit.title,
        detail: `unknown ids: ${unknown.map((g) => g.id).join(", ")}`,
      });
    }

    for (const check of checks) {
      checksRun += 1;
      const failure = check.run(testOutfit, ctx);
      if (failure) {
        failures.push({ checkId: check.id, outfit: outfit.title, detail: failure });
      }
    }
  }

  let judgeScore: number | null = null;
  let judgeVerdict = "";
  let judgeCost = 0;
  if (!noJudge && outfits.length) {
    const judged = await judge(scenario, outfits[0]);
    judgeScore = judged.score;
    judgeVerdict = judged.verdict;
    judgeCost = judged.costUsd;
  }

  await undoSetup(scenario);

  const rulesPassed = failures.length === 0;
  const judgePassed = judgeScore === null || judgeScore >= JUDGE_PASS_MARK;

  return {
    scenario,
    ok: rulesPassed && judgePassed && outfits.length > 0,
    outfitCount: outfits.length,
    relaxed: body.relaxed ?? [],
    failures,
    checksRun,
    judgeScore,
    judgeVerdict,
    latencyMs: body.diagnostics?.latencyMs ?? 0,
    costUsd: (body.diagnostics?.costUsd ?? 0) + judgeCost,
    gap,
  };
}

async function judge(
  scenario: Scenario,
  outfit: RecommendOutfit,
): Promise<{ score: number | null; verdict: string; costUsd: number }> {
  try {
    const response = await fetch(`${BASE_URL}/api/evals/judge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rubric: scenario.rubric,
        occasion: scenario.occasion,
        conditions: `${scenario.weather.temperatureC}C, humidity ${scenario.weather.humidity}%, rain ${scenario.weather.precipitationChance ?? 0}%`,
        outfit: outfit.garments.map((g) => g.subcategory).join(" + "),
        reasoning: outfit.reasoning,
      }),
    });
    const body = await response.json();
    return {
      score: body.ok ? body.score : null,
      verdict: body.verdict ?? body.error ?? "",
      costUsd: body.costUsd ?? 0,
    };
  } catch (error) {
    return {
      score: null,
      verdict: error instanceof Error ? error.message : String(error),
      costUsd: 0,
    };
  }
}

// ------------------------------------------------------------ scenario io --

async function applySetup(scenario: Scenario) {
  if (scenario.setup?.inLaundry?.length) {
    await prisma.garment.updateMany({
      where: { id: { in: scenario.setup.inLaundry }, userId: FIXTURE_USER_ID },
      data: { status: "IN_LAUNDRY" },
    });
  }
  for (const worn of scenario.setup?.wornDaysAgo ?? []) {
    await prisma.garment.update({
      where: { id: worn.id },
      data: { lastWornAt: new Date(Date.now() - worn.days * 86_400_000) },
    });
  }
}

/** Always restore, so one scenario cannot contaminate the next. */
async function undoSetup(scenario: Scenario) {
  if (scenario.setup?.inLaundry?.length) {
    await prisma.garment.updateMany({
      where: { id: { in: scenario.setup.inLaundry }, userId: FIXTURE_USER_ID },
      data: { status: "AVAILABLE" },
    });
  }
  for (const worn of scenario.setup?.wornDaysAgo ?? []) {
    await prisma.garment.update({
      where: { id: worn.id },
      data: { lastWornAt: null },
    });
  }
}

async function assertServerUp() {
  try {
    const response = await fetch(`${BASE_URL}/api/weather?city=`, {
      signal: AbortSignal.timeout(5_000),
    });
    // Any answer means the server is listening; 400 is expected for an empty city.
    if (response.status >= 500) throw new Error(`server returned ${response.status}`);
  } catch {
    console.error(
      `\nCannot reach ${BASE_URL}. Start the app first:\n  npm run dev\n`,
    );
    process.exit(1);
  }
}

function windowFor(body: RecommendBody): [number, number] {
  const known: Record<string, [number, number]> = {
    work: [3, 4],
    casual: [1, 3],
    date_night: [3, 5],
    family_outing: [2, 3],
    festive: [4, 5],
    travel: [1, 3],
    gym: [1, 2],
    interview: [4, 5],
    custom: [2, 4],
  };
  return known[body.occasion?.id ?? "custom"] ?? [2, 4];
}

// ---------------------------------------------------------------- report ---

function summariseLine(result: ScenarioResult): string {
  if (result.skipped) return `SKIP  ${result.skipped}`;
  const mark = result.ok ? "PASS" : "FAIL";
  const bits = [
    `${result.outfitCount} outfit${result.outfitCount === 1 ? "" : "s"}`,
    `${(result.latencyMs / 1000).toFixed(1)}s`,
  ];
  if (result.judgeScore !== null) bits.push(`judge ${result.judgeScore}/5`);
  if (result.relaxed.length) bits.push(`relaxed:${result.relaxed.join("+")}`);
  if (result.failures.length) bits.push(`${result.failures.length} rule fail`);
  return `${mark}  ${bits.join("  ")}`;
}

function report(results: ScenarioResult[], noJudge: boolean) {
  const passed = results.filter((r) => r.ok).length;
  const totalChecks = results.reduce((sum, r) => sum + r.checksRun, 0);
  const totalFailures = results.reduce((sum, r) => sum + r.failures.length, 0);
  const latencies = results.map((r) => r.latencyMs).filter((ms) => ms > 0).sort((a, b) => a - b);
  const totalCost = results.reduce((sum, r) => sum + r.costUsd, 0);

  const byCheck = new Map<string, number>();
  for (const result of results) {
    for (const failure of result.failures) {
      byCheck.set(failure.checkId, (byCheck.get(failure.checkId) ?? 0) + 1);
    }
  }

  console.log("\n" + "─".repeat(66));
  console.log(
    `PASS RATE  ${passed}/${results.length}  (${Math.round((passed / results.length) * 100)}%)`,
  );
  console.log(
    `RULES      ${totalChecks - totalFailures}/${totalChecks} checks passed`,
  );

  if (!noJudge) {
    const scored = results.filter((r) => r.judgeScore !== null);
    if (scored.length) {
      const mean =
        scored.reduce((sum, r) => sum + (r.judgeScore ?? 0), 0) / scored.length;
      console.log(
        `JUDGE      mean ${mean.toFixed(2)}/5 across ${scored.length} scenarios`,
      );
    }
  }

  if (latencies.length) {
    const median = latencies[Math.floor(latencies.length / 2)];
    const p90 = latencies[Math.floor(latencies.length * 0.9)];
    console.log(
      `LATENCY    median ${(median / 1000).toFixed(1)}s · p90 ${(p90 / 1000).toFixed(1)}s · total ${(latencies.reduce((a, b) => a + b, 0) / 1000).toFixed(0)}s`,
    );
  }
  console.log(
    `COST       $${totalCost.toFixed(4)} total · $${(totalCost / Math.max(1, results.length)).toFixed(4)} per scenario`,
  );

  if (byCheck.size) {
    console.log("\nFAILURES BY RULE");
    for (const [checkId, count] of [...byCheck].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${String(count).padStart(3)}  ${checkId}`);
    }
  }

  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    console.log("\nDETAIL");
    for (const result of failed) {
      console.log(`\n  ${result.scenario.id}`);
      if (result.skipped) console.log(`    skipped: ${result.skipped}`);
      for (const failure of result.failures.slice(0, 4)) {
        console.log(`    ✗ ${failure.checkId}: ${failure.detail}`);
      }
      if (result.judgeScore !== null && result.judgeScore < JUDGE_PASS_MARK) {
        console.log(`    ✗ judge ${result.judgeScore}/5: ${result.judgeVerdict}`);
      }
    }
  }
  console.log("\n" + "─".repeat(66) + "\n");

  if (passed < results.length) process.exitCode = 1;
}

// ------------------------------------------------------------------ types --

interface RecommendOutfit {
  title: string;
  reasoning: string;
  garments: Array<{ id: string; subcategory: string; category: string }>;
}

interface RecommendBody {
  ok: boolean;
  occasion?: { id: string; label: string };
  outfits?: RecommendOutfit[];
  gap?: { item: string; why: string } | null;
  relaxed?: string[];
  error?: string;
  diagnostics?: { latencyMs: number; costUsd: number };
}

void main();
