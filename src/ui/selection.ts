import { formatLongDate, levelLabel, weekdayName } from "../../shared/calendar";
import type { ContributionDay } from "../../shared/types";

export function renderSelection(day: ContributionDay | null) {
  const el = document.querySelector<HTMLDivElement>("#selection-card")!;
  if (!day || !day.date) {
    el.hidden = true;
    el.innerHTML = "";
    return;
  }
  const noun = day.contributionCount === 1 ? "contribution" : "contributions";
  el.hidden = false;
  el.innerHTML = `
    <p class="sel-date">${formatLongDate(day.date)}</p>
    <p class="sel-count">${day.contributionCount.toLocaleString("en-US")} ${noun}</p>
    <p class="sel-meta">${weekdayName(day.dayIndex)} · ${levelLabel(day.level)} · week ${day.weekIndex + 1}</p>
  `;
}
