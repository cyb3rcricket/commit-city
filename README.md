# Commit City

> **Turn your GitHub history into a skyline.**

I had a pretty simple idea: GitHub gives us this little grid of green squares, but what would that history look like if it felt like an actual place?

So I built **Commit City**.

Give it a public GitHub username and it turns a year of contribution history into a 3D cyber-city. Each day becomes a city lot. More activity means taller buildings. Quiet days stay low and dark, so the original contribution graph is still there underneath everything.

It is part data visualization, part tiny digital city, and a little unnecessary in exactly the way I like.

## Run it locally

```bash
npm install
npm run dev
```

Vite will print the local URL, usually:

```text
http://localhost:5173
```

You can also jump straight to a username:

```text
http://localhost:5173/?user=torvalds
```

## Production build

```bash
npm test
npm run build
npm run preview
```

`preview` serves the production bundle and still mounts `/api/contributions`, so username lookup works locally too.

## How the GitHub data works

I did not want a GitHub token sitting in browser code, so the frontend talks to a small server-side endpoint instead:

```text
GET /api/contributions?user=USERNAME
```

That endpoint normalizes the contribution calendar into something the city can use:

```ts
{
  username,
  year,
  yearLabel,
  from,
  to,
  totalContributions,
  source: "github" | "mock",
  days: [
    {
      date,
      contributionCount,
      level,
      weekIndex,
      dayIndex
    }
  ]
}
```

Data resolution goes in this order:

1. **GitHub GraphQL** when `GITHUB_TOKEN` is available
2. **GitHub's public contribution calendar HTML** when it is not
3. **Deterministic mock data** during local development if GitHub is unavailable

For local GraphQL access, copy `.env.example` to `.env` and add:

```env
GITHUB_TOKEN=your_token_here
USE_MOCK=false
```

Never put that token in client-side JavaScript.

On Vercel, set `GITHUB_TOKEN` as a server-side environment variable. The function lives at `api/contributions.ts`.

The app understands both:

```text
/?user=USERNAME
/u/USERNAME
```

If I just want predictable fake data while working on the visuals:

```env
USE_MOCK=true
```

or:

```text
/api/contributions?user=demo&mock=1
```

while `npm run dev` is running.

## Built with

- **Vite + TypeScript**
- **Three.js** for the city, camera, instanced buildings, fog, bloom, and particles
- **Vitest** for the test suite
- a serverless-style `/api/contributions` endpoint shared by local Vite development and Vercel

A lot of Commit City has also been built through AI-assisted iteration with Grok Build: get the idea working, look at what feels wrong, fix it, make it weirder, occasionally make it *too* weird, and then reel it back in.

That process is honestly a big part of why this exists.

## The rule I do not want to break

The city can get more dramatic. The environment can get stranger. The camera can get more cinematic.

But the contribution history should still be the contribution history.

The towers are the data.
