import type { ApiErrorBody, CityData } from "../../shared/types";

export class CityRequestError extends Error {
  code: ApiErrorBody["code"];
  status: number;

  constructor(message: string, code: ApiErrorBody["code"], status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export async function fetchCityData(username: string): Promise<CityData> {
  const url = `/api/contributions?user=${encodeURIComponent(username)}`;
  let response: Response;
  try {
    response = await fetch(url, { headers: { Accept: "application/json" } });
  } catch {
    throw new CityRequestError(
      "Couldn't reach the mapping service.",
      "network",
      0,
    );
  }

  let payload: CityData | ApiErrorBody;
  try {
    payload = (await response.json()) as CityData | ApiErrorBody;
  } catch {
    throw new CityRequestError(
      "The mapping service returned an unreadable response.",
      "unavailable",
      response.status,
    );
  }

  if (!response.ok || "error" in payload) {
    const err = payload as ApiErrorBody;
    throw new CityRequestError(
      err.error || "Couldn't map that contribution history.",
      err.code || "unavailable",
      response.status,
    );
  }

  return payload;
}

export function usernameFromLocation(): string | null {
  const params = new URLSearchParams(window.location.search);
  const queryUser = params.get("user")?.trim();
  if (queryUser) return queryUser;

  const path = window.location.pathname.match(/^\/u\/([^/]+)\/?$/);
  if (path?.[1]) {
    const pathUser = decodeURIComponent(path[1]).trim();
    if (pathUser) return pathUser;
  }
  return null;
}

export function shareUrlFor(username: string): string {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  url.pathname = "/";
  url.searchParams.set("user", username);
  return url.toString();
}
