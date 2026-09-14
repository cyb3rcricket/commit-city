import type { ContributionDay, ContributionLevel, CityData } from "./types";

export function clampLevel(value: number): ContributionLevel {
  const n = Math.max(0, Math.min(4, Math.round(value)));
  return n as ContributionLevel;
}

export function parseIsoDate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1));
}

export function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function formatLongDate(iso: string): string {
  return parseIsoDate(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export function weekdayName(dayIndex: number): string {
  return WEEKDAYS[dayIndex] ?? "Day";
}

export function assignGrid(days: Omit<ContributionDay, "weekIndex" | "dayIndex">[]): ContributionDay[] {
  if (days.length === 0) return [];

  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const first = parseIsoDate(sorted[0].date);
  const origin = new Date(first);
  origin.setUTCDate(origin.getUTCDate() - origin.getUTCDay());

  return sorted.map((day) => {
    const date = parseIsoDate(day.date);
    const diffDays = Math.round((date.getTime() - origin.getTime()) / 86_400_000);
    return {
      ...day,
      weekIndex: Math.floor(diffDays / 7),
      dayIndex: date.getUTCDay(),
    };
  });
}

export function yearLabel(from: string, to: string): string {
  const start = parseIsoDate(from);
  const end = parseIsoDate(to);
  const startYear = start.getUTCFullYear();
  const endYear = end.getUTCFullYear();
  if (startYear === endYear) return String(startYear);
  const startFmt = start.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  const endFmt = end.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  return `${startFmt} – ${endFmt}`;
}

export function buildCityData(
  username: string,
  days: ContributionDay[],
  source: CityData["source"],
  totalOverride?: number,
): CityData {
  const from = days[0]?.date ?? formatIsoDate(new Date());
  const to = days[days.length - 1]?.date ?? from;
  const totalContributions =
    totalOverride ?? days.reduce((sum, day) => sum + day.contributionCount, 0);
  const endYear = parseIsoDate(to).getUTCFullYear();

  return {
    username,
    year: endYear,
    yearLabel: yearLabel(from, to),
    from,
    to,
    totalContributions,
    days,
    source,
  };
}

export function robustMaxCount(days: ContributionDay[]): number {
  const positive = days
    .map((day) => day.contributionCount)
    .filter((count) => count > 0)
    .sort((a, b) => a - b);
  if (positive.length === 0) return 1;
  const index = Math.min(positive.length - 1, Math.floor(positive.length * 0.96));
  return Math.max(1, positive[index]);
}

export function heightForCount(count: number, referenceMax: number): number {
  const foundation = 0.08;
  if (count <= 0) return foundation;
  const minH = 0.22;
  const maxH = 5.4;
  const t = Math.min(1.18, Math.sqrt(count) / Math.sqrt(Math.max(referenceMax, 1)));
  const curved = Math.pow(t, 0.9);
  return minH + curved * (maxH - minH);
}

export function footprintForLevel(level: ContributionLevel): number {
  return 0.82 + level * 0.035;
}

export type DerivedStats = {
  username: string;
  yearLabel: string;
  totalContributions: number;
  activeDays: number;
  busiestDay: ContributionDay | null;
  longestStreak: number;
  currentStreak: number;
  source: CityData["source"];
};

export function deriveStats(data: CityData): DerivedStats {
  const chronological = [...data.days].sort((a, b) => a.date.localeCompare(b.date));
  let activeDays = 0;
  let busiestDay: ContributionDay | null = null;
  let longestStreak = 0;
  let run = 0;

  for (const day of chronological) {
    if (day.contributionCount > 0) {
      activeDays += 1;
      run += 1;
      longestStreak = Math.max(longestStreak, run);
      if (!busiestDay || day.contributionCount > busiestDay.contributionCount) {
        busiestDay = day;
      }
    } else {
      run = 0;
    }
  }

  let currentStreak = 0;
  for (let i = chronological.length - 1; i >= 0; i -= 1) {
    if (chronological[i].contributionCount > 0) currentStreak += 1;
    else break;
  }

  return {
    username: data.username,
    yearLabel: data.yearLabel,
    totalContributions: data.totalContributions,
    activeDays,
    busiestDay,
    longestStreak,
    currentStreak,
    source: data.source,
  };
}

export function levelLabel(level: ContributionLevel): string {
  switch (level) {
    case 0:
      return "Dormant";
    case 1:
      return "Quiet";
    case 2:
      return "Active";
    case 3:
      return "Busy";
    default:
      return "Peak";
  }
}

export function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
