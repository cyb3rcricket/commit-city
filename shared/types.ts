export type ContributionLevel = 0 | 1 | 2 | 3 | 4;

export type ContributionDay = {
  date: string;
  contributionCount: number;
  level: ContributionLevel;
  weekIndex: number;
  dayIndex: number;
};

export type CityData = {
  username: string;
  year: number;
  yearLabel: string;
  from: string;
  to: string;
  totalContributions: number;
  days: ContributionDay[];
  source: "github" | "mock";
};

export type ApiErrorBody = {
  error: string;
  code:
    | "invalid_username"
    | "not_found"
    | "rate_limited"
    | "unavailable"
    | "network"
    | "internal_error";
};

export type ApiSuccessBody = CityData;

export const USERNAME_PATTERN =
  /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/;
