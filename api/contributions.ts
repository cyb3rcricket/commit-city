import type { IncomingMessage, ServerResponse } from "node:http";
import { handleContributionsRequest } from "../server/handler";

type VercelRequest = IncomingMessage & {
  query?: Record<string, string | string[] | undefined>;
};

type VercelResponse = ServerResponse & {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
};

function readQueryParam(
  req: VercelRequest,
  key: string,
): string {
  const fromQuery = req.query?.[key];
  if (typeof fromQuery === "string") return fromQuery;
  if (Array.isArray(fromQuery) && fromQuery[0]) return fromQuery[0];
  try {
    const host = req.headers.host ?? "localhost";
    const url = new URL(req.url ?? "/", `http://${host}`);
    return url.searchParams.get(key) ?? "";
  } catch {
    return "";
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method && req.method !== "GET") {
    res.statusCode = 405;
    res.setHeader("Allow", "GET");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "Method not allowed", code: "internal_error" }));
    return;
  }

  const username = readQueryParam(req, "user");
  const forceMock = readQueryParam(req, "mock") === "1";
  const result = await handleContributionsRequest(username, {
    forceMock,
    allowMockFallback: false,
  });

  res.statusCode = result.status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=30, s-maxage=60, stale-while-revalidate=300");
  res.end(JSON.stringify(result.body));
}
