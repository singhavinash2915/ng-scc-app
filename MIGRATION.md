# Moving SCC to a new Supabase project

Why: the organisation went past its Free-plan egress quota, the grace period
ended, and every API call now returns `402 exceed_egress_quota`. Supabase have
confirmed the usage cannot be cleared retroactively — pausing or deleting a
project stops new traffic but does not remove what has already been spent. The
meter resets on 1 October; the season opener is on 15 September. A new project in
a new organisation starts with a fresh meter, which is the only free way to be
running before then.

Data volume is about 6 MB, so the move itself is small. The work is in the parts
that reach outside Supabase.

---

## Before starting

- [ ] New Supabase account (a different email — a second org on the same account
      may not be allowed on the free plan)
- [ ] New organisation, new project, region **ap-south-1** to match the current one
- [ ] Note the new project ref, anon key, service-role key and database password
- [ ] **Do not** put VitalSync in this organisation. Keeping them apart is the
      whole point; sharing one free quota is what caused this.

---

## 1. Get the data out of the old project

The 402 is enforced at the API gateway, so a direct Postgres connection should
still work. Establish that first — everything else depends on it.

```bash
supabase login
supabase link --project-ref nptvrfqonfmafvbzjrih     # asks for the DB password
supabase db dump -f /tmp/scc_schema.sql              # schema
supabase db dump -f /tmp/scc_data.sql --data-only    # data
```

If those fail as well, fall back to Dashboard → Database → Backups → download.

## 2. Load it into the new project

```bash
supabase link --project-ref <NEW_REF>
psql "<NEW_DB_URL>" -f /tmp/scc_schema.sql
psql "<NEW_DB_URL>" -f /tmp/scc_data.sql
```

Then confirm the row counts match: members 48, matches 220, transactions 1134,
match_scorecards 189, ground_bookings 98.

## 3. Edge functions — seven of them

```bash
supabase functions deploy ai-insights cricheroes send-push \
  create-razorpay-order verify-razorpay-payment razorpay-webhook \
  validate-payment-screenshot
```

Then set the eleven secrets they read:

| Secret | Where it comes from |
|---|---|
| `ANTHROPIC_API_KEY` | existing value — reuse |
| `CH_AUTH` | existing value — reuse |
| `RAZORPAY_KEY_ID` / `_SECRET` / `_WEBHOOK_SECRET` | Razorpay dashboard |
| `VAPID_PUBLIC_KEY` / `_PRIVATE_KEY` / `_SUBJECT` | **reuse the existing keys** |
| `SUPABASE_URL` / `_ANON_KEY` / `_SERVICE_ROLE_KEY` | new project |

Reusing the VAPID pair matters: generate new ones and every push subscription
members already granted stops working, silently.

## 4. Storage

Three buckets — `avatars`, `match-photos`, `sponsors` — currently holding five
objects between them. Recreate the buckets with the same names and public
settings, then re-upload.

## 5. Point the app at the new project

```bash
./scripts/switch_supabase_project.sh <NEW_REF> <NEW_ANON_KEY> --dry-run
./scripts/switch_supabase_project.sh <NEW_REF> <NEW_ANON_KEY>
npm run build
```

That rewrites all sixteen tracked files — client, AI hook, the service-worker
cache rules in vite.config.ts, and the thirteen sync scripts. `git diff` shows
everything; `git checkout .` undoes it.

## 6. Outside Supabase — the parts that bite

- [ ] **Razorpay webhook URL** → repoint to the new project's
      `/functions/v1/razorpay-webhook`. Miss this and member payments stop being
      recorded, with no error anywhere.
- [ ] **GitHub Actions secrets**, if any reference the project
- [ ] **launchd sync job** — `~/.scc-sync` is mirrored from `scripts/` by the
      post-commit hook, so committing the switch updates it
- [ ] **Android and iOS builds** carry the old URL in their bundled assets and
      need rebuilding and re-releasing

## 7. Verify before telling anyone

- [ ] `curl` the new REST endpoint — expect 200, not 402
- [ ] Dashboard loads with the right totals
- [ ] A member profile opens
- [ ] Live scoring page loads the 15 Sept fixture with both squads
- [ ] Season Fund reads ₹4,07,000 paid, ₹77,000 owed
- [ ] Run one sync script and confirm it writes to the new project

## Keeping it from happening again

The two egress fixes already shipped: the scorecard fetch no longer includes the
`raw` column (821 KB → 369 KB gzipped) and the cache now survives app relaunches,
so a reopen costs about 200 bytes instead of a full download. Those alone should
keep a 40-member club well inside 5 GB a month.

Still worth doing afterwards: drop the `raw` column server-side
(`supabase/migrations/drop_scorecard_raw_column.sql`), and watch the usage page
weekly for the first month rather than discovering the next breach through a 402.
