/**
 * tutorStrategy.test.ts.
 *
 * Pure unit tests for the `shouldInjectNudge` predicate
 * (Phase 4 §6.1) and its exported threshold constants.
 *
 * Why pure unit tests only — the `convex/tutorStrategy.ts`
 * Convex queries/mutations need a live Convex backend to
 * execute, which is out of scope for this unit suite. The
 * pure exports (`shouldInjectNudge`,
 * `INSTANT_CLICK_THRESHOLD_MS`, `PASSIVE_DISMISSAL_THRESHOLD_MS`)
 * have NO Convex dependency and are the load-bearing
 * threshold semantics from the route handler's
 * `activeLearningNudge` branch. Covering them here keeps the
 * passive-dismissal logic honest without standing up the
 * full backend.
 *
 * The threshold matrix this file pins (read off the source
 * directly):
 *
 *   responseTimeMs < INSTANT_CLICK_THRESHOLD_MS  → always nudge
 *   INSTANT_CLICK_THRESHOLD_MS ≤ responseTimeMs < PASSIVE_DISMISSAL_THRESHOLD_MS
 *     · pickedCorrect === false  → nudge
 *     · pickedCorrect === true   → no nudge
 *   responseTimeMs ≥ PASSIVE_DISMISSAL_THRESHOLD_MS  → no nudge
 *
 * If a future change alters these thresholds, the assertions
 * below should fail loudly.
 */

import { describe, expect, it } from "vitest";

import {
  INSTANT_CLICK_THRESHOLD_MS,
  PASSIVE_DISMISSAL_THRESHOLD_MS,
  shouldInjectNudge,
} from "./tutorStrategy";

const MESSAGE_ID = "msg-123-abc";

describe("shouldInjectNudge", () => {
  describe("threshold constants", () => {
    it("exports INSTANT_CLICK_THRESHOLD_MS as 1000ms", () => {
      expect(INSTANT_CLICK_THRESHOLD_MS).toBe(1000);
    });

    it("exports PASSIVE_DISMISSAL_THRESHOLD_MS as 2000ms", () => {
      expect(PASSIVE_DISMISSAL_THRESHOLD_MS).toBe(2000);
    });
  });

  describe("instant click (< 1000ms)", () => {
    it("nudges even when the user picked the correct label", () => {
      const should = shouldInjectNudge({
        responseTimeMs: 500,
        pickedCorrect: true,
        lastNudgeAt: null,
        messageId: MESSAGE_ID,
      });
      expect(should).toBe(true);
    });

    it("nudges when the user picked the wrong label", () => {
      const should = shouldInjectNudge({
        responseTimeMs: 999,
        pickedCorrect: false,
        lastNudgeAt: null,
        messageId: MESSAGE_ID,
      });
      expect(should).toBe(true);
    });
  });

  describe("fast-but-not-instant (1000–2000ms)", () => {
    it("does NOT nudge when the user picked the correct label", () => {
      const should = shouldInjectNudge({
        // Boundary: exactly at 1000ms counts as "fast-not-instant",
        // and a correct answer means the user did engage.
        responseTimeMs: INSTANT_CLICK_THRESHOLD_MS,
        pickedCorrect: true,
        lastNudgeAt: null,
        messageId: MESSAGE_ID,
      });
      expect(should).toBe(false);
    });

    it("nudges when the user picked the wrong label", () => {
      const should = shouldInjectNudge({
        responseTimeMs: 1500,
        pickedCorrect: false,
        lastNudgeAt: null,
        messageId: MESSAGE_ID,
      });
      expect(should).toBe(true);
    });

    it("nudges when the boundary 1999ms meets a wrong answer", () => {
      const should = shouldInjectNudge({
        responseTimeMs: PASSIVE_DISMISSAL_THRESHOLD_MS - 1,
        pickedCorrect: false,
        lastNudgeAt: null,
        messageId: MESSAGE_ID,
      });
      expect(should).toBe(true);
    });
  });

  describe("engaged (≥ 2000ms)", () => {
    it("does NOT nudge regardless of correctness at the boundary", () => {
      const should = shouldInjectNudge({
        // Boundary: exactly at 2000ms counts as "engaged".
        responseTimeMs: PASSIVE_DISMISSAL_THRESHOLD_MS,
        pickedCorrect: false,
        lastNudgeAt: null,
        messageId: MESSAGE_ID,
      });
      expect(should).toBe(false);
    });

    it("does NOT nudge for very slow clicks", () => {
      const should = shouldInjectNudge({
        responseTimeMs: 60_000,
        pickedCorrect: true,
        lastNudgeAt: null,
        messageId: MESSAGE_ID,
      });
      expect(should).toBe(false);
    });
  });

  describe("empty / no messageId", () => {
    it("does NOT nudge when the messageId is an empty string", () => {
      // Defensive: an empty id should never drive a nudge
      // because `messageId` is the disambiguator the route
      // handler uses to avoid re-firing the same nudge across
      // regenerations of the same assistant message.
      const should = shouldInjectNudge({
        responseTimeMs: 500,
        pickedCorrect: false,
        lastNudgeAt: null,
        messageId: "",
      });
      expect(should).toBe(false);
    });
  });

  describe("agreed shape with the route handler mirror logic", () => {
    /**
     * The chat route handler's `activeLearningNudge`
     * computation in `app/api/tutor/chat/route.ts` runs an
     * inline mirror of this predicate. The matrix pinned by
     * this file is the SINGLE source of truth — if the
     * route handler drifts, the discrepancy will either
     * show up as a regression or as a behaviour gap the
     * next maintainer notices.
     */
    const cases: ReadonlyArray<{
      readonly responseTimeMs: number;
      readonly pickedCorrect: boolean;
      readonly expected: boolean;
      readonly note: string;
    }> = [
      {
        responseTimeMs: 0,
        pickedCorrect: true,
        expected: true,
        note: "instant, correct → still nudge (the click happened too fast)",
      },
      {
        responseTimeMs: 999,
        pickedCorrect: false,
        expected: true,
        note: "instant, wrong → nudge",
      },
      {
        responseTimeMs: 1000,
        pickedCorrect: true,
        expected: false,
        note: "1s, correct → no nudge (engaged enough)",
      },
      {
        responseTimeMs: 1000,
        pickedCorrect: false,
        expected: true,
        note: "1s, wrong → nudge",
      },
      {
        responseTimeMs: 1999,
        pickedCorrect: false,
        expected: true,
        note: "just under 2s, wrong → nudge",
      },
      {
        responseTimeMs: 2000,
        pickedCorrect: false,
        expected: false,
        note: "exactly 2s, wrong → no nudge (engaged)",
      },
      {
        responseTimeMs: 5000,
        pickedCorrect: true,
        expected: false,
        note: "5s, correct → no nudge",
      },
    ];

    for (const c of cases) {
      it(`${c.note} (responseTimeMs=${c.responseTimeMs}, pickedCorrect=${c.pickedCorrect} → expect=${c.expected})`, () => {
        const should = shouldInjectNudge({
          responseTimeMs: c.responseTimeMs,
          pickedCorrect: c.pickedCorrect,
          lastNudgeAt: null,
          messageId: MESSAGE_ID,
        });
        expect(should).toBe(c.expected);
      });
    }
  });
});
