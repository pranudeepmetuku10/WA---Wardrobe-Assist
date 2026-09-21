import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import { env } from "@/lib/env";

/**
 * Single Anthropic client for the whole app. Server-only by import — pulling
 * this into a client component is a build error, not a leaked key.
 */
const globalForAnthropic = globalThis as unknown as {
  anthropic: Anthropic | undefined;
};

export const anthropic: Anthropic =
  globalForAnthropic.anthropic ??
  new Anthropic({
    apiKey: env.ANTHROPIC_API_KEY,
    // Timeouts are in milliseconds in the TS SDK.
    timeout: 120_000,
    // We run our own retry loop in call.ts so every attempt gets logged.
    maxRetries: 0,
  });

if (process.env.NODE_ENV !== "production") {
  globalForAnthropic.anthropic = anthropic;
}
