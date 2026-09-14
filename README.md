# Commit City

> **Turn your GitHub history into a skyline.**

**[Live Demo](https://commit-city-psi.vercel.app)** · try [`/?user=cyb3rcricket`](https://commit-city-psi.vercel.app/?user=cyb3rcricket)

[![Commit City — cyb3rcricket contribution skyline](docs/commit-city-hero.png)](docs/commit-city-demo.webm)

[Watch the silent 20s demo (WebM)](docs/commit-city-demo.webm)

I had a pretty simple idea: GitHub gives us this little grid of green squares, but what would that history look like if it felt like an actual place?

So I built **Commit City**.

## What Commit City does

Give it a public GitHub username and it turns a year of contribution history into a 3D cyber-city. Each day becomes a city lot. More activity means taller buildings. Quiet days stay low and dark, so the original contribution graph is still there underneath everything.

It is part data visualization, part tiny digital city, and a little unnecessary in exactly the way I like.

## Try it

- Live: [https://commit-city-psi.vercel.app](https://commit-city-psi.vercel.app)
- Shareable username URLs:
  - `https://commit-city-psi.vercel.app/?user=USERNAME`
  - `https://commit-city-psi.vercel.app/u/USERNAME`

## Highlights

- Contribution calendar → instanced 3D skyline (Three.js)
- Fog, bloom, and particles for depth without burying the data
- Server-side `/api/contributions` so tokens never sit in browser code
- Share links and in-app **Capture Skyline** stills

## Local setup

```bash
npm install
npm run dev
```

Vite prints the local URL, usually `http://localhost:5173`.

Jump straight to a username:

```text
http://localhost:5173/?user=torvalds
```

### Production build

```bash
npm test
npm run build
npm run preview
```

`preview` serves the production bundle and still mounts `/api/contributions`, so username lookup works locally too.

### Local tips

For GraphQL access locally, copy `.env.example` to `.env`:

```env
GITHUB_TOKEN=your_token_here
USE_MOCK=false
```

Predictable fake data while working on visuals:

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

## How GitHub contribution data works

The frontend talks to a small server-side endpoint:

```text
GET /api/contributions?user=USERNAME
```

That endpoint normalizes the contribution calendar into something the city can use (`username`, year window, `totalContributions`, `source: "github" | "mock"`, and a `days[]` array with date, count, level, and grid indices).

Data resolution order:

1. **GitHub GraphQL** when `GITHUB_TOKEN` is available
2. **GitHub's public contribution calendar HTML** when it is not
3. **Deterministic mock data** during local development if GitHub is unavailable

Never put that token in client-side JavaScript.

### Production / deployment

The public demo runs on Vercel at [commit-city-psi.vercel.app](https://commit-city-psi.vercel.app). Set `GITHUB_TOKEN` as a **server-side** Production environment variable. Leave `USE_MOCK` unset in Production. The function lives at `api/contributions.ts`.

## The rule I do not want to break

The city can get more dramatic. The environment can get stranger. The camera can get more cinematic.

But the contribution history should still be the contribution history.

The towers are the data.

---

Built with a lot of AI-assisted iteration (Grok Build and friends): get the idea working, look at what feels wrong, fix it, make it weirder, occasionally make it *too* weird, and then reel it back in. That process is part of why this exists.
