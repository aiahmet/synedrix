import { describe, expect, it } from "vitest";

import {
  getSubjectSlugForTopic,
  getLessonContentForTopics,
  startArenaPractice,
  retryWrongItems,
  finishArenaPractice,
  getArenaRun,
  getArenaRunItems,
  listTopicsForSubject,
  recordArenaAttempt,
} from "./practiceArena";

describe("getSubjectSlugForTopic", () => {
  it("is an exported callable query (Convex runtime required for behavioral tests)", () => {
    expect(getSubjectSlugForTopic).toBeDefined();
    expect(typeof getSubjectSlugForTopic).toBe("function");
  });
});

describe("practiceArena exports", () => {
  it("exports getLessonContentForTopics", () => {
    expect(getLessonContentForTopics).toBeDefined();
  });

  it("exports startArenaPractice", () => {
    expect(startArenaPractice).toBeDefined();
  });

  it("exports retryWrongItems", () => {
    expect(retryWrongItems).toBeDefined();
  });

  it("exports finishArenaPractice", () => {
    expect(finishArenaPractice).toBeDefined();
  });

  it("exports getArenaRun", () => {
    expect(getArenaRun).toBeDefined();
  });

  it("exports getArenaRunItems", () => {
    expect(getArenaRunItems).toBeDefined();
  });

  it("exports listTopicsForSubject", () => {
    expect(listTopicsForSubject).toBeDefined();
  });

  it("exports recordArenaAttempt", () => {
    expect(recordArenaAttempt).toBeDefined();
  });
});
