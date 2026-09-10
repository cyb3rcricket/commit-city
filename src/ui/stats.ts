import { formatLongDate } from "../../shared/calendar";
import type { DerivedStats } from "../../shared/calendar";

export type StatsUI = {
  show: (stats: DerivedStats) => void;
  hide: () => void;
};

export function createStatsUI(): StatsUI {
  const panel = document.querySelector<HTMLElement>("#stats-panel")!;
  const toggle = document.querySelector<HTMLButtonElement>("#stats-toggle")!;
  const user = document.querySelector<HTMLElement>("#stat-user")!;
  const year = document.querySelector<HTMLElement>("#stat-year")!;
  const total = document.querySelector<HTMLElement>("#stat-total")!;
  const active = document.querySelector<HTMLElement>("#stat-active")!;
  const busy = document.querySelector<HTMLElement>("#stat-busy")!;
  const streak = document.querySelector<HTMLElement>("#stat-streak")!;
  const note = document.querySelector<HTMLElement>("#stat-note")!;

  toggle.addEventListener("click", () => {
    const open = !panel.classList.contains("is-open");
    panel.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
  });

  return {
    show(stats) {
      panel.hidden = false;
      user.textContent = stats.username;
      year.textContent = stats.yearLabel;
      total.textContent = stats.totalContributions.toLocaleString("en-US");
      active.textContent = stats.activeDays.toLocaleString("en-US");
      if (stats.busiestDay) {
        const short = new Date(`${stats.busiestDay.date}T00:00:00Z`).toLocaleDateString(
          "en-US",
          { month: "short", day: "numeric", timeZone: "UTC" },
        );
        busy.textContent = `${stats.busiestDay.contributionCount.toLocaleString("en-US")} · ${short}`;
        busy.title = formatLongDate(stats.busiestDay.date);
      } else {
        busy.textContent = "—";
        busy.removeAttribute("title");
      }
      const current =
        stats.currentStreak > 0 ? ` · now ${stats.currentStreak}` : "";
      streak.textContent = `${stats.longestStreak}${current}`;
      note.hidden = stats.source !== "mock";
    },
    hide() {
      panel.hidden = true;
    },
  };
}
