# Design Specification — Smart Scan EW Dashboard

**Project:** SIH26055 — Smart Scan Strategy for Electronic Warfare
**Purpose of this document:** design language and UI specification for the site that visualizes the scan dataset (frequency-band transmission/non-transmission truth data, receiver scheduling decisions, and interception performance metrics). This is the contract the frontend should follow — not a suggestion.

---

## 0. Non-negotiables

- **No emoji anywhere** — not in headings, buttons, empty states, tooltips, console logs shown in UI, nothing. Use text labels, icons (line-icon set, see §4), or status dots instead.
- **No purple, cyan, lime, magenta, or other "punchy"/neon colors.** No default Tailwind `indigo-500`, `violet-500`, `fuchsia-500`, `teal-400` type choices. No default `blue-600` + `purple-600` gradient — this is the single most obvious tell of an unstyled AI-generated app and must be avoided entirely.
- No default shadcn/Tailwind look with rounded-2xl cards floating on white with soft pastel shadows. This project visualizes a defense-relevant scanning system — it should read as an **instrument panel**, not a SaaS landing page.
- No stock hero section, no gradient text, no glassmorphism blur cards, no generic "dashboard with 4 KPI cards + line chart" template layout without deliberate reasoning behind it.

---

## 1. Concept & Design Direction

Think of the interface as an **electronic warfare operator's console** — closer in spirit to a spectrum analyzer, an ATC radar scope, or a SIGINT waterfall display than a business dashboard. The subject matter is: a receiver sweeping a frequency spectrum, emitters transmitting or staying silent in bands over time, and a scheduler deciding where to look next. The UI should visually reinforce that mental model — bands as rows, time as a horizontal axis, transmissions as marks that appear and fade, the receiver's current focus as a highlighted region moving across the spectrum.

**Design reference points** (for tone, not for copying): military/aerospace instrumentation displays, oscilloscope and spectrum-analyzer UIs, air-traffic control radar scopes, submarine sonar waterfall displays, Bloomberg Terminal-style dense data panels. Dense, precise, monospaced-numerals, low chroma, high information density, restrained motion.

**What this is not:** a marketing site, a consumer analytics dashboard, a "Web3 startup" landing page.

---

## 2. Color System

### 2.1 Palette philosophy
Low-saturation, near-monochrome base (a graphite/ink dark theme by default) with **exactly one accent hue family** used sparingly for emphasis, plus a small, deliberate semantic set for detection states. Everything else stays desaturated grays. Color should mean something (hit vs miss vs idle vs active-band) — it should never be decorative.

### 2.2 Base surface (dark mode, default)
| Token | Hex | Use |
|---|---|---|
| `--bg-canvas` | `#0B0D0F` | App background |
| `--bg-panel` | `#12151A` | Panel / card background |
| `--bg-panel-raised` | `#181C22` | Elevated panel (modals, active panel) |
| `--bg-inset` | `#0E1013` | Recessed areas — chart plot background, input fields |
| `--border-subtle` | `#22262D` | Default hairline borders |
| `--border-strong` | `#343A42` | Emphasized borders, active panel outline |
| `--text-primary` | `#E8EAED` | Primary text |
| `--text-secondary` | `#9BA3AD` | Secondary / label text |
| `--text-tertiary` | `#5C636D` | Disabled, timestamps, footnotes |

### 2.3 Accent — signal amber
Use a restrained **amber/phosphor-amber** as the single accent, evoking radar-scope and analog-instrument displays. This is the only hue allowed to feel "bright."

| Token | Hex | Use |
|---|---|---|
| `--accent` | `#D98E33` | Primary accent — active selections, focused band, primary buttons |
| `--accent-dim` | `#8A5E24` | Accent at rest / secondary emphasis |
| `--accent-glow` | `#D98E33` at 12–18% opacity | Subtle glow behind the active sweep marker only |

(If amber feels too close to a "warning" color for your taste, the acceptable substitute is a **desaturated signal-green phosphor**, `#4E8C5C` primary / `#2E5638` dim — CRT-radar green, not lime. Pick one accent family and use it consistently; do not mix both.)

### 2.4 Semantic states (data meaning, not decoration)
| State | Color | Notes |
|---|---|---|
| Transmission / hit (detected) | `#C4523B` (muted brick red) | Used for "emitter transmitting" or "successful intercept" marks |
| Non-transmission / miss | `#3A3F46` (neutral gray) | Silence in a band — should recede, not draw the eye |
| Correct prediction | `#5E8C6A` (muted moss green) | Model predicted correctly |
| False alarm | `#B8763E` (burnt ochre) | Distinguish clearly from transmission-red and accent-amber by desaturating it further |
| Threat-priority emitter | `#A13A34` (deeper red, slightly darker than hit-red) | Reserve for flags on high-priority/threatening emitters specifically |
| Currently scanned band | `--accent` outline, no fill | The receiver's live focus — outline only, never a filled block, so it doesn't compete with data marks |

Do not invent additional bright hues for more states. If you need a 6th or 7th category, differentiate with **texture/pattern** (dashed outline, dot fill, diagonal hatch) or label text, not a new color.

### 2.5 Light mode (if built)
Do not just invert the dark palette. Use a warm paper-gray base (`#F3F1EC`, not pure white), ink-navy text (`#1B1F24`, not pure black), and keep the same amber accent at a slightly deepened value (`#B06B1E`) for sufficient contrast. Semantic colors stay the same family, deepened ~10% for contrast on light background.

### 2.6 What to avoid explicitly
No purple/violet, no cyan/turquoise, no lime/chartreuse, no magenta/fuchsia, no saturated "electric blue," no rainbow-gradient charts, no neon glow effects beyond the single restrained accent-glow defined above.

---

## 3. Typography

- **UI text / labels / body:** a grounded grotesk, not the default AI-app choice of Inter-with-nothing-else. Use **IBM Plex Sans** or **Space Grotesk** for headings and **IBM Plex Sans** for body — both have a technical/engineering character without looking like a startup font.
- **Numeric data / metrics / timestamps / frequency values:** a **tabular monospace** is mandatory anywhere numbers change or need to align in columns — **IBM Plex Mono** or **JetBrains Mono**. Frequencies, probabilities, timestamps, band IDs, and all metric readouts (Pd, Pfa, intercept rate, reward) must use the monospace with `font-variant-numeric: tabular-nums`.
- **Type scale:** keep it compact and utilitarian — this is a dense instrument panel, not an editorial site. Suggested scale: 11 / 12 / 13 / 15 / 18 / 24 / 32px. Avoid large decorative display type; the biggest text on screen should be a live metric readout, not a marketing headline.
- **Letter-spacing:** slightly increased tracking (2–4%) on all-caps section labels (e.g. "ACTIVE BANDS", "SCHEDULER STATUS") to reinforce the instrument-panel feel. Do not apply this to body copy or numbers.
- No script fonts, no rounded/friendly display fonts (Poppins, Quicksand, etc.) anywhere in this project.

---

## 4. Iconography & Imagery

- Use a **single consistent line-icon set** (Lucide or Phosphor, regular/thin weight) at small sizes (16–20px). Icons are functional markers (play/pause scan, alert, band-lock, export), never decorative illustrations.
- **No emoji, no cartoon illustrations, no stock photography, no abstract 3D blobs/gradients** as hero art. If the landing/overview screen needs visual interest, use an actual live or representative rendering of the spectrum waterfall itself — the real data is more compelling and on-brand than any illustration would be.
- Status should be communicated with small solid dots / short bars / outline changes, not icons-as-emoji-substitutes (i.e. don't reach for a checkmark-in-circle icon to replace what would've been a ✅).

---

## 5. Layout & Grid

- **Base unit:** 8px spacing grid throughout. No arbitrary padding values.
- **Primary layout:** a fixed-height console shell — top status bar (system state, current mode: live/replay/training), a left rail for band/emitter selection and filters, a large central panel for the spectrum/waterfall visualization, and a right or bottom panel for metrics (Pd, Pfa, avg intercept time, reward, correct-prediction %). Avoid an infinitely-scrolling marketing-style single column; this is a panel-based operational layout, closer to a cockpit than a webpage.
- **Density:** favor a data-dense layout over generous whitespace. Reduce default card padding compared to a typical SaaS dashboard (12–16px internal panel padding, not 32px+). This is a tool for someone monitoring a scan in near-real-time, not a leisurely read.
- **Panels, not cards-with-shadows:** use flat panels distinguished by a 1px `--border-subtle` hairline and a subtle background-value shift (`--bg-panel` vs `--bg-canvas`), not drop shadows. Shadows read as "consumer app"; hairline borders read as "instrument panel."
- **Grid for the spectrum view specifically:** frequency bands as rows (or columns, whichever matches the dataset's natural indexing), time as the other axis, forming a heatmap/waterfall grid. This is the centerpiece visualization and deserves the most screen real estate — don't shrink it to fit a generic 3-column KPI-card template.

---

## 6. Core Visualization Components

### 6.1 Spectrum waterfall / band-activity grid (primary view)
- Rows = frequency bands, X-axis = time (scrolling or scrollable). Each cell shaded by transmission state using the semantic colors in §2.4.
- The receiver's currently-scanned band gets an accent-colored outline/marker that moves across the grid live (or steps through, in replay mode) — this is the single most important interactive/animated element on the site and should be built first.
- Include a compact legend using swatches + text labels (never emoji, never color-only without a label — colorblind accessibility matters here).

### 6.2 Metrics readout panel
- Present Pd (probability of detection), Pfa (false alarm rate), average intercept time, average reward/cost, and correct-prediction % as **monospace numeric readouts** with small sparkline trends beside each, not large decorative KPI cards. Think avionics readout, not a marketing stat block.

### 6.3 Scheduler/model decision log
- A scrolling, timestamped log (monospace) of scheduler decisions — which band it chose to scan next and why (predicted reward, confidence) — styled like a terminal/console log, reinforcing the instrument-panel identity.

### 6.4 Charts (trend lines, ROC-style curves, training curves)
- Use thin (1–1.5px) lines, muted gridlines (`--border-subtle` at low opacity), and the semantic/accent palette only. No default chart-library rainbow palettes. Axis labels and ticks in monospace.

---

## 7. Motion

- Motion should feel like instrumentation, not UI flourish: linear/stepped transitions for the scanning marker, no springy bounce easing, no fade-and-slide-up card entrances borrowed from marketing sites.
- Live-updating elements (waterfall scroll, metric ticks) should use short, consistent-duration transitions (150–250ms, ease-linear or ease-out) so the interface reads as continuously live rather than "animated for effect."
- Reserve the accent-glow (§2.3) for the single active-scan marker only — do not apply glow effects broadly.

---

## 8. Voice & Microcopy

- Precise, technical, terse. "Band 14 — no transmission detected" not "All quiet here! Nothing to see." No exclamation marks, no encouraging/cheerful copy, no emoji (again — because it's the easiest thing to slip back into by default).
- Empty/loading states described plainly: "Awaiting scan data" / "No emitter activity in this band" rather than playful placeholder copy.

---

## 9. Accessibility notes

- Every semantic color in §2.4 must be distinguishable without color alone (pair with icon shape, label, or pattern) since red/green transmission-state distinctions are exactly the kind of thing colorblind users get tripped up by.
- Maintain WCAG AA contrast for all text against its panel background — verify `--text-secondary` (`#9BA3AD`) against `--bg-panel` (`#12151A`) specifically, as gray-on-dark-gray is the most common contrast failure in this kind of theme.

---

## 10. Summary checklist before shipping any screen

- [ ] No emoji anywhere in UI copy, tooltips, or placeholder text
- [ ] No purple, cyan, lime, magenta, or neon/punchy hues used
- [ ] Dark, low-chroma instrument-panel base with a single restrained accent
- [ ] Monospace used for all numeric/data readouts
- [ ] Flat hairline-bordered panels, not shadowed cards
- [ ] Spectrum/waterfall visualization is the largest, most prominent element on the primary screen
- [ ] Semantic states differentiated by more than color alone
- [ ] No default gradient-text hero, no stock illustration, no generic 3-column KPI template