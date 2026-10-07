# Enigma Machine Simulator

An educational, historically accurate simulator of the WWII Enigma I, M3 and M4 cipher machines, in two interchangeable views: an interactive 3D model and a skeuomorphic 2D machine. See [PLAN.md](PLAN.md) for the design and history of the project.

**Live:** https://tnoyt123.github.io/enigma-webapp/

## Features

- **Accurate machines.** Real rotor and reflector wirings, ring settings, plugboard and the double-stepping anomaly. Verified against real wartime messages: Barbarossa 1941 (Enigma I), Scharnhorst 1943 (M3) and U-264 1942 (M4).
- **2D and 3D views** with the same features, switchable at any time (`?view=2d` / `?view=3d`) without losing state. The 2D view never downloads the 3D code.
- **How it works.** An x-ray view of the path the current takes through the machine, and a step-by-step walkthrough of every key press, including why each rotor stepped.
- **Hands-on.** Open the lid to swap rotors with the rotor box (with the drop target outlined), set rings in a close-up, drag thumbwheels and plugboard cables.
- **Real messages.** Load one of those wartime messages with its key in one click, and decipher it on the machine step by step.
- **Radio messages.** Send and receive messages with the period's indicator procedures: the 1938–40 doubled indicator, the 1940–45 Army procedure and the Kriegsmarine bigram procedure.
- **Sound.** Recorded mechanical key clicks and a synthesized ratchet click for each rotor that steps.
- **Accessible.** Full keyboard and screen-reader support in both views, axe-checked (WCAG 2.1 AA), touch-friendly on phones.
- **Remembers** the machine setup, view and sound settings on each device.

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

The key sounds in `public/sounds/` are cut from `assets/sounds/mech-button-1.wav`. After changing the recording or the cut points, rebuild them with `python3 scripts/build-sounds.py`.

## Layout

- `src/engine/`: the cipher engine and message procedures. Pure TypeScript with no DOM or React, and the single source of truth.
- `src/state/`: shared stores (machine, view, teaching) and saving between visits.
- `src/ui2d/`, `src/scene/`: the 2D and 3D views, thin renderers over the shared state.
- `src/panels/`: the sidebar panels shared by both views (how it works, key sheet, tape, radio).
- `src/teaching/`: the plain-language explanations. `src/audio/`: sound.
- `tests/unit/`: Vitest unit and property tests. `tests/e2e/`: Playwright, with every behaviour run in both views on desktop and mobile.

## Deployment

Pushes to `mainline` run CI. When it passes, `.github/workflows/deploy.yml` publishes `dist/` to GitHub Pages. Enable Pages in the repository settings with **Source: GitHub Actions**.
