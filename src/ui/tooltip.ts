import { formatLongDate, levelLabel, weekdayName } from "../../shared/calendar";
import type { ContributionDay } from "../../shared/types";

export type TooltipUI = {
  show: (day: ContributionDay, x: number, y: number) => void;
  hide: () => void;
};

export function createTooltip(): TooltipUI {
  const el = document.querySelector<HTMLDivElement>("#tooltip")!;

  return {
    show(day, x, y) {
      const count = day.contributionCount;
      const noun = count === 1 ? "contribution" : "contributions";
      el.hidden = false;
      el.innerHTML = `<strong>${formatLongDate(day.date)}</strong><span>${count} ${noun}</span><span>${weekdayName(day.dayIndex)} · ${levelLabel(day.level)}</span>`;
      const maxX = window.innerWidth - el.offsetWidth - 16;
      const maxY = window.innerHeight - el.offsetHeight - 16;
      el.style.left = `${Math.min(x, maxX)}px`;
      el.style.top = `${Math.min(y, maxY)}px`;
    },
    hide() {
      el.hidden = true;
    },
  };
}
