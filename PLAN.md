# Enigma Simulator — Implementation Plan

## Goals (from requirements Q&A)

| Area     | Decision                                                                         |
| -------- | -------------------------------------------------------------------------------- |
| Models   | Enigma I (Army/Luftwaffe), Kriegsmarine M3, M4                                   |
| Purpose  | Education / museum-style — clarity and explanation first                         |
| Visuals  | 3D interactive model (WebGL)                                                     |
| Stack    | React + TypeScript + Vite                                                        |
| Teaching | Live signal-path visualization; step-by-step / slow-motion mode                  |
| Fidelity | Double-stepping, ring settings, physical plugboard cabling, rotor swapping in 3D |
| I/O      | Physical keyboard + lampboard, historical message format, sound effects          |
| Hosting  | Static site, no backend                                                          |
| Extras   | Mobile/touch support, accessible 2D (non-WebGL) mode                             |
| Approach | Test-verified engine first, then the UI in phases                                |

Out of scope for now: commercial, Railway and Abwehr variants, Bombe/cryptanalysis, key-sheet generator, accounts, shareable URLs. The engine design leaves room to add them later.

---

## Architecture

```
src/
  engine/          Pure TS, zero dependencies, no DOM. The source of truth.
    data/          Rotor / reflector wiring tables + model definitions
    rotor.ts       Rotor with wiring, ring setting, position, notches
    plugboard.ts
    machine.ts     Assembles the models; step(); press(key) → Trace
    trace.ts       Per-keypress record of every substitution stage
    procedure.ts   Historical message format: 5-letter groups, indicators
  state/           Zustand store: machine config, current positions, trace, UI mode
  scene/           react-three-fiber 3D machine
    Machine.tsx, Keyboard.tsx, Lampboard.tsx, RotorAssembly.tsx,
    Plugboard.tsx, SignalPath.tsx, CameraRig.tsx
  ui2d/            Accessible SVG/HTML machine (also the dev harness)
  panels/          Settings, step-mode explainer, message tape
  audio/           Web Audio sample playback (key, rotor step, lamp)
  app/             Routing between 3D / 2D modes, WebGL detection
tests/
  engine/          Vitest unit + property tests, historical vectors
  e2e/             Playwright smoke tests
```

**Key principle:** the UI never computes any cryptography. Every keypress calls `machine.press(letter)`. That returns a `Trace`: the stepping that happened plus the letter at every stage (keyboard → plugboard → entry wheel → R → M → L → [thin rotor] → reflector → back → plugboard → lamp). The trace drives everything downstream: the lamp, the rotor animation, signal-path drawing, step-mode narration and the 2D view. The 3D view, the 2D view and the explanations therefore can never disagree.

### Libraries

- `three` + `@react-three/fiber` + `@react-three/drei` for 3D. `@react-spring/three` for rotor and key animation.
- `zustand` for state (works well with r3f).
- `vitest` + `fast-check` (property tests), `@playwright/test` (e2e).
- Tailwind v4 for the panels.

---

## Historical data (engine/data)

Wirings are the standard published tables. Each is verified by the test vectors below, not by trust alone.

| Rotor        | Wiring                     | Turnover notch(es) | Models    |
| ------------ | -------------------------- | ------------------ | --------- |
| I            | EKMFLGDQVZNTOWYHXUSPAIBRCJ | Q                  | I, M3, M4 |
| II           | AJDKSIRUXBLHWTMCQGZNPYFVOE | E                  | I, M3, M4 |
| III          | BDFHJLCPRTXVZNYEIWGAKMUSQO | V                  | I, M3, M4 |
| IV           | ESOVPZJAYQUIRHXLNFTGKDCMWB | J                  | I, M3, M4 |
| V            | VZBRGITYUPSDNHLXAWMJQOFECK | Z                  | I, M3, M4 |
| VI           | JPGVOUMFYQBENHZRDKASXLICTW | Z, M               | M3, M4    |
| VII          | NZJHGRCXMYSWBOUFAIVLPEKQDT | Z, M               | M3, M4    |
| VIII         | FKQHTLXOCBJSPDZRAMEWNIUYGV | Z, M               | M3, M4    |
| Beta (thin)  | LEYJVCNIXWPBQMDRTAKZGFUHOS | never steps        | M4        |
| Gamma (thin) | FSOKANUERHMBTIYCWLQPZXVGJD | never steps        | M4        |

| Reflector  | Wiring                     | Models      |
| ---------- | -------------------------- | ----------- |
| UKW-A      | EJMZALYXVBWFCRQUONTSPIKHGD | I (pre-war) |
| UKW-B      | YRUHQSLDPXNGOKMIEBFZCWVJAT | I, M3       |
| UKW-C      | FVPJIAOYEDRZXWGCTKUQSBNMHL | I, M3       |
| UKW-B thin | ENKQAUYWJICOPBLMDXZVFTHRGS | M4          |
| UKW-C thin | RDOBJNTKVEHMLFCWZAXGYIPSUQ | M4          |

The entry wheel (ETW) on all three models is the identity (ABC…). Each wiring entry records its source and date of introduction, so the history panels can use it later.

Model definitions set the constraints: which rotors are allowed, 3 or 4 slots, which reflectors, and the plugboard pair count (historically 10 pairs, but 0–13 allowed).

---

## Correctness strategy

1. **Unit tests** for each component: the rotor's forward and inverse mapping with ring and position offsets, plugboard pairing rules, and reflector symmetry.
2. **Stepping tests:** the canonical double-step sequence (e.g. rotors I-II-III at ADU → ADV → AEW → BFX), notches on rotors VI–VIII, and the M4 4th rotor never stepping.
3. **Property tests (fast-check):**
   - The machine is reciprocal: `decrypt(encrypt(x)) == x` under the same settings.
   - No letter ever encrypts to itself.
   - Every rotor wiring is a permutation, and every reflector is an involution with no fixed points.
   - M4 with Beta at A, ring A and thin-B equals M3 with UKW-B.
4. **Historical vectors:**
   - Enigma I: the 1941 Operation Barbarossa message (rotors II IV V, rings BUL, UKW-B, plugboard AV BS CG DL FU HZ IN KM OW RX).
   - M4: the U-534 message and other published Kriegsmarine decrypts.
   - Cross-check against at least one trusted reference simulator for random configurations.
5. **CI:** the engine tests run on every push. The engine is not "done" until 100% of its tests pass and branch coverage is high.

---

## Phases

### Phase 0 — Project setup ✅

- `git init`, Vite 8 React-TS template, oxlint (the template's default, replacing ESLint) + Prettier, Vitest + fast-check, Playwright (desktop Chromium + mobile Pixel 7).
- GitHub Actions: `ci.yml` (lint, format check, typecheck, unit tests with coverage, build, e2e) and `deploy.yml` (GitHub Pages after CI passes on `mainline`).
- Styling: Tailwind v4.

### Phase 1 — Engine (test-first) ✅

- Data tables, rotor/reflector/plugboard logic, `step()`, `press()` → `Trace`, `EnigmaMachine` wrapper, key-sheet parsing.
- Model presets with validation errors (e.g. "Rotor VI isn't available on Enigma I").
- 81 tests, 100% line coverage: data integrity, stepping (incl. double step and the 16,900 period), properties, and three historical messages. They are the Barbarossa 1941 message (Enigma I, including its indicator), the Scharnhorst 1943 message (M3, two-notch rotors) and the U-534 1945 message (M4).
- The tests caught an error in the hand-written UKW-B wiring, which is now corrected and verified by the involution test and all three messages.

### Phase 2 — 2D accessible machine (also the dev harness)

- SVG/HTML machine: settings panel, rotor windows, keyboard, lampboard, plugboard.
- Physical keyboard input, and an `aria-live` region that announces each lamp.
- Bulk decrypt of a message tape (output in 5-letter groups).
- WebGL detection that falls back to this mode automatically, plus a manual toggle.
- **Exit criteria:** fully usable with keyboard only and a screen reader, and passes axe checks.

### Phase 3 — 3D machine: static scene + typing

- **Asset decision:** either model in Blender and export glTF (most realistic), or build procedurally from three.js primitives (faster). Recommendation: prototype procedurally, then swap in a glTF model once the interactions are settled.
- Wooden case, keys, lampboard, rotor windows, basic PBR materials, and environment lighting.
- Key-press animation, lamp glow (emissive plus bloom), and the visible rotor stepping animation that drives the window letters.
- Camera presets: operator view, top/lid-open view, plugboard view.

### Phase 4 — Teaching layer

- **Signal-path visualization:** a glowing polyline or tube through the plugboard → ETW → each rotor's contacts → reflector → back. Forward and return legs get different colors. In "x-ray" mode the rotor housings turn semi-transparent to show the internal wiring.
- **Step mode:** a play/pause/next control walks through the `Trace` stage by stage. A side panel explains each stage, e.g. "Rotor II, position K, ring B: G enters on contact F … exits as T". Animation speed is adjustable.
- A short explanation of double-stepping, triggered the moment it happens.

### Phase 5 — Hands-on mechanics

- **Rotor swapping:** open the lid, click or drag a rotor out onto a tray, pick another from the box, drop it into a slot. Model constraints are enforced.
- **Ring settings:** a rotor held in close-up view lets you turn its alphabet ring relative to the core.
- **Rotor position:** drag or scroll the thumbwheels.
- **Plugboard cabling:** drag a cable from socket to socket, with a sagging curve (catenary or bezier) and a pair limit.
- Every 3D interaction mirrors a 2D-panel control, for accessibility and precision.

### Phase 6 — Historical procedure + audio

- Message format: header line (time, letter count, Grundstellung, encrypted indicator), 5-letter groups, and Kenngruppen for naval traffic.
- Indicator procedure walkthroughs: pre-1940 doubled indicator, post-1940 Grundstellung method, and the M4 procedure.
- Web Audio: a sample pool for key down/up, rotor ratchet and lamp click, with volume and mute.

### Phase 7 — Mobile, performance, polish, launch

- Touch: tap keys, pinch/orbit the camera, long-press to drag cables. An on-screen keyboard fallback is always available.
- Performance budget: 60 fps on mid-range phones. Instanced keys and lamps, compressed textures (KTX2), lazy-loaded 3D bundle, and a 2D mode that loads without three.js.
- Settings persisted to `localStorage` (a convenience only).
- Lighthouse and axe audits, then deploy.

---

## Open decisions (to settle when we reach them)

1. 3D assets: procedural vs. a Blender glTF model (and who models it).
2. ~~Styling~~: decided — Tailwind v4.
3. ~~Hosting~~: decided — GitHub Pages.
4. Sound sources: record, synthesize, or CC0 samples (licensing).
5. How much historical narrative to write for this phase vs. later.
