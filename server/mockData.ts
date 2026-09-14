import {
  assignGrid,
  buildCityData,
  clampLevel,
  mulberry32,
} from "../shared/calendar.js";
import type { CityData } from "../shared/types.js";

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createMockCity(username: string): CityData {
  const rand = mulberry32(hashString(username.toLowerCase()) ^ 0x0c17c17);
  const days: { date: string; contributionCount: number; level: 0 | 1 | 2 | 3 | 4 }[] = [];
  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);
  const origin = new Date(end);
  origin.setUTCDate(origin.getUTCDate() - origin.getUTCDay());
  origin.setUTCDate(origin.getUTCDate() - 52 * 7);

  let streakLeft = 0;

  for (let i = 0; i < 53 * 7; i += 1) {
    const date = new Date(origin);
    date.setUTCDate(origin.getUTCDate() + i);
    if (date > end) break;

    const weekday = date.getUTCDay();
    const week = Math.floor(i / 7);
    const iso = date.toISOString().slice(0, 10);

    const vacation = week >= 28 && week <= 31;
    const crunch = week >= 40 && week <= 44;
    const weekend = weekday === 0 || weekday === 6;

    if (streakLeft <= 0 && rand() > 0.82) {
      streakLeft = 4 + Math.floor(rand() * 12);
    }

    let count = 0;
    if (vacation) {
      count = rand() > 0.92 ? 1 : 0;
    } else {
      const base = weekend ? 0.22 : 0.72;
      const active = streakLeft > 0 || rand() < base;
      if (active) {
        const intensity = crunch ? 18 : weekend ? 4 : 9;
        count = 1 + Math.floor(rand() * intensity);
        if (rand() > 0.97) count += 20 + Math.floor(rand() * 40);
      }
    }

    streakLeft -= 1;

    const level = clampLevel(
      count === 0 ? 0 : count < 3 ? 1 : count < 8 ? 2 : count < 16 ? 3 : 4,
    );

    days.push({ date: iso, contributionCount: count, level });
  }

  return buildCityData(username, assignGrid(days), "mock");
}
