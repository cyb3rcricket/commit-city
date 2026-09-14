import { USERNAME_PATTERN, type ApiErrorBody, type CityData } from "../shared/types.js";
import { fetchGithubCity, GithubLookupError } from "./github.js";
import { createMockCity } from "./mockData.js";

const cache = new Map<string, { expires: number; data: CityData }>();
const CACHE_MS = 60_000;

export type HandlerResult = {
  status: number;
  body: CityData | ApiErrorBody;
};

export type HandlerOptions = {
  forceMock?: boolean;
  allowMockFallback?: boolean;
};

function errorBody(status: number, code: ApiErrorBody["code"], error: string): HandlerResult {
  return { status, body: { error, code } };
}

export async function handleContributionsRequest(
  rawUsername: string,
  options: HandlerOptions = {},
): Promise<HandlerResult> {
  const username = (typeof rawUsername === "string" ? rawUsername : "").trim().replace(/^@/, "");

  if (!username || !USERNAME_PATTERN.test(username)) {
    return errorBody(
      400,
      "invalid_username",
      "That username doesn't look like a GitHub login.",
    );
  }

  const useMock =
    options.forceMock ||
    process.env.USE_MOCK === "true" ||
    process.env.VITE_USE_MOCK === "true";

  if (useMock) {
    return { status: 200, body: createMockCity(username) };
  }

  const cacheKey = username.toLowerCase();
  const cached = cache.get(cacheKey);
  if (cached) {
    if (cached.expires > Date.now()) {
      return { status: 200, body: cached.data };
    }
    cache.delete(cacheKey);
  }

  try {
    const data = await fetchGithubCity(username);
    if (cache.size > 200) {
      const now = Date.now();
      for (const [k, entry] of cache.entries()) {
        if (entry.expires <= now) {
          cache.delete(k);
        }
      }
      if (cache.size > 200) {
        const oldestKey = cache.keys().next().value;
        if (oldestKey !== undefined) {
          cache.delete(oldestKey);
        }
      }
    }
    cache.set(cacheKey, { data, expires: Date.now() + CACHE_MS });
    return { status: 200, body: data };
  } catch (error) {
    if (error instanceof GithubLookupError) {
      if (options.allowMockFallback && error.code !== "not_found") {
        console.warn("[api] GitHub unavailable, serving mock city", error);
        const mock = createMockCity(username);
        return { status: 200, body: mock };
      }
      return errorBody(error.status, error.code, error.message);
    }

    if (options.allowMockFallback) {
      console.warn("[api] Unexpected GitHub failure, serving mock city", error);
      return { status: 200, body: createMockCity(username) };
    }

    return errorBody(
      502,
      "unavailable",
      "Couldn't map that contribution history right now.",
    );
  }
}
