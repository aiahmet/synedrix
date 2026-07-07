/**
 * streak.test.ts.
 *
 * Pure unit tests for `computeStreak` (DST-safe consecutive-day
 * counter).  All non-DST tests use `timeZone: "UTC"` so results
 * are deterministic regardless of the host machine's locale.
 *
 * The DST test uses `Europe/Berlin` with timestamps straddling
 * the 2025-03-30 spring-forward (02:00 CET -> 03:00 CEST) to
 * verify that wall-clock dates, not 24-hour arithmetic, drive
 * the streak.
 */

import { describe, expect, it } from "vitest";

import { computeStreak } from "./streak";

const DAY_MS = 86_400_000;

describe("computeStreak", () => {
  describe("edge cases", () => {
    it("returns 0 when there are no completions", () => {
      expect(computeStreak([], Date.now(), { timeZone: "UTC" })).toBe(0);
    });
  });

  describe("single-day streaks (UTC)", () => {
    it("returns 1 when the only completion is today", () => {
      const now = Date.UTC(2025, 6, 7, 12, 0, 0); // 2025-07-07T12:00:00Z
      expect(computeStreak([now], now, { timeZone: "UTC" })).toBe(1);
    });

    it("returns 1 when the only completion is yesterday (today missing)", () => {
      const now = Date.UTC(2025, 6, 7, 12, 0, 0); // 2025-07-07
      const yesterday = now - DAY_MS;              // 2025-07-06
      expect(computeStreak([yesterday], now, { timeZone: "UTC" })).toBe(1);
    });
  });

  describe("multi-day streaks (UTC)", () => {
    it("returns 2 for today + yesterday", () => {
      const now = Date.UTC(2025, 6, 7, 12, 0, 0);
      expect(computeStreak([now, now - DAY_MS], now, { timeZone: "UTC" })).toBe(
        2,
      );
    });

    it("returns 1 when there is a gap (today + 2 days ago)", () => {
      const now = Date.UTC(2025, 6, 7, 12, 0, 0);
      const twoDaysAgo = now - 2 * DAY_MS; // 2025-07-05
      // today "2025-07-07" is present but 2025-07-06 is missing
      expect(computeStreak([now, twoDaysAgo], now, { timeZone: "UTC" })).toBe(
        1,
      );
    });

    it("returns 7 for 7 consecutive days", () => {
      const now = Date.UTC(2025, 6, 7, 12, 0, 0); // 2025-07-07
      const days = Array.from({ length: 7 }, (_, i) => now - i * DAY_MS);
      expect(computeStreak(days, now, { timeZone: "UTC" })).toBe(7);
    });
  });

  describe("DST spring-forward (Europe/Berlin)", () => {
    /**
     * In 2025, Europe/Berlin springs forward on March 30 at 02:00 CET
     * (clocks jump to 03:00 CEST).  We create timestamps on both sides
     * of the boundary that should map to the same calendar days:
     *
     *   2025-03-29 12:00 CET  → "2025-03-29"
     *   2025-03-30 01:30 CET  → "2025-03-30"  (before transition)
     *   2025-03-30 03:30 CEST → "2025-03-30"  (after transition)
     *   2025-03-31 12:00 CEST → "2025-03-31"
     *
     * The two March-30 timestamps sit on opposite sides of the 02:00->03:00
     * jump but must produce the SAME date key "2025-03-30", yielding 3
     * unique calendar days → streak = 3.
     */
    const MARCH_29 = new Date("2025-03-29T11:00:00Z").getTime(); // 12:00 CET
    const MARCH_30_PRE = new Date("2025-03-30T00:30:00Z").getTime(); // 01:30 CET
    const MARCH_30_POST = new Date("2025-03-30T01:30:00Z").getTime(); // 03:30 CEST
    const MARCH_31 = new Date("2025-03-31T10:00:00Z").getTime(); // 12:00 CEST

    const TZ = { timeZone: "Europe/Berlin" } as const;

    it("maps pre- and post-DST timestamps to the same calendar day", () => {
      // Sanity check: both 2025-03-30 timestamps should produce "2025-03-30"
      const formatter = new Intl.DateTimeFormat("en-CA", TZ);
      expect(formatter.format(new Date(MARCH_30_PRE))).toBe("2025-03-30");
      expect(formatter.format(new Date(MARCH_30_POST))).toBe("2025-03-30");
    });

    it("returns unbroken streak across a DST spring-forward night", () => {
      const completions = [MARCH_29, MARCH_30_PRE, MARCH_30_POST, MARCH_31];
      expect(computeStreak(completions, MARCH_31, TZ)).toBe(3);
    });
  });
});
