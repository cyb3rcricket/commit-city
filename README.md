# Commit City

Turn a GitHub contribution history into a 3D cyber-city.

Enter a public username. Commit City maps a year of contribution days onto city lots, then raises a skyline — taller towers for heavier days, dark foundations for empty ones — so the familiar calendar grid is still readable from above.

## Run locally

```bash
npm install
npm run dev
```

Open the printed local URL (default `http://localhost:5173`).

Optional:

```
http://localhost:5173/?user=torvalds
```

## Production build

```bash
npm run build
npm run preview
```

`preview` serves the production bundle and still mounts `/api/contributions` so username lookup works locally.

## GitHub data

The browser never talks to GitHub with a secret. It calls:

```
GET /api/contributions?user=USERNAME
```

That endpoint returns a normalized calendar:

```ts
{
  username,
  year,
  yearLabel,
  from,
  to,
  totalContributions,
  source: "github" | "mock",
  days: [{ date, contributionCount, level, weekIndex, dayIndex }]
}
```

Resolution order:

1. **GitHub GraphQL** if `GITHUB_TOKEN` is set (preferred, more stable)
2. **Public contribution calendar HTML** if no token (no extra scopes required)
3. **Deterministic mock data** in local Vite when GitHub is unreachable, so the city can still be developed

Copy `.env.example` to `.env` for local tokens:

```
GITHUB_TOKEN=ghp_...
USE_MOCK=false
```

Create a classic PAT with public access, or a fine-grained token that can read public user data. **Never put the token in client-side JavaScript.**

On Vercel, set `GITHUB_TOKEN` as an environment variable. The function lives at `api/contributions.ts`. Visiting `/u/USERNAME` rewrites to the app; the client also understands `/?user=USERNAME`.

Force mock data while designing:

```
USE_MOCK=true
```

or ` /api/contributions?user=demo&mock=1` during `npm run dev`.

## Stack

- Vite + TypeScript
- Three.js (instanced buildings, fog, bloom, particles)
- Serverless-style `/api/contributions` used by both Vite middleware and Vercel
