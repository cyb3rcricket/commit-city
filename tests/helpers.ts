import type { CityData, ContributionDay } from "../shared/types";

export function day(
  date: string,
  contributionCount: number,
  extras: Partial<ContributionDay> = {},
): ContributionDay {
  return {
    date,
    contributionCount,
    level: contributionCount === 0 ? 0 : contributionCount < 8 ? 1 : 2,
    weekIndex: 0,
    dayIndex: 0,
    ...extras,
  };
}

export function cityFromCounts(
  counts: number[],
  start = "2026-01-01",
): CityData {
  const startDate = new Date(`${start}T00:00:00Z`);
  const days = counts.map((contributionCount, index) => {
    const date = new Date(startDate);
    date.setUTCDate(startDate.getUTCDate() + index);
    return day(date.toISOString().slice(0, 10), contributionCount);
  });
  return {
    username: "tester",
    year: 2026,
    yearLabel: "2026",
    from: days[0]?.date ?? start,
    to: days[days.length - 1]?.date ?? start,
    totalContributions: counts.reduce((sum, count) => sum + count, 0),
    days,
    source: "github",
  };
}
