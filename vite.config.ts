import { defineConfig, type Connect, type Plugin } from "vite";
import { handleContributionsRequest } from "./server/handler";

function contributionsApi(): Plugin {
  const attach = (server: { middlewares: Connect.Server }) => {
    server.middlewares.use(async (req, res, next) => {
      const raw = req.url ?? "";
      const url = new URL(raw, "http://commit.city");
      if (url.pathname !== "/api/contributions") {
        next();
        return;
      }

      const username = url.searchParams.get("user") ?? "";
      const forceMock = url.searchParams.get("mock") === "1";

      try {
        const result = await handleContributionsRequest(username, {
          forceMock,
          allowMockFallback: true,
        });
        res.statusCode = result.status;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Cache-Control", "public, max-age=30, s-maxage=60");
        res.end(JSON.stringify(result.body));
      } catch (error) {
        console.error("[api/contributions]", error);
        res.statusCode = 500;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(
          JSON.stringify({
            error: "Something went wrong while mapping that skyline.",
            code: "internal_error",
          }),
        );
      }
    });
  };

  return {
    name: "commit-city-contributions-api",
    configureServer: attach,
    configurePreviewServer: attach,
  };
}

export default defineConfig({
  plugins: [contributionsApi()],
  server: {
    port: 5173,
    host: true,
  },
  preview: {
    port: 4173,
    host: true,
  },
  build: {
    target: "es2022",
    sourcemap: true,
  },
});
