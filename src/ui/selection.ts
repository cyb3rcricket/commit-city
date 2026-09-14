import { formatLongDate, levelLabel, weekdayName } from "../../shared/calendar";
import type { ContributionDay } from "../../shared/types";

let cardEl: HTMLDivElement | null = null;

export function renderSelection(day: ContributionDay | null) {
  if (!cardEl) {
    cardEl = document.querySelector<HTMLDivElement>("#selection-card");
  }
  if (!cardEl) return;
  if (!day || !day.date) {
    cardEl.hidden = true;
    cardEl.innerHTML = "";
    return;
  }
  const noun = day.contributionCount === 1 ? "contribution" : "contributions";
  cardEl.hidden = false;
  cardEl.innerHTML = `
    <p class="sel-date">${formatLongDate(day.date)}</p>
    <p class="sel-count">${day.contributionCount.toLocaleString("en-US")} ${noun}</p>
    <p class="sel-meta">${weekdayName(day.dayIndex)} · ${levelLabel(day.level)} · week ${day.weekIndex + 1}</p>
  `;
}
