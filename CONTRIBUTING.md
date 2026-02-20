# Contributing

## Getting Started

1. Install dependencies:
   - `bun install`
2. Start local dev server:
   - `bun run dev`

## Development Notes

- React app lives in `src/`.
- Worker + Durable Object logic lives in `worker/index.ts`.
- Keep API routes under `/api/*` so `run_worker_first` continues to route correctly.

## Pull Requests

- Keep changes focused and small.
- Update `README.md` if behavior or scripts change.
- Validate Wrangler config before submission:
  - `bun run check`
