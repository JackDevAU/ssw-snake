# SSW Snake Game

React + Vite + Cloudflare Workers snake game with:
- animated SSW logo intro
- face-particle effects on food pickup
- Durable Object leaderboard
- custom-domain deployment (`snake.jackpettit.dev`)

## Stack

- React 18
- Vite
- `@cloudflare/vite-plugin`
- Cloudflare Workers
- Cloudflare Durable Objects (SQLite-backed)

## Project Structure

```txt
src/
  App.tsx
  main.tsx
  styles.css
worker/
  index.ts
wrangler.jsonc
vite.config.ts
```

## Local Development

```bash
bun install
bun run dev
```

`bun run dev` uses Vite + Cloudflare plugin for local Workers runtime integration and HMR.

## Deploy

```bash
bun run deploy
```

Useful scripts:
- `bun run dev` - local development
- `bun run build` - production build
- `bun run typecheck` - TypeScript typecheck
- `bun run deploy` - build and deploy to Workers
- `bun run check` - validate Wrangler config

## Leaderboard

- API endpoints:
  - `POST /api/run/start` - creates one-time run token
  - `GET/POST /api/leaderboard`
- Durable Object class: `Leaderboard` in `worker/index.ts`
- Public page: `/leaderboard`
- In-game leaderboard preview appears on the lose screen

## Configuration Notes

`wrangler.jsonc` is configured for SPA routing and API passthrough:
- `assets.not_found_handling = "single-page-application"`
- `assets.run_worker_first = ["/api/*", "/leaderboard"]`

## License

MIT. See `LICENSE`.
