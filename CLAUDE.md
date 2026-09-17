# CLAUDE.md — Why I Quit Drinking

> **Read [Operating Protocol](#operating-protocol) before any work.**
> This site auto-deploys to production on every push to `main`. Skipping the
> protocol causes the same incidents it caused on BRL_web/vision-board/the Lab:
> stale local main, direct-to-main commits, doc drift.

## Operating Protocol

### Session start

1. `git fetch origin && git status -sb` — pull if local `main` is behind.
2. Confirm the Cloudflare Pages project name once it exists (`npx wrangler pages project list`).
3. Forge project: `why-i-quit-drinking`, prefix `WIQD`. Check the open session before creating a new one.

### Pull Request Workflow — required

**Never push directly to `main`.** A local `pre-push` hook (installed from the
canonical copy at `../hooks/pre-push` via `../bin/install-git-hooks.sh`)
blocks it. Override only via `BRL_ALLOW_MAIN_PUSH=1 git push ...` in a genuine
emergency.

1. Feature/session branch: `git checkout -b claude/<short-name>` from up-to-date `main`.
2. Commit on the branch — explicit paths, never `git add -A`.
3. Push the branch — Cloudflare Pages auto-generates a preview deploy once Pages is connected.
4. `gh pr create --base main` — include the preview URL.
5. Greg reviews and merges. Cloudflare Pages rebuilds `main` and deploys to production.

## Project Identity

**Why I Quit Drinking** (whyiquitdrinking.com) is a content/audience property whose
job is to attract a large organic audience around quitting or questioning
drinking, and convert that audience into installs of the **Sober Motivation**
app (sobermotivation.net). It is a joint venture between Greg Falconer and
Brad McLeod (same partnership structure as SM), tracked in the Lab as its own
Forge project (`why-i-quit-drinking` / `WIQD`) — not folded into SM's backlog.
The property may itself be sold once it's built out and loaded with content;
treat it as a real, standalone asset, not a throwaway funnel page.

**Why this exists (from research, see the Design System doc for full detail):**
Facebook groups in this category top out around 60K members — the real reach
lives in daily-use tools (I Am Sober 16M+ downloads, Reframe 5M+). A content
site alone doesn't compete; a content site that is the front door to a daily
habit does. Every page here should either be someone's "why," or a low-friction
path into the app.

**Attribution matters.** The whole point of driving traffic here is measurable
app growth. Any "Get the app" link needs to survive the hop to the App/Play
Store with the source attached — see `TODO(WIQD)` in `src/pages/Home.tsx` and
[[WIQD-1 in Forge]] (also flagged as a gap on the `sober-motivation` Forge
board: no confirmed AppsFlyer OneLink template exists yet for organic/owned
traffic). Don't wire a raw App Store link into new content pages without
checking whether OneLink has shipped.

## Stack

**What:** Vite + React 19 + TypeScript + Tailwind CSS v4 + React Router v7 (BrowserRouter)
**Entry:** `src/main.tsx` → `src/App.tsx` → routed pages in `src/pages/`
**Styles:** `src/index.css` — Tailwind v4 `@theme` tokens, sourced from the
"Why I Quit Drinking" Design System artifact (colors, type scale, radius).
Spacing intentionally rides Tailwind's default 4px scale — the design
system's 8px-based tokens (space-2/4/6/8) already line up with it 1:1.
**Fonts:** Google Fonts — Fraunces (serif, headlines/pull-quotes only, never below 24px) + Inter (sans, everything else)
**Path alias:** `@` → `src`
**Build:** `npm run dev` (port 5051), `npm run build` (→ `/dist`), `npm run preview`

## Brand Design System

Foundations-only v1 (color + type + spacing + radius; no components, no logo,
no dark theme yet — see the Design System artifact's README for the full
rationale and voice guide). Key rules pulled from it:

- **Voice:** first person, present tense, specific ("day 47," not "you may be experiencing..."). No shame, no urgency, no exclamation points. Never use the `alert` color near a description of drinking or slipping — a slip is not an error state.
- **Color:** warm/terracotta-and-sage, deliberately not blue (avoids reading as "one more meditation app"). `brand` = primary action/CTA. `growth` = actual progress only (streaks, milestones) — not decoration. `trust` grounds nav/footer.
- **Type:** Fraunces (serif) for `display`/`h1`/`h2` only; Inter (sans, tabular figures) for everything else including streak/dollar counters.
- **Imagery:** none sourced yet. When shooting/sourcing: real people, morning light, ordinary moments. Skip the category's two clichés (a poured-out glass, someone drinking alone in the dark).

Tokens live in `src/index.css` under `@theme`. Utility classes: `bg-surface`,
`text-ink`, `bg-brand`, `text-on-brand`, `bg-growth-soft`, `font-serif`,
`text-display`, etc. No hardcoded hex in components.

## What NOT to Do

- Do not add a CMS, database, or backend without instruction — this is a static Pages site.
- Do not wire a bare App Store/Play Store link into a CTA without checking the OneLink/attribution status first (see above).
- Do not hardcode colors — use the `@theme` tokens.
- Do not invent testimonials or "someone's why" stories and present them as real. Placeholder copy should read as obviously provisional or be pulled from the Design System's own documented samples, never fabricated and attributed to a real person.
- Mobile responsive required.

## Deploy

Repo: `github.com/buttonrocklabs/whyiquitdrinking-web` (public). Cloudflare
Pages connection is a one-time dashboard step (Workers & Pages → Create →
Connect to Git — this has no CLI/API equivalent) — not yet done as of this
file's writing. See the session handoff notes / Forge item WIQD-1.

- **Build command:** `npm run build`
- **Output directory:** `dist`
- **Production branch:** `main`
- Custom domain (whyiquitdrinking.com) gets added in Cloudflare Pages once the project exists, then DNS at the registrar gets pointed at Cloudflare (same pattern as cozycrates.org — see `cozycrates-website/CLAUDE.md` for the exact DNS-cutover steps if needed).

## Open Work

Tracked in the Forge under project `why-i-quit-drinking` (prefix `WIQD`).
