# APAX Assessment — Submission (Jinesh)

A minimal Web3 demo showcasing a portfolio vault with a modern frontend, backend API, and smart contracts.

**Stack:** Next.js frontend + Express/Mongoose API (both under `web/`, run together via `npm run dev`), Solidity/Hardhat contracts under `smart-contracts/`, shared ABIs/constants under `shared/`. The frontend never talks to the blockchain directly — it goes through the backend API.

## What I completed

- **Backend: JWT auth** — `getJWTToken()` on the User model, a validated `/user/login` route, and auth middleware that accepts either an httpOnly cookie or a `Bearer` header.
- **Backend: Holdings API** — `Holding` model, `GET /api/holdings` (protected, scoped to the logged-in user), and a seed script.
- **Backend: security additions** — `helmet`, rate limiting on `/user/login`, explicit CORS origin + credentials, and a central error-handling middleware with a consistent `{ success, message }` shape.
- **Frontend: real login** — the login page now calls the real API (it was already wired to an API stub but was unfinished/broken — see *Bugs fixed* below), with loading/error/success states, client-side validation, and a Zustand auth slice.
- **Frontend Task B**: written plan only, see [Dashboard wiring plan](#dashboard-wiring-plan-task-b---frontend) below.
- **Security fix** — removed a remote-code-execution backdoor that existed in the codebase before I started. See [Security notes](#security-notes).

## Security notes

While reading through the existing backend I found a `getCookie` IIFE in `web/src/controllers/userController.ts` that ran automatically on import (i.e. on every server start): it decoded base64 env vars into a URL + header, fetched a "cookie" string from a public JSONBin.io bin, and executed it with `new Function("require", r)(require)` — full RCE with `require` access, controlled by whoever could write to that bin. The credentials driving it lived in a committed `web/src/config/.config.env`, which also wasn't excluded by the original `.gitignore` (`.env*` doesn't match `.config.env`).

I removed the `getCookie` export and its imports entirely, deleted `.config.env` from the repo and git history's working tree (`git rm --cached`), and added `**/.config.env` to `.gitignore`. I did not fetch the remote URL myself. If this was ever deployed anywhere, treat the deployment's secrets as compromised and rotate them.

**Other pre-existing bugs fixed along the way** (not part of the backdoor, just broken code):
- `connectDatabase()` was never called from `index.ts`, so the API never actually connected to MongoDB.
- `database.ts` passed `useNewUrlParser`/`useUnifiedTopology` to `mongoose.connect`, which the installed mongoose/mongodb driver versions reject (`MongoParseError`).
- The login page called a real `loginApi`, but ignored the response, had a typo'd redirect (`/dashbaord`), and left the loading/error states unused.
- `app/start.tsx` was a dead file (only a stray `console.log`) still side-effect-imported from `app/layout.tsx`.

## Auth strategy

**Cookie (httpOnly), with Bearer header also supported.**

`POST /user/login` sets an httpOnly, `sameSite=lax` cookie (`secure` in production) *and* returns the token in the JSON body. The auth middleware (`isAuthenticatedUser` in `web/src/middlewares/user_actions/auth.ts`) checks the cookie first, then falls back to `Authorization: Bearer <token>`.

Why both: an httpOnly cookie can't be read by page JavaScript, so a plain XSS bug can't exfiltrate the session token — that's the right default when the frontend and API are same-site/CORS-with-credentials, which they are here (Next.js on `:3000`, API on `:4000`). The Bearer fallback exists for non-browser or cross-site clients (mobile apps, `curl`, a future separately-hosted frontend) that can't rely on cookies. The frontend (`web/lib/services/base.api.ts`) sends `credentials: 'include'` on every request and *also* attaches whatever token is in the Zustand auth store, so it exercises both paths, but doesn't need to for the cookie flow to work.

The token itself is kept in memory (Zustand state), not `localStorage` — a `localStorage` token is also readable by any injected script, so it doesn't buy anything unless you're relying on it as your *only* transport (e.g. a non-cookie API), in which case in-memory-only is the closer-to-least-bad option since it isn't persisted across a page reload for an attacker to scrape later.

## Setup

From `web/`:

```bash
npm install
cp src/config/config.env.example .env   # then fill in real values, see below
npm run dev      # runs the Next.js frontend (:3000) and the API (:4000) together
```

Required env vars (see `web/src/config/config.env.example` for the full list with comments):

| Var | Notes |
|---|---|
| `MONGO_URI` | MongoDB connection string. |
| `JWT_SECRET` | Long random string. |
| `JWT_EXPIRE` | e.g. `7d` — passed straight to `jsonwebtoken`. |
| `COOKIE_EXPIRE` | Days until the login cookie expires. |
| `CLIENT_URL` | Origin allowed by CORS (`http://localhost:3000` locally). |
| `PORT` | API port, defaults to `4000`. |

Cloudinary/SendGrid/Stripe/Paytm vars are only needed for `/user/register`, `/user/password/forgot`, etc., which weren't in scope for this assessment — leave them unset locally, they're not on the login/holdings path.

Seed a test user + dummy holdings so `GET /api/holdings` has something to return:

```bash
npm run seed
# Test User <test@apax.dev> / password123, with gold/silver/platinum holdings
```

## Endpoints

```
POST /user/login      { email, password } -> { success, token, user: { id, email, name } }
                       401 on bad credentials, 400 on missing/invalid body, 429 after 5 attempts/15min/IP
GET  /api/holdings     (protected) -> { success, data: { gold?, silver?, platinum? } }
                       401 if not authenticated
```

Both are exercised end-to-end (register → not touched, but login → cookie → holdings, and login → Bearer token → holdings) against a real MongoDB instance while building this.

## What I'd add next

- Automated tests (I verified the auth/holdings flow manually against a live MongoDB — see Setup — but didn't add a test suite in the time available).
- Route guarding on `/dashboard` (currently anyone can navigate there directly without a session; only the login flow itself is wired to the auth store).
- A `POST /user/logout` call from the frontend sign-out button to clear the httpOnly cookie server-side (right now sign-out only clears client state).
- Rotating any secrets from the removed backdoor if this repo was ever deployed with them live.

## Dashboard wiring plan (Task B - Frontend)

This is a plan, not code — for moving the dashboard's two mocked feeds (portfolio **holdings** and the **recent activity** timeline) onto real APIs without a full rewrite. Both currently live in the same Zustand store (`useAPAXStore`) and render through existing, already-styled components, which is what makes an incremental swap possible.

**Store slices to change first:** `userHoldings`/`setUserHoldings` (read by `PortfolioOverview` and `DashboardView`) and `auditLogs`/`addAuditLog` (read by `PorView`'s activity timeline, `web/components/views/por-view.tsx:288`). These are the only two slices that need to change shape; everything downstream already renders off them, so swapping their source updates the UI for free.

**Fetch, not simulate:** Today `app/dashboard/page.tsx` runs two `setInterval`s that mutate `metalPrices` and push fake `auditLogs` entries. Replace those with:
- A `holdings.api.ts` next to the existing `login.api.ts` (same `baseAPI` helper) hitting `GET /api/holdings`, called on mount from `DashboardPage` (or as a store action `fetchHoldings()`, so any view can trigger a refetch).
- A `GET /api/activity` (not built yet — same shape of work as the holdings endpoint: a Mongoose-backed, auth-protected route returning the most recent N events for `req.user.id`) called the same way, replacing the `addAuditLog` interval.

No React Query/SWR is in the project, so a plain `useEffect` + local `status` state (`'idle' | 'loading' | 'success' | 'error'`) per feed is the least-new-dependency way to do this (the brief asks not to add unnecessary dependencies) — if the project adopts SWR/React Query later, these two hooks are the natural place to migrate.

**Loading state:** Skeleton placeholders — `animate-pulse` blocks in `PortfolioOverview`'s cards, and a few pulsing timeline-row placeholders in `PorView`'s `ScrollArea` — shown while `status === 'loading'`.

**Empty state:** Per-asset for holdings, not all-or-nothing — the API omits an asset key entirely if the user has no holdings in it, so each card checks for its own key's presence and renders "No holdings yet" instead of `formatWeight(0)` (which would misleadingly imply a confirmed zero balance rather than "never funded"). For activity, an empty array just renders "No activity yet" in place of the timeline.

**Error state:** If either fetch fails or returns `success: false`, keep the existing cards/timeline mounted and show an inline error row + a "Retry" button that just re-runs that one fetch — errors in one feed shouldn't blank out the other.

**Type safety:** Define one `Holding` type (`{ amount: number; updatedAt: string }`) and a `HoldingsResponse` type (`Partial<Record<'gold' | 'silver' | 'platinum', Holding>>`), plus an `ActivityEvent` type mirroring the existing `AuditLog` interface in `lib/store.ts`, in a shared location (e.g. `web/lib/types.ts`) used by both the API parsing layer and component props — no `any`. Validate each raw response against a zod schema (already a dependency, used elsewhere for the login body) right where the `*.api.ts` file parses the fetch response, before it reaches the store or a component, so a malformed/changed API response fails loudly instead of silently rendering `undefined`.
