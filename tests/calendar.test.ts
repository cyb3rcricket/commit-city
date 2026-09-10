import { describe, expect, it } from "vitest";
import {
  assignGrid,
  deriveStats,
  heightForCount,
  robustMaxCount,
} from "../shared/calendar";
import { cityFromCounts, day } from "./helpers";

describe("heightForCount", () => {
  it("keeps zero-contribution days at foundation height", () => {
    expect(heightForCount(0, 10)).toBe(0.08);
    expect(heightForCount(0, 1)).toBe(0.08);
  });

  it("grows with contribution count against the reference max", () => {
    const low = heightForCount(1, 100);
    const mid = heightForCount(25, 100);
    const high = heightForCount(100, 100);
    expect(low).toBeGreaterThan(0.08);
    expect(mid).toBeGreaterThan(low);
    expect(high).toBeGreaterThan(mid);
  });

  it("soft-caps extreme outliers against the reference max", () => {
    const atMax = heightForCount(50, 50);
    const outlier = heightForCount(5000, 50);
    expect(outlier).toBeGreaterThan(atMax);
    expect(outlier).toBeLessThan(8);
  });
});

describe("robustMaxCount", () => {
  it("returns 1 when there are no positive days", () => {
    expect(robustMaxCount([])).toBe(1);
    expect(robustMaxCount([day("2026-01-01", 0)])).toBe(1);
  });

  it("uses a high percentile so one spike does not dominate", () => {
    const days = [
      ...Array.from({ length: 100 }, () => day("2026-01-01", 4)),
      day("2026-04-10", 400),
    ];
    expect(robustMaxCount(days)).toBe(4);
  });
});

describe("assignGrid", () => {
  it("anchors weeks to the UTC Sunday of the first date", () => {
    const days = assignGrid([
      { date: "2026-01-04", contributionCount: 1, level: 1 },
      { date: "2026-01-05", contributionCount: 2, level: 1 },
      { date: "2026-01-11", contributionCount: 3, level: 2 },
    ]);
    expect(days[0]).toMatchObject({ date: "2026-01-04", weekIndex: 0, dayIndex: 0 });
    expect(days[1]).toMatchObject({ date: "2026-01-05", weekIndex: 0, dayIndex: 1 });
    expect(days[2]).toMatchObject({ date: "2026-01-11", weekIndex: 1, dayIndex: 0 });
  });

  it("uses UTC rather than local timezone for day-of-week", () => {
    const [mapped] = assignGrid([
      { date: "2026-06-15", contributionCount: 1, level: 1 },
    ]);
    expect(mapped.dayIndex).toBe(1);
    expect(mapped.weekIndex).toBe(0);
  });
});

describe("deriveStats current and longest streaks", () => {
  it("reports zeros when there are no contributions", () => {
    const stats = deriveStats(cityFromCounts([0, 0, 0]));
    expect(stats.activeDays).toBe(0);
    expect(stats.longestStreak).toBe(0);
    expect(stats.currentStreak).toBe(0);
    expect(stats.busiestDay).toBeNull();
  });

  it("counts a single active latest day", () => {
    const stats = deriveStats(cityFromCounts([0, 0, 4]));
    expect(stats.currentStreak).toBe(1);
    expect(stats.longestStreak).toBe(1);
    expect(stats.activeDays).toBe(1);
  });

  it("sets currentStreak to 0 when the latest day is inactive", () => {
    const stats = deriveStats(cityFromCounts([3, 3, 3, 0]));
    expect(stats.currentStreak).toBe(0);
    expect(stats.longestStreak).toBe(3);
  });

  it("counts a multi-day current streak from the newest day backwards", () => {
    const stats = deriveStats(cityFromCounts([0, 1, 2, 3, 4]));
    expect(stats.currentStreak).toBe(4);
    expect(stats.longestStreak).toBe(4);
  });

  it("keeps a longer historical streak than the current streak", () => {
    const stats = deriveStats(cityFromCounts([5, 5, 5, 5, 0, 2, 2]));
    expect(stats.longestStreak).toBe(4);
    expect(stats.currentStreak).toBe(2);
  });

  it("treats an all-active year as one streak", () => {
    const stats = deriveStats(cityFromCounts([1, 2, 3, 4, 5]));
    expect(stats.currentStreak).toBe(5);
    expect(stats.longestStreak).toBe(5);
    expect(stats.activeDays).toBe(5);
  });

  it("does not let an early zero freeze the current streak", () => {
    const stats = deriveStats(cityFromCounts([0, 1, 1, 1]));
    expect(stats.currentStreak).toBe(3);
    expect(stats.longestStreak).toBe(3);
  });
});
