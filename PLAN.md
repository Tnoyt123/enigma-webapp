# Enigma Simulator — Implementation Plan

## Goals (from requirements Q&A)

| Area     | Decision                                                                                                                      |
| -------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Models   | Enigma I (Army/Luftwaffe), Kriegsmarine M3, M4                                                                                |
| Purpose  | Education / museum-style — clarity and explanation first                                                                      |
| Visuals  | Two first-class views, easy to switch: 3D interactive model (WebGL) and the skeuomorphic 2D machine, with full feature parity |
| Stack    | React + TypeScript + Vite                                                                                                     |
| Teaching | Live signal-path visualization; step-by-step / slow-motion mode                                                               |
| Fidelity | Double-stepping, ring settings, physical plugboard cabling, rotor swapping in 3D                                              |
| I/O      | Physical keyboard + lampboard, historical message format, sound effects                                                       |
| Hosting  | Static site, no backend                                                                                                       |
| Extras   | Mobile/touch support; the 2D view also serves as the accessible, no-WebGL mode                                                |
| Approach | Test-verified engine first, then the UI in phases                                                                             |

Out of scope for now: commercial, Railway and Abwehr variants, Bombe/cryptanalysis, key-sheet generator, accounts, sharing machine settings by URL (only the view is in the URL). The engine design leaves room to add them later.

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
  app/             View switcher (2D ⇄ 3D), URL/preference handling, WebGL detection
tests/
  unit/            Vitest unit + property tests (engine, state, app), historical vectors
  e2e/             Playwright parity suite (runs per view), view switching, axe
```

**Key principle:** the UI never computes any cryptography. Every keypress calls `machine.press(letter)`. That returns a `Trace`: the stepping that happened plus the letter at every stage (keyboard → plugboard → entry wheel → R → M → L → [thin rotor] → reflector → back → plugboard → lamp). The trace drives everything downstream: the lamp, the rotor animation, signal-path drawing, step-mode narration and the 2D view. The 3D view, the 2D view and the explanations therefore can never disagree.

### Two views, one machine

Added after Phase 2. The 2D skeuomorphic machine is a permanent peer of the 3D one, not just a fallback, and switching between them should be effortless.

- **Thin views over shared state.** Both views only render the store and send it actions. Everything about the machine lives in the store, so switching views loses nothing. That includes the configuration, positions, tape, last trace, step-mode cursor, and any rotor or cable the user is mid-way through moving. Only presentation state stays inside a view, such as the 3D camera or the 2D scroll position.
- **Shared chrome.** The key sheet, message tape, step-mode explainer and audio sit outside the views and are the same in both. A view is the machine itself.
- **Switching.**
  - A 2D | 3D segmented control in the header switches views instantly and keeps focus sensibly.
  - The view is chosen in this order: the `?view=2d` / `?view=3d` URL parameter, then the choice remembered on that device (`localStorage`), then the default of **3D**.
  - Switching updates the URL (`history.replaceState`) and the remembered choice.
  - Without WebGL the app opens in 2D with a short notice, and the 3D option is disabled and says why.
- **Loading.** The 3D view is lazy-loaded (`React.lazy` + dynamic import), so the 2D view never downloads three.js. While 3D loads, the 2D view stays on screen.
- **Parity is enforced by tests.** The Playwright behaviour suite (typing, lamps, settings, plugboard, step mode, rotor swapping…) runs once per view. 3D controls carry the same accessible names as their 2D counterparts and drive the same store actions. A feature isn't done until it passes in both views.

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

### Phase 2 — 2D accessible machine (also the dev harness) ✅

- Zustand store (`src/state/machineStore.ts`) wrapping the engine. Setters validate and return problems. Choosing a rotor that's already in use swaps the two, and switching models keeps any settings the new model accepts.
- 2D machine (`src/ui2d/`): rotor windows (ARIA spinbuttons), lampboard (lit only while a key is held; one key at a time, as on the real machine), QWERTZ keyboard, and a clickable plugboard with drawn cables. Keyboard and plugboard use roving tabindex.
- Panels (`src/panels/`): a key sheet (model, reflector, rotor order, rings, plugboard text) and a message tape (5-letter groups, copy, reset rotors to the tape start, bulk encipher/decipher).
- The physical keyboard drives the machine whenever focus isn't in a field. A polite live region announces each press ("A lights B. Rotors A A B.").
- 18 Playwright tests (desktop + mobile), including Barbarossa decrypted through the UI and an axe WCAG 2.1 AA scan with zero violations.
- **Deferred:** WebGL detection and the 2D/3D toggle move to Phase 3, when there's a 3D view to switch to. On phones the keys are about 29px, below the 44px touch-target guideline; that is for Phase 7.

### Phase 3 — 3D machine: static scene + typing, and view switching ✅

- **View switching:**
  - Implemented in `src/app/view.ts` (pure, unit-tested) and `src/state/viewStore.ts`.
  - The header's 2D | 3D control is a pair of native radios. The choice comes from `?view=`, then `localStorage`, then the 3D default.
  - Without WebGL the app opens in 2D with a dismissible notice, and the 3D option is disabled.
  - `Machine3D` is lazy-loaded, with the 2D machine as its loading fallback. The 2D entry bundle is still about 79 kB gzipped; the 3D chunk is about 298 kB gzipped.
- **Shared state:** the half-plugged cable moved from the 2D plugboard into the store, so it survives a view switch.
- **Asset decision:** procedural for now (`src/scene/`), with letters drawn on canvas textures, so no font or HDR files are downloaded. A glTF model can still replace it later.
- **The 3D model:**
  - Wooden case, crinkle deck, QWERTZ keys with chrome rims, and lamp windows that glow with bloom.
  - Rotors with alphabet rings and knurled thumbwheels, with a brass reading frame, reflector and entry wheel.
  - A front plugboard with drawn cables and plugs.
  - Rotors animate the short way round, and keys travel. Motion is disabled when the user prefers reduced motion.
  - The camera framing adapts to narrow, portrait canvases.
- **Interaction and parity:**
  - Pointer users press keys (lamp lit while held), click thumbwheels (Shift-click or right-click turns back), and click sockets. Camera presets: Operator, Rotors, Plugboard.
  - Keyboard and screen-reader users get the same controls as the 2D view, with the same names and store actions. They're revealed as an overlay while focused.
  - A `?e2e` hook maps 3D parts to screen points, so the tests drive the real 3D pointer path.
- **2D:** rotor letters slide when stepping (`motion-safe`).
- **Tests:**
  - The parity suite runs every behaviour test in both views on desktop and mobile.
  - View tests cover the default, the URL taking priority over the remembered choice, state surviving a switch (including a half-plugged cable), 2D never loading the 3D chunk, and the no-WebGL fallback.
  - 50 Playwright tests in total, with an axe scan clean in both views. CI uses SwiftShader software WebGL.

### Phase 4 — Teaching layer (both views)

- **Signal-path visualization:**
  - **3D:** a glowing polyline or tube through the plugboard → ETW → each rotor's contacts → reflector → back. Forward and return legs get different colors. In "x-ray" mode the rotor housings turn semi-transparent to show the internal wiring.
  - **2D:** an "x-ray" panel that opens from the lid. It shows the plugboard, entry wheel, each rotor (as a column of 26 contacts with its wiring) and the reflector side by side, with the same colored path drawn through them. It's an SVG diagram, readable by screen readers as a list of stages.
- **Step mode (shared):** a play/pause/next control walks through the `Trace` stage by stage. A side panel explains each stage, e.g. "Rotor II, position K, ring B: G enters on contact F … exits as T". Animation speed is adjustable, and both views highlight the current stage.
- A short explanation of double-stepping, triggered the moment it happens, in both views.

### Phase 5 — Hands-on mechanics (both views)

- **Rotor swapping:**
  - **3D:** open the lid, click or drag a rotor out onto a tray, pick another from the box, drop it into a slot.
  - **2D:** an opened-lid illustration with the rotor box beside it. Drag or click a rotor between box and slots, with an equivalent keyboard flow.
  - Model constraints are enforced in both.
- **Ring settings:**
  - **3D:** a rotor held in close-up view lets you turn its alphabet ring relative to the core.
  - **2D:** a close-up rotor dialog with the same interaction.
- **Rotor position:**
  - **3D:** drag or scroll the thumbwheels.
  - **2D:** drag the thumbwheels as well as the existing buttons and keys.
- **Plugboard cabling:**
  - **3D:** drag a cable from socket to socket, with a sagging curve (catenary or bezier) and a pair limit.
  - **2D:** drag-to-connect added alongside the existing click-to-connect.
- Every interaction keeps a key-sheet control as well, for accessibility and precision.

### Phase 6 — Historical procedure + audio

- Message format: header line (time, letter count, Grundstellung, encrypted indicator), 5-letter groups, and Kenngruppen for naval traffic.
- Indicator procedure walkthroughs: pre-1940 doubled indicator, post-1940 Grundstellung method, and the M4 procedure.
- Web Audio: a sample pool for key down/up, rotor ratchet and lamp click, with volume and mute. Shared by both views.
- The message-procedure features live in the shared panels, so they work identically in 2D and 3D.

### Phase 7 — Mobile, performance, polish, launch

- Touch: tap keys, pinch/orbit the camera, long-press to drag cables. An on-screen keyboard fallback is always available.
- Performance budget: 60 fps on mid-range phones. Instanced keys and lamps, compressed textures (KTX2). Check the 2D initial bundle stays free of three.js.
- 2D touch targets: get keys and sockets toward 44px on phones, e.g. a landscape layout or a keyboard-focused mode.
- Final parity audit: the full e2e suite and axe scan pass in both views.
- Machine settings persisted to `localStorage` (a convenience only); the view choice is already remembered from Phase 3.
- Lighthouse and axe audits, then deploy.

---

## Open decisions (to settle when we reach them)

1. ~~3D assets~~: procedural for now (Phase 3); a Blender glTF model remains an option for later polish.
2. ~~Styling~~: decided — Tailwind v4.
3. ~~Hosting~~: decided — GitHub Pages.
4. Sound sources: record, synthesize, or CC0 samples (licensing).
5. How much historical narrative to write for this phase vs. later.
