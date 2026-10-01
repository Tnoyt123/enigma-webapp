# Enigma Machine Simulator

An educational, historically accurate simulator of the WWII Enigma I, M3 and M4 cipher machines, with an interactive 3D model, live signal-path visualization and an accessible 2D mode. See [PLAN.md](PLAN.md) for the roadmap.

## Development

Requires Node 24+ (see `.nvmrc`).

```bash
npm install
npm run dev            # dev server
npm test               # unit tests (Vitest)
npm run test:e2e       # browser tests (Playwright; first run: npx playwright install chromium)
npm run lint           # oxlint
npm run format         # Prettier
npm run build          # typecheck + production build
```

## Layout

- `src/engine/` — the cipher engine: pure TypeScript, no DOM or React. The single source of truth.
- `src/` (other folders, added per phase) — state, 3D scene, 2D accessible UI, panels, audio.
- `tests/unit/` — Vitest unit and property tests; `tests/e2e/` — Playwright.

## Deployment

Pushes to `mainline` run CI. When it passes, `.github/workflows/deploy.yml` publishes `dist/` to GitHub Pages. Enable Pages in the repository settings with **Source: GitHub Actions**.
