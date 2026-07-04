# SCC App → Product: Go-to-Market & Productization Plan

_A plan to turn the Sangria Cricket Club app into a product other clubs can buy._

---

## 0. The honest starting point (what we have today)

The app is currently **single-tenant** — everything is wired for one club:

| Area | Today | Why it blocks selling |
|---|---|---|
| Club identity | Name, logo, colors hardcoded | Every club needs its own branding |
| Auth | Client-side only (`scc@2026` admin password, `scc` member PIN in source) | Not secure once data belongs to paying customers |
| Database | One Supabase project, no `club_id` on any table | Two clubs would see each other's data |
| Row Level Security | Public read/write policies | No data isolation between clubs |
| Payments | Razorpay keyed to SCC's account | Each club needs their own payout account |
| Integrations | CricHeroes team IDs hardcoded per feature | Must be per-club config |
| Hosting | One GitHub Pages instance | Fine for pilots, not for scale |

**Takeaway:** the app is a *fantastic product demo* but not yet a *multi-tenant SaaS*. The plan below deliberately sells first, re-architects second — so we learn what clubs actually pay for before doing the expensive rewrite.

---

## 1. Strategy: three phases, revenue before rewrite

### Phase 1 — "Concierge" managed deploys (0–5 clubs) · **start now**
Sell a **done-for-you** setup. For each club:
- Fork the repo, create a **separate Supabase project** (free tier covers a club easily).
- Swap logo, club name, colors, admin password, member PIN, Razorpay keys, CricHeroes IDs — all via a small `club.config.ts`.
- Deploy their own GitHub Pages / Netlify / Vercel site (or `<club>.yourdomain.com`).

**Pros:** zero re-architecture, ship this week, full data isolation for free (separate DBs), each club gets a "private" app.
**Cons:** manual (~2–3 hrs/club), you maintain N codebases. Fine up to ~10 clubs.
**Goal of this phase:** get 3–5 paying clubs, learn objections, prove willingness-to-pay.

> First move: extract every hardcoded club value into a single `src/config/club.config.ts`. This one refactor makes cloning a 20-minute job instead of a scavenger hunt, and is the foundation for Phase 3.

### Phase 2 — Self-serve onboarding, still per-club backends (5–20 clubs)
- Build a small **setup wizard**: club fills a form (name, logo upload, colors, contacts) → generates their config + provisions a Supabase project via the Management API.
- Central "control panel" you own: list of clubs, their status, billing.
- Still one DB per club (isolation stays trivial), but provisioning is automated.

### Phase 3 — True multi-tenant SaaS (20+ clubs) · **the real product**
Only invest here once Phase 1/2 proves demand.
- Add `club_id` (tenant id) to **every** table + composite indexes.
- Replace client-side auth with **Supabase Auth** (real accounts, roles: owner/admin/member/fan).
- **RLS policies scoped by `club_id`** — the database enforces isolation, not the client.
- Subdomain or path per club (`app.yourdomain.com/scc`).
- Self-serve signup, Stripe/Razorpay subscription billing, free trial.
- Per-club feature flags (some clubs want auction, some don't).

---

## 2. What makes this sellable (the pitch)

Position it against the alternative most clubs use today: **CricHeroes + WhatsApp + a spreadsheet.**

> "CricHeroes tracks your scores. We run your whole club — money, members, match-day, fan engagement — in one app with your club's name on it."

Differentiators already built (this is a genuinely deep feature set):
- 💰 **Club finances** — member wallets, match fees, expenses, monthly reports, online payments
- 📊 **Auto-synced stats** from CricHeroes → leaderboards, records, player profiles
- 🤖 **AI features** — chat over club data, Cricket DNA, Best XI selector, match reports
- 🎯 **Fan engagement** — predictions game, polls, reactions, comments, awards night, season wrapped
- 🏟️ **Ground/match booking** — external teams book & pay to play you
- 📱 **Squad polling, WhatsApp reminders, match posters, sponsor showcase**

That breadth is the moat — no single competitor does finances + stats + engagement + booking together.

---

## 3. Pricing (Indian amateur-cricket market — price sensitive)

Freemium, annual-first (clubs budget per season):

| Tier | Price (₹/year) | Who | Includes |
|---|---|---|---|
| **Free** | ₹0 | Trial / tiny clubs | Members, matches, calendar, basic stats, 1 admin |
| **Club** | ₹2,999 | Most clubs | + Finances, CricHeroes sync, leaderboards, records, polls, predictions, custom branding |
| **Pro** | ₹5,999 | Serious/large clubs | + AI features, ground booking + online payments, auction, annual report, priority support |
| **Setup add-on** | ₹1,500 one-time | Phase 1 clubs | Done-for-you setup + data import |

Levers: annual discount vs monthly, per-club flat pricing (NOT per-member — clubs hate that), founding-club lifetime discount for first 10, referral credit (1 month free per referred club).

**Unit economics check:** Supabase free tier + GitHub Pages ≈ ₹0 infra per club in Phase 1. Even at ₹2,999/club your margin is ~100% minus your time. 20 clubs = ₹60k–120k/year with near-zero infra cost.

---

## 4. Go-to-market (where the clubs are)

You already sit inside the target market — use it:

1. **CricHeroes ecosystem** — every serious amateur club is already on CricHeroes. That's your lead list. Tournaments, local leagues, city cricket groups.
2. **WhatsApp** — cricket club admin groups, "Pune cricket" style community groups. This is how amateur cricket actually organizes in India.
3. **Referrals from SCC** — teams you play (you literally have a `book-match` funnel of opponent clubs). Every opponent is a warm lead. Add a subtle "Powered by [Product]" footer + "Get this for your club" link.
4. **Local tournament organizers** — offer a free league/tournament module; they push it to participating clubs.
5. **Content** — post SCC's own dashboards/awards-night/wrapped graphics publicly; they're impressive and self-advertising.

**Sales motion for Phase 1:** direct outreach → 15-min demo (show SCC live) → offer ₹1,500 setup + first season Club tier. Personal, high-touch, learn fast.

---

## 5. Onboarding (make the first 24 hours magic)

The #1 reason club software dies: empty app, nobody enters data. Fix it:
- **Import from CricHeroes** on day one — pull their real players & match history so the app is *full of their data* immediately, not blank.
- CSV/WhatsApp-contact import for members.
- A 5-step setup checklist (logo → members → first match → invite members → done).
- Pre-load with sample data they can clear, so they see what "good" looks like.

---

## 6. The hard technical work, sequenced

Do these **in order**, and only as far as demand justifies:

1. **`club.config.ts` extraction** _(days)_ — every hardcoded club value in one file. Unlocks Phase 1. **← do this first regardless.**
2. **Move secrets out of client** _(days)_ — admin password & PIN must not be verifiable from source; move to Supabase Auth or at least a server check. Required before real customers.
3. **Provisioning automation** _(weeks)_ — script/wizard to spin up a club (Supabase Management API + deploy).
4. **Billing** _(weeks)_ — Razorpay/Stripe subscriptions + a licence check.
5. **Multi-tenancy** _(months)_ — `club_id` everywhere + Auth + RLS. The big one. Only after ~15–20 clubs.

Risk to manage: **data isolation.** In Phase 1/2 it's free (separate DBs). Do NOT attempt shared-DB multi-tenancy without RLS-by-tenant — a cross-club data leak would kill the product's reputation.

---

## 7. Legal / operational (don't skip)

- **Data & privacy** — you'll hold members' names, phones, payment info. Add a privacy policy + terms; be explicit about payment data (ideally never store card data — Razorpay handles it).
- **Payments** — each club's online payments must settle to *their* account (Razorpay Route / sub-merchant, or they bring their own keys). Don't route club money through your account.
- **Support** — even a WhatsApp support number + a help doc set expectations. Amateur clubs need hand-holding.
- **Backups** — per-club DB backups; clubs will panic about losing their finance records.

---

## 8. 90-day action plan

**Weeks 1–2**
- Extract `club.config.ts`; document the "clone a new club" runbook.
- Add "Powered by / Get this for your club" footer link on public pages.

**Weeks 3–6**
- Land **2–3 pilot clubs** (opponents you already play). Concierge setup. Charge the ₹1,500 setup fee — paid pilots tell you far more than free ones.
- Build the **CricHeroes import** onboarding (biggest wow-factor).

**Weeks 7–12**
- Collect feedback, fix the top 3 friction points.
- Move admin/member auth off the client (security must-fix before scaling).
- Decide from real signal: is demand strong enough to fund Phase 3 multi-tenancy?

**Success metric for the quarter:** 3 paying clubs, renewals verbally committed, a repeatable 20-minute setup. That's a validated product — then raise/build for scale.

---

## TL;DR
1. **Sell before you rebuild.** Concierge per-club deploys (separate Supabase project each) get you paying customers this month with zero re-architecture.
2. **First code task:** pull all club-specific values into one `club.config.ts`.
3. **Price flat per club, annual, ~₹3k–6k**, freemium, founding-club discount.
4. **Your leads are your opponents + CricHeroes + WhatsApp cricket groups.**
5. **Onboarding = import their CricHeroes data so the app is never empty.**
6. **Fix client-side auth before real customers; go true multi-tenant only after ~15–20 clubs prove demand.**
