import { describe, expect, it } from "vitest";
import {
  ContributionParseError,
  parseContributionHtml,
  parseCount,
} from "../server/github";

function calendarHtml(cells: string, tips: string) {
  return `<div class="js-yearly-contributions"><table>${cells}</table>${tips}</div>`;
}

function cell(date: string, id: string, level: number) {
  return `<td tabindex="0" data-date="${date}" id="${id}" data-level="${level}" role="gridcell" class="ContributionCalendar-day">`;
}

function tip(id: string, text: string) {
  return `<tool-tip for="${id}" popover="manual" class="sr-only">${text}</tool-tip>`;
}

describe("parseCount", () => {
  it("reads zero and nonzero tooltip labels", () => {
    expect(parseCount("No contributions on September 7th.")).toBe(0);
    expect(parseCount("1 contribution on January 1st.")).toBe(1);
    expect(parseCount("21 contributions on September 9th.")).toBe(21);
  });

  it("does not invent a count from unreadable text", () => {
    expect(parseCount("")).toBeNull();
    expect(parseCount("contributed a bunch")).toBeNull();
  });
});

describe("parseContributionHtml", () => {
  it("parses a zero-contribution day exactly", () => {
    const html = calendarHtml(
      cell("2025-09-07", "contribution-day-component-0-0", 0),
      tip("contribution-day-component-0-0", "No contributions on September 7th."),
    );
    expect(parseContributionHtml(html)).toEqual([
      { date: "2025-09-07", contributionCount: 0, level: 0 },
    ]);
  });

  it("parses an exact nonzero contribution count", () => {
    const html = calendarHtml(
      cell("2025-09-08", "contribution-day-component-1-0", 2),
      tip("contribution-day-component-1-0", "8 contributions on September 8th."),
    );
    expect(parseContributionHtml(html)).toEqual([
      { date: "2025-09-08", contributionCount: 8, level: 2 },
    ]);
  });

  it("keeps exact counts across multiple levels", () => {
    const html = calendarHtml(
      [
        cell("2025-09-07", "contribution-day-component-0-0", 0),
        cell("2025-09-08", "contribution-day-component-1-0", 1),
        cell("2025-09-09", "contribution-day-component-2-0", 3),
        cell("2025-09-10", "contribution-day-component-3-0", 4),
      ].join(""),
      [
        tip("contribution-day-component-0-0", "No contributions on September 7th."),
        tip("contribution-day-component-1-0", "2 contributions on September 8th."),
        tip("contribution-day-component-2-0", "11 contributions on September 9th."),
        tip("contribution-day-component-3-0", "21 contributions on September 10th."),
      ].join(""),
    );
    expect(parseContributionHtml(html).map((d) => d.contributionCount)).toEqual([
      0, 2, 11, 21,
    ]);
    expect(parseContributionHtml(html).map((d) => d.level)).toEqual([0, 1, 3, 4]);
  });

  it("accepts a dormant cell without a tooltip as an exact zero", () => {
    const html = calendarHtml(
      cell("2025-09-07", "contribution-day-component-0-0", 0),
      "",
    );
    expect(parseContributionHtml(html)).toEqual([
      { date: "2025-09-07", contributionCount: 0, level: 0 },
    ]);
  });

  it("fails when a nonzero day is missing its tooltip count", () => {
    const html = calendarHtml(
      cell("2025-09-08", "contribution-day-component-1-0", 2),
      "",
    );
    expect(() => parseContributionHtml(html)).toThrow(ContributionParseError);
  });

  it("fails when a tooltip is present but unreadable", () => {
    const html = calendarHtml(
      cell("2025-09-08", "contribution-day-component-1-0", 2),
      tip("contribution-day-component-1-0", "busy day"),
    );
    expect(() => parseContributionHtml(html)).toThrow(ContributionParseError);
  });

  it("keeps the first occurrence of a duplicate date", () => {
    const html = calendarHtml(
      [
        cell("2025-09-08", "contribution-day-component-1-0", 1),
        cell("2025-09-08", "contribution-day-component-1-1", 4),
      ].join(""),
      [
        tip("contribution-day-component-1-0", "3 contributions on September 8th."),
        tip("contribution-day-component-1-1", "99 contributions on September 8th."),
      ].join(""),
    );
    expect(parseContributionHtml(html)).toEqual([
      { date: "2025-09-08", contributionCount: 3, level: 1 },
    ]);
  });

  it("returns no days for unrecognized markup instead of inventing counts", () => {
    expect(parseContributionHtml("<div>changed github page</div>")).toEqual([]);
  });

  it("reads exact counts from current GitHub calendar markup", () => {
    const html = `
      <td tabindex="0" data-ix="0" aria-selected="false" aria-describedby="contribution-graph-legend-level-1" style="width: 10px" data-date="2025-09-07" id="contribution-day-component-0-0" data-level="1" role="gridcell" data-view-component="true" class="ContributionCalendar-day"></td>
      <tool-tip style="pointer-events: none;" id="tooltip-10d77dca-2cdf-4381-8eac-cfd9cdb2c259" for="contribution-day-component-0-0" popover="manual" data-direction="n" data-type="label" data-view-component="true" class="sr-only position-absolute">8 contributions on September 7th.</tool-tip>
    `;
    expect(parseContributionHtml(html)).toEqual([
      { date: "2025-09-07", contributionCount: 8, level: 1 },
    ]);
  });
});
