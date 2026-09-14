import { describe, expect, it, vi } from "vitest";
import * as github from "../server/github";
import { handleContributionsRequest } from "../server/handler";
import { createMockCity } from "../server/mockData";
import { mulberry32 } from "../shared/calendar";
import { USERNAME_PATTERN, type CityData } from "../shared/types";

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

  it("handles non-string input safely", async () => {
    // @ts-expect-error testing runtime guard against non-string input
    const result = await handleContributionsRequest(undefined);
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

describe("handleContributionsRequest", () => {
  it("serves mock city data when forceMock is true", async () => {
    const result = await handleContributionsRequest("octocat", { forceMock: true });
    expect(result.status).toBe(200);
    const body = result.body as CityData;
    expect(body.username).toBe("octocat");
    expect(body.source).toBe("mock");
    expect(body.days.length).toBeGreaterThan(0);
  });

  it("returns cached response on second call without fetching again", async () => {
    const dummyCity: CityData = {
      username: "cached-user",
      year: 2025,
      yearLabel: "2025",
      from: "2025-01-01",
      to: "2025-12-31",
      totalContributions: 100,
      source: "github",
      days: [],
    };
    const spy = vi.spyOn(github, "fetchGithubCity").mockResolvedValue(dummyCity);

    const first = await handleContributionsRequest("cached-user");
    expect(first.status).toBe(200);
    expect(first.body).toEqual(dummyCity);
    expect(spy).toHaveBeenCalledTimes(1);

    const second = await handleContributionsRequest("cached-user");
    expect(second.status).toBe(200);
    expect(second.body).toEqual(dummyCity);
    expect(spy).toHaveBeenCalledTimes(1);

    spy.mockRestore();
  });
});

describe("mulberry32", () => {
  it("produces deterministic expected values for a given seed", () => {
    const rng1 = mulberry32(42);
    const rng2 = mulberry32(42);

    const val1a = rng1();
    const val1b = rng1();
    const val2a = rng2();
    const val2b = rng2();

    expect(val1a).toBe(val2a);
    expect(val1b).toBe(val2b);
    expect(val1a).toBeGreaterThanOrEqual(0);
    expect(val1a).toBeLessThan(1);
    expect(val1b).toBeGreaterThanOrEqual(0);
    expect(val1b).toBeLessThan(1);

    // Different seed produces different values
    const rng3 = mulberry32(43);
    expect(rng3()).not.toBe(val1a);
  });
});
