import { assignGrid, buildCityData, clampLevel } from "../shared/calendar";
import type { CityData, ContributionLevel } from "../shared/types";

const USER_AGENT = "CommitCity/1.0 (https://github.com/commit-city)";

type GraphQLCalendar = {
  data?: {
    user?: {
      contributionsCollection?: {
        contributionCalendar?: {
          totalContributions: number;
          weeks: Array<{
            contributionDays: Array<{
              date: string;
              contributionCount: number;
              contributionLevel: string;
              weekday: number;
            }>;
          }>;
        };
      };
    } | null;
  };
  errors?: Array<{ type?: string; message: string }>;
};

function levelFromGraphql(value: string): ContributionLevel {
  switch (value) {
    case "NONE":
      return 0;
    case "FIRST_QUARTILE":
      return 1;
    case "SECOND_QUARTILE":
      return 2;
    case "THIRD_QUARTILE":
      return 3;
    case "FOURTH_QUARTILE":
      return 4;
    default:
      return clampLevel(Number(value) || 0);
  }
}

export class ContributionParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContributionParseError";
  }
}

export function parseCount(label: string): number | null {
  const text = label.replace(/\s+/g, " ").trim();
  if (!text) return null;
  if (/no contributions/i.test(text)) return 0;
  const match = text.match(/([0-9,]+)\s+contributions?/i);
  if (!match) return null;
  const value = Number(match[1].replace(/,/g, ""));
  if (!Number.isFinite(value)) return null;
  return value;
}

export class GithubLookupError extends Error {
  code: "not_found" | "rate_limited" | "unavailable" | "network";
  status: number;

  constructor(
    code: GithubLookupError["code"],
    message: string,
    status: number,
  ) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export async function fetchViaGraphql(
  username: string,
  token: string,
): Promise<CityData> {
  const query = `
    query CommitCity($login: String!) {
      user(login: $login) {
        contributionsCollection {
          contributionCalendar {
            totalContributions
            weeks {
              contributionDays {
                date
                contributionCount
                contributionLevel
                weekday
              }
            }
          }
        }
      }
    }
  `;

  let response: Response;
  try {
    response = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
      },
      body: JSON.stringify({ query, variables: { login: username } }),
    });
  } catch {
    throw new GithubLookupError(
      "network",
      "Couldn't reach GitHub. Check your connection.",
      503,
    );
  }

  if (response.status === 401 || response.status === 403) {
    throw new GithubLookupError(
      response.status === 403 ? "rate_limited" : "unavailable",
      "GitHub rejected the configured token.",
      response.status,
    );
  }

  if (response.status === 429) {
    throw new GithubLookupError(
      "rate_limited",
      "GitHub is rate-limiting requests. Try again in a few minutes.",
      429,
    );
  }

  if (!response.ok) {
    throw new GithubLookupError(
      "unavailable",
      "GitHub GraphQL is unavailable right now.",
      response.status,
    );
  }

  let payload: GraphQLCalendar;
  try {
    payload = (await response.json()) as GraphQLCalendar;
  } catch {
    throw new GithubLookupError(
      "unavailable",
      "GitHub GraphQL returned an unreadable response.",
      502,
    );
  }
  const gqlError = payload.errors?.[0];
  if (gqlError?.type === "RATE_LIMITED") {
    throw new GithubLookupError("rate_limited", gqlError.message, 429);
  }

  const user = payload.data?.user;
  if (!user) {
    throw new GithubLookupError(
      "not_found",
      `No GitHub user named ${username}.`,
      404,
    );
  }

  const calendar = user.contributionsCollection?.contributionCalendar;
  if (!calendar) {
    throw new GithubLookupError(
      "unavailable",
      "Contribution data was missing for that user.",
      502,
    );
  }

  const raw = calendar.weeks.flatMap((week) =>
    week.contributionDays.map((day) => ({
      date: day.date,
      contributionCount: day.contributionCount,
      level: levelFromGraphql(day.contributionLevel),
    })),
  );

  return buildCityData(
    username,
    assignGrid(raw),
    "github",
    calendar.totalContributions,
  );
}

export async function fetchViaHtml(username: string): Promise<CityData> {
  let response: Response;
  try {
    response = await fetch(
      `https://github.com/users/${encodeURIComponent(username)}/contributions`,
      {
        headers: {
          Accept: "text/html",
          "User-Agent": USER_AGENT,
        },
      },
    );
  } catch {
    throw new GithubLookupError(
      "network",
      "Couldn't reach GitHub. Check your connection.",
      503,
    );
  }

  if (response.status === 404) {
    throw new GithubLookupError(
      "not_found",
      `No GitHub user named ${username}.`,
      404,
    );
  }

  if (response.status === 429) {
    throw new GithubLookupError(
      "rate_limited",
      "GitHub is rate-limiting requests. Try again in a few minutes.",
      429,
    );
  }

  if (!response.ok) {
    throw new GithubLookupError(
      "unavailable",
      "GitHub contribution data is unavailable right now.",
      response.status,
    );
  }

  const html = await response.text();
  let parsed: ReturnType<typeof parseContributionHtml>;
  try {
    parsed = parseContributionHtml(html);
  } catch (error) {
    if (error instanceof ContributionParseError) {
      throw new GithubLookupError("unavailable", error.message, 502);
    }
    throw error;
  }
  if (parsed.length === 0) {
    throw new GithubLookupError(
      "unavailable",
      "Could not read that contribution calendar.",
      502,
    );
  }

  const totalMatch = html.match(
    /([0-9,]+)\s+contributions?\s+in\s+the\s+last\s+year/i,
  );
  const total = totalMatch
    ? Number(totalMatch[1].replace(/,/g, ""))
    : undefined;

  return buildCityData(username, assignGrid(parsed), "github", total);
}

export function parseContributionHtml(
  html: string,
): Array<{ date: string; contributionCount: number; level: ContributionLevel }> {
  const counts = new Map<string, number | null>();
  const tipRe =
    /<tool-tip[^>]*\bfor="(contribution-day-component-\d+-\d+)"[^>]*>([\s\S]*?)<\/tool-tip>/gi;
  for (const match of html.matchAll(tipRe)) {
    counts.set(match[1], parseCount(match[2]));
  }

  const days: Array<{
    date: string;
    contributionCount: number;
    level: ContributionLevel;
  }> = [];
  const seen = new Set<string>();
  const cellRe = /<td\b[^>]*\bdata-date="(\d{4}-\d{2}-\d{2})"[^>]*>/gi;

  for (const match of html.matchAll(cellRe)) {
    const tag = match[0];
    const date = match[1];
    if (seen.has(date)) continue;
    seen.add(date);
    const id = tag.match(/\bid="(contribution-day-component-\d+-\d+)"/)?.[1];
    const levelRaw = tag.match(/\bdata-level="([^"]*)"/)?.[1];
    if (levelRaw === undefined || !/^[0-4]$/.test(levelRaw)) {
      throw new ContributionParseError(
        "GitHub calendar HTML is missing a valid contribution level.",
      );
    }
    const level = Number(levelRaw) as ContributionLevel;
    const fromTip = id ? counts.get(id) : undefined;

    let contributionCount: number;
    if (fromTip == null) {
      if (level === 0) {
        contributionCount = 0;
      } else {
        throw new ContributionParseError(
          "GitHub calendar HTML is missing exact contribution counts.",
        );
      }
    } else {
      contributionCount = fromTip;
    }

    days.push({ date, contributionCount, level });
  }

  days.sort((a, b) => a.date.localeCompare(b.date));
  return days;
}

export async function fetchGithubCity(username: string): Promise<CityData> {
  const token = process.env.GITHUB_TOKEN?.trim();
  if (token) {
    try {
      return await fetchViaGraphql(username, token);
    } catch (error) {
      if (error instanceof GithubLookupError && error.code === "not_found") {
        throw error;
      }
      console.warn(
        "[github] GraphQL failed, falling back to public calendar HTML",
        error,
      );
    }
  }

  return fetchViaHtml(username);
}
