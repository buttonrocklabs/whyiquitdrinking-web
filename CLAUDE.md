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

**Why I Quit Drinking** (whyiquitdrinking.com) is a user-generated-content
property: visitors submit their own "why I quit" story (text + optional
photo), a moderator approves or rejects it, and approved stories populate a
public storyboard on the homepage. It is a joint venture between Greg
Falconer and Brad McLeod (same partnership structure as SM), tracked in the
Lab as its own Forge project (`why-i-quit-drinking` / `WIQD`) — not folded
into SM's backlog. The property may itself be sold once it's built out and
loaded with content; treat it as a real, standalone asset, not a throwaway
funnel page.

**Where this came from:** Brad's 09-16-26 check-in with Greg specified this
directly: a place for people to submit stories and pictures, a moderation
pass to screen out anything inappropriate, and a big storyboard of the
approved ones. Brad wants the site NOT branded as or attached to Sober
Motivation for v1 — it stands on its own.

**SM traffic is secondary, not the hero.** Greg wants a path to Sober
Motivation preserved regardless. That's a small, clearly-secondary link in
the footer (`src/components/Footer.tsx`), UTM-tagged
(`utm_source=whyiquitdrinking&utm_medium=referral&utm_campaign=footer`)
pointing at sobermotivation.net, which already captures UTM/acquisition
source on registration. Don't promote it to a hero CTA or add a bare App
Store link without checking with Greg first — that would contradict Brad's
framing.

**Architecture decisions locked (2026-09-17, Greg):**
- **Standalone D1 + R2**, not the shared `brl-platform` used by other BRL
  apps — this property may be sold on its own later, so its data shouldn't
  be entangled with the Lab's.
- **Moderator access is a single shared passphrase**, gated on `/review`
  (Pages Function checks `Authorization: Bearer <passphrase>` against the
  `REVIEW_PASSPHRASE` secret). No Clerk accounts for Brad/JB/Shelby in v1.

## Stack

**What:** Vite + React 19 + TypeScript + Tailwind CSS v4 + React Router v7
(BrowserRouter), Cloudflare Pages Functions backend, D1 + R2 storage.
**Entry:** `src/main.tsx` → `src/App.tsx` → routed pages in `src/pages/`
(`Home` storyboard, `Share` submission form, `Review` moderation queue).
**Backend:** `functions/api/stories.ts` (GET approved list, POST submit),
`functions/api/review/pending.ts` + `functions/api/review/[id].ts`
(passphrase-gated moderation), `functions/media/[[path]].ts` (serves R2
photos). Shared types/helpers in `functions/_lib.ts`.
**Data:** D1 database `whyiquitdrinking` (`schema.sql` — single `stories`
table, status `pending`/`approved`/`rejected`), R2 bucket
`whyiquitdrinking-media` for photos. Bound in `wrangler.jsonc`.
**Styles:** `src/index.css` — Tailwind v4 `@theme` tokens, sourced from the
"Why I Quit Drinking" Design System artifact (colors, type scale, radius).
Spacing intentionally rides Tailwind's default 4px scale — the design
system's 8px-based tokens (space-2/4/6/8) already line up with it 1:1.
**Fonts:** Google Fonts — Fraunces (serif, headlines/pull-quotes only, never below 24px) + Inter (sans, everything else)
**Path alias:** `@` → `src`
**Build:** `npm run dev` (Vite only, port 5051), `npm run dev:worker`
(`wrangler pages dev --proxy 5051` — full stack with D1/R2/secrets, port
8788; needed to exercise `functions/`), `npm run build` (`tsc -b` covers both
`src/` and `functions/`, then `vite build` → `/dist`), `npm run preview`.
**Local secrets:** `.dev.vars` holds `REVIEW_PASSPHRASE` for `dev:worker`
(gitignored, never commit it). Seed the local D1 emulation once with
`npx wrangler d1 execute whyiquitdrinking --local --file=schema.sql`.

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

- Do not promote the Sober Motivation link beyond a small, secondary footer mention — Brad's v1 is explicitly not SM-branded.
- Do not wire a bare App Store/Play Store link into a CTA — SM traffic here goes through the footer link to sobermotivation.net (which already captures UTM), not a raw store link.
- Do not add Clerk or any per-moderator account system for `/review` without instruction — the shared-passphrase gate is the deliberate v1 choice.
- Do not fold this project's D1/R2 into the shared `brl-platform` — it's standalone on purpose (possible future resale).
- Do not hardcode colors — use the `@theme` tokens.
- Do not invent testimonials or "someone's why" stories and present them as real. Seed/placeholder content must be obviously provisional, never fabricated and attributed to a real person.
- Mobile responsive required.

## Deploy

Repo: `github.com/buttonrocklabs/whyiquitdrinking-web` (public). Cloudflare
Pages connection is a one-time dashboard step (Workers & Pages → Create →
Connect to Git — this has no CLI/API equivalent) — not yet done as of this
file's writing. See the session handoff notes / Forge item WIQD-1.

- **Build command:** `npm run build`
- **Output directory:** `dist`
- **Production branch:** `main`
- **D1 + R2 bindings** are already declared in `wrangler.jsonc` (database
  `whyiquitdrinking`, bucket `whyiquitdrinking-media`) — Cloudflare picks
  them up once the Pages project exists.
- **`REVIEW_PASSPHRASE` secret** still needs to be set on the live Pages
  project once it exists: `npx wrangler pages secret put REVIEW_PASSPHRASE --project-name=whyiquitdrinking-web`.
- Custom domain (whyiquitdrinking.com) gets added in Cloudflare Pages once the project exists, then DNS at the registrar gets pointed at Cloudflare (same pattern as cozycrates.org — see `cozycrates-website/CLAUDE.md` for the exact DNS-cutover steps if needed).

## Open Work

Tracked in the Forge under project `why-i-quit-drinking` (prefix `WIQD`).
