import { describe, expect, it } from "vitest";
import { handleContributionsRequest } from "../server/handler";
import { createMockCity } from "../server/mockData";
import { USERNAME_PATTERN } from "../shared/types";

describe("username validation", () => {
  it("accepts real GitHub login shapes", () => {
    expect(USERNAME_PATTERN.test("torvalds")).toBe(true);
    expect(USERNAME_PATTERN.test("gaearon")).toBe(true);
    expect(USERNAME_PATTERN.test("a")).toBe(true);
    expect(USERNAME_PATTERN.test("octocat-1")).toBe(true);
  });

  it("rejects empty, underscored, or overlong values", () => {
    expect(USERNAME_PATTERN.test("")).toBe(false);
    expect(USERNAME_PATTERN.test("nope_nope")).toBe(false);
    expect(USERNAME_PATTERN.test("-leading")).toBe(false);
    expect(USERNAME_PATTERN.test("trailing-")).toBe(false);
    expect(USERNAME_PATTERN.test("a".repeat(40))).toBe(false);
  });

  it("returns invalid_username from the API handler", async () => {
    const result = await handleContributionsRequest("nope_nope");
    expect(result.status).toBe(400);
    expect(result.body).toMatchObject({ code: "invalid_username" });
  });
});

describe("createMockCity", () => {
  it("is deterministic for the same username", () => {
    const a = createMockCity("octocat");
    const b = createMockCity("octocat");
    expect(a.days).toEqual(b.days);
    expect(a.totalContributions).toBe(b.totalContributions);
    expect(a.source).toBe("mock");
  });

  it("produces a dated contribution grid", () => {
    const city = createMockCity("torvalds");
    expect(city.days.length).toBeGreaterThan(300);
    expect(city.days.every((d) => d.dayIndex >= 0 && d.dayIndex <= 6)).toBe(true);
    expect(city.days[0].date <= city.days[city.days.length - 1].date).toBe(true);
    expect(city.days.every((d) => d.level >= 0 && d.level <= 4)).toBe(true);
  });
});
