import { describe, expect, it } from "vitest";

import { describeCode } from "@/lib/weather/openMeteo";

describe("describeCode", () => {
  it("translates WMO codes into plain words", () => {
    expect(describeCode(0)).toBe("clear");
    expect(describeCode(3)).toBe("overcast");
    expect(describeCode(65)).toBe("rain");
    expect(describeCode(95)).toBe("thunderstorm");
  });
});
