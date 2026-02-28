# CLAUDE.md

This file provides comprehensive guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Sangria Cricket Club (SCC) Management App** - A full-featured React TypeScript web application for managing a cricket club's members, matches, finances, tournaments, squad polling, sponsorship, and more. Uses Supabase as the backend (PostgreSQL database + file storage).

**Live URL:** Deployed on GitHub Pages (auto-deploy on push to `main`)
**Supabase URL:** `https://zrrmpaatydhlkntfpcmw.supabase.co`

## Commands

```bash
npm run dev      # Start development server (Vite)
npm run build    # TypeScript check + production build
npm run lint     # ESLint check
npm run preview  # Preview production build locally
```

## Deployment

Pushes to `main` trigger automatic deployment to GitHub Pages via `.github/workflows/deploy.yml`.
- Uses Node v20
- Steps: checkout -> npm ci -> npm run build -> deploy dist/ to GitHub Pages

## Architecture

### Tech Stack
- **Frontend**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS (with custom theme, animations, dark mode)
- **Backend**: Supabase (PostgreSQL + Storage + Edge Functions)
- **Charts**: Recharts
- **Icons**: Lucide React
- **Routing**: React Router DOM v7
- **Payments**: Razorpay integration

### Data Flow Pattern
All data operations follow a consistent pattern using custom hooks in `src/hooks/`:

```
Page Component -> useHook() -> Supabase Client -> Database/Storage
```

Each hook provides:
- State (data, loading, error)
- CRUD operations that update both Supabase and local state
- Related operations (e.g., useMembers has addFunds, uploadAvatar)

### Authentication
- Client-side admin auth via `AuthContext`
- **Admin Password:** `scc@2026` (defined in `src/lib/supabase.ts`)
- Stored in localStorage key `scc-admin`
- `isAdmin` boolean controls admin-only features across all pages

---

## File Structure

```
src/
├── App.tsx                          # Main routing (React Router)
├── main.tsx                         # React entry point
├── types/index.ts                   # All TypeScript interfaces
├── lib/supabase.ts                  # Supabase client + admin password
│
├── context/
│   ├── ThemeContext.tsx              # Light/dark mode (localStorage 'scc-theme')
│   └── AuthContext.tsx              # Admin login/logout (localStorage 'scc-admin')
│
├── hooks/
│   ├── useMembers.ts                # Member CRUD + balance + avatar management
│   ├── useMatches.ts                # Match CRUD + players + fee deductions
│   ├── useTransactions.ts           # Transaction CRUD + reports
│   ├── useTournaments.ts            # Tournament CRUD + match linking + stats
│   ├── useRequests.ts               # Join requests + real-time subscriptions
│   ├── useMatchPolls.ts             # Squad polling responses
│   ├── useMatchPhotos.ts            # Match photos + auto-cleanup (last 5 matches)
│   ├── useFeedback.ts               # Feedback CRUD + admin reply
│   ├── usePayment.ts                # Razorpay order creation + verification
│   ├── usePaymentOrders.ts          # Payment order tracking
│   ├── useSponsor.ts                # Sponsor showcase management
│   ├── useMemberActivity.ts         # Active member computation (last 10 matches)
│   └── useAnimatedValue.ts          # Number animation utility
│
├── components/
│   ├── ui/
│   │   ├── Card.tsx                 # Card with fade-in animation + glass effect
│   │   ├── Button.tsx               # Button with variants (primary/secondary/danger/ghost/success)
│   │   ├── Input.tsx                # Input, TextArea, Select components
│   │   ├── Modal.tsx                # Modal dialog (sm/md/lg/xl)
│   │   ├── Badge.tsx                # Status badges (success/danger/warning/info)
│   │   └── ThemeToggle.tsx          # Dark mode switch
│   │
│   ├── layout/
│   │   ├── Layout.tsx               # Main layout wrapper
│   │   ├── Header.tsx               # Page header + admin badge + notifications
│   │   ├── Sidebar.tsx              # Desktop nav sidebar with logo
│   │   ├── MobileNav.tsx            # Bottom nav bar (mobile)
│   │   └── ContactBar.tsx           # Contact info bar (mobile)
│   │
│   ├── DashboardPoll.tsx            # Squad polling widget for Dashboard
│   ├── PhotoCarousel.tsx            # Auto-rotating photo carousel
│   ├── CalendarWidget.tsx           # Calendar view widget
│   ├── Notifications.tsx            # Notification badge with pending request count
│   ├── PollSummaryBadge.tsx         # Poll response summary indicator
│   ├── PollManageModal.tsx          # Admin poll start/manage modal
│   └── WhatsAppRemindersModal.tsx   # WhatsApp bulk message template
│
├── pages/
│   ├── Dashboard.tsx                # Main overview: stats, charts, polls, sponsor
│   ├── Members.tsx                  # Member management + profiles + avatars
│   ├── Matches.tsx                  # Match management + photos + polling
│   ├── Calendar.tsx                 # Month view of matches
│   ├── Tournaments.tsx              # Tournament tracking
│   ├── Finance.tsx                  # Transactions + monthly reports + payment orders
│   ├── Payment.tsx                  # Online payment via Razorpay
│   ├── Analytics.tsx                # Performance stats + charts
│   ├── Requests.tsx                 # Member join requests
│   ├── Settings.tsx                 # Admin settings + sponsor management + data export
│   ├── Feedback.tsx                 # User feedback + ratings
│   ├── About.tsx                    # App info + sponsor section
│   └── MatchPoll.tsx                # Standalone poll page (/poll/:matchId)
│
└── utils/
    ├── memberActivity.ts            # Active member calculation logic
    └── phone.ts                     # Phone number formatting utilities

supabase/
├── setup.sql                        # Initial database schema
└── migrations/
    ├── add_avatar_storage.sql
    ├── add_birthday_field.sql
    ├── add_feedback.sql
    ├── add_feedback_reply.sql
    ├── add_internal_matches.sql
    ├── add_man_of_match.sql
    ├── add_match_photos.sql
    ├── add_payment_orders.sql
    ├── add_sponsor.sql
    └── add_squad_polling.sql

public/
├── scc-logo.jpg                     # Club logo

.github/workflows/
└── deploy.yml                       # GitHub Pages auto-deploy
```

---

## Key Domain Concepts

### Match Types
- `external` - Regular matches against other teams
- `internal` - Dhurandars vs Bazigars (internal SCC teams, requires team assignment)

### Transaction Types
- `deposit` - Money added to member balance (real cash in)
- `match_fee` - Deducted from member balance for match participation (internal transfer)
- `expense` - Club expenses like ground charges (real cash out)
- `refund` - Money returned to member

### Finance Logic
- **Net Flow** = Deposits - Expenses (match fees excluded - they're internal balance transfers)
- **Club Funds** = Sum of all member balances
- **Member Balance** = Total deposits - Total match fees deducted

### Member Activity
- Computed dynamically by `useMemberActivity` hook
- A member is "active" if they played in at least 1 of the last 10 matches
- Not stored in DB, calculated on-the-fly
- Used for filtering and low-balance alerts

### Squad Polling
- Admin enables polling for upcoming matches (with optional deadline)
- Members respond: `available` / `unavailable` / `maybe` (with optional note)
- Dashboard poll widget shows voting UI + response summary
- Standalone poll page at `/poll/:matchId` for shared links

### Match Photography
- Auto-cleanup: keeps only photos from last 5 matches (`MAX_MATCHES_WITH_PHOTOS=5`)
- Photos stored in `match-photos` Supabase bucket

---

## Database Schema

### Tables

**members**
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | auto-generated |
| name | TEXT | required |
| phone | TEXT | |
| email | TEXT | |
| join_date | DATE | |
| birthday | DATE | |
| status | TEXT | 'active' / 'inactive' |
| balance | DECIMAL | wallet funds |
| matches_played | INT | auto-incremented on match add |
| avatar_url | TEXT | Supabase storage URL |
| created_at | TIMESTAMPTZ | |

**matches**
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| date | DATE | |
| venue | TEXT | |
| opponent | TEXT | |
| result | TEXT | 'won'/'lost'/'draw'/'upcoming'/'cancelled' |
| our_score | TEXT | |
| opponent_score | TEXT | |
| match_fee | DECIMAL | per-player fee |
| ground_cost | DECIMAL | |
| other_expenses | DECIMAL | |
| deduct_from_balance | BOOLEAN | auto-deduct fees on creation |
| notes | TEXT | |
| man_of_match_id | UUID (FK->members) | |
| match_type | TEXT | 'external' / 'internal' |
| winning_team | TEXT | 'dhurandars'/'bazigars'/null |
| polling_enabled | BOOLEAN | |
| polling_deadline | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ | |

**match_players** (junction)
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| match_id | UUID (FK) | |
| member_id | UUID (FK) | |
| fee_paid | BOOLEAN | |
| team | TEXT | for internal matches only |
| UNIQUE | | (match_id, member_id) |

**transactions**
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| date | DATE | |
| type | TEXT | 'deposit'/'match_fee'/'expense'/'refund' |
| amount | DECIMAL | |
| member_id | UUID (FK) | nullable for expenses |
| match_id | UUID (FK) | nullable |
| description | TEXT | |
| created_at | TIMESTAMPTZ | |

**member_requests**
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| name | TEXT | |
| phone | TEXT | |
| email | TEXT | |
| experience | TEXT | |
| message | TEXT | |
| status | TEXT | 'pending'/'approved'/'rejected' |
| created_at | TIMESTAMPTZ | |

**tournaments**
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| name | TEXT | |
| start_date | DATE | |
| end_date | DATE | |
| venue | TEXT | |
| format | TEXT | 'T20'/'ODI'/'T10'/'Tennis Ball'/'Other' |
| status | TEXT | 'upcoming'/'ongoing'/'completed' |
| total_teams | INT | |
| entry_fee | DECIMAL | |
| prize_money | DECIMAL | |
| our_position | INT | |
| result | TEXT | 'winner'/'runner_up'/etc. |
| notes | TEXT | |
| created_at | TIMESTAMPTZ | |

**tournament_matches** (junction)
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| tournament_id | UUID (FK) | |
| match_id | UUID (FK) | |
| stage | TEXT | 'group'/'quarter_final'/'semi_final'/'final'/'league' |
| UNIQUE | | (tournament_id, match_id) |

**match_photos**
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| match_id | UUID (FK) | |
| photo_url | TEXT | |
| caption | TEXT | |
| created_at | TIMESTAMPTZ | |

**feedback**
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| name | TEXT | |
| message | TEXT | |
| rating | INT | 1-5 stars |
| admin_reply | TEXT | |
| replied_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ | |

**match_polls**
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| match_id | UUID (FK) | |
| member_id | UUID (FK) | |
| response | TEXT | 'available'/'unavailable'/'maybe' |
| note | TEXT | |
| responded_at | TIMESTAMPTZ | |
| UNIQUE | | (match_id, member_id) |

**payment_orders**
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| member_id | UUID (FK) | |
| amount | DECIMAL | |
| razorpay_order_id | TEXT | |
| razorpay_payment_id | TEXT | |
| razorpay_signature | TEXT | |
| status | TEXT | 'created'/'paid'/'failed' |
| created_at | TIMESTAMPTZ | |
| paid_at | TIMESTAMPTZ | |

**sponsors**
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| name | TEXT | required |
| tagline | TEXT | short description |
| description | TEXT | full description |
| logo_url | TEXT | Supabase storage URL |
| website_url | TEXT | |
| member_id | UUID (FK->members) | linked team member |
| is_active | BOOLEAN | only one active sponsor |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### Storage Buckets
- **avatars** - Member profile pictures
- **match-photos** - Team match photos (auto-cleaned to last 5 matches)
- **sponsors** - Sponsor logos

### RLS & Access
All tables have RLS enabled with public access policies (auth is client-side via admin password).

---

## Hooks Reference

### useMembers()
- **State:** `members`, `loading`, `error`
- **Functions:** `fetchMembers`, `addMember`, `updateMember`, `deleteMember`, `addFunds`, `deductFunds`, `uploadAvatar`, `removeAvatar`
- **Note:** addFunds creates a `deposit` transaction; deductFunds creates a `match_fee` transaction

### useMatches()
- **State:** `matches` (with nested players, man_of_match, polls), `loading`, `error`
- **Functions:** `fetchMatches`, `addMatch`, `updateMatch`, `deleteMatch`, `updateMatchResult`, `getMatchPlayers`
- **Note:** When `deduct_from_balance=true`, auto-deducts fees and increments `matches_played`

### useTransactions()
- **State:** `transactions` (with member/match), `loading`, `error`
- **Functions:** `fetchTransactions`, `addTransaction`, `addExpense`, `deleteTransaction`, `getTotalFunds`, `getMemberTransactions`

### useTournaments()
- **State:** `tournaments` (with matches), `loading`, `error`
- **Functions:** `fetchTournaments`, `addTournament`, `updateTournament`, `deleteTournament`, `addMatchToTournament`, `removeMatchFromTournament`, `getTournamentStats`

### useRequests()
- **State:** `requests`, `loading`, `error`
- **Functions:** `fetchRequests`, `submitRequest`, `approveRequest`, `rejectRequest`, `deleteRequest`, `getPendingCount`
- **Note:** Has Supabase real-time subscription for instant updates

### useMatchPolls()
- **State:** `polls`, `loading`, `error`
- **Functions:** `fetchPollsByMatch`, `submitResponse`, `removeResponse`, `getPollSummary`
- **Note:** Uses upsert with `onConflict: 'match_id,member_id'`

### useMatchPhotos()
- **State:** `photos` (with match), `loading`, `error`
- **Functions:** `fetchPhotos`, `uploadPhoto`, `deletePhoto`, `getPhotosByMatch`, `getRecentPhotos`
- **Note:** Auto-cleanup keeps only last 5 matches' photos

### useFeedback()
- **State:** `feedback`, `loading`, `error`
- **Functions:** `fetchFeedback`, `submitFeedback`, `replyToFeedback`, `deleteFeedback`

### usePayment()
- **Functions:** `createOrder`, `verifyPayment`, `initiatePayment`
- **Returns:** `PaymentResult { success, message }`

### usePaymentOrders()
- **State:** `paymentOrders`, `loading`, `error`
- **Functions:** `fetchPaymentOrders`

### useSponsor()
- **State:** `sponsor` (single active), `loading`, `error`
- **Functions:** `fetchSponsor`, `saveSponsor`, `uploadLogo`, `removeLogo`, `removeSponsor`

### useMemberActivity(members, matches)
- **Returns:** `activeMemberIds`, `activeMembers`, `activeCount`, `isActive(id)`
- **Logic:** Active = played in at least 1 of last 10 matches

### useAnimatedValue(value, duration)
- **Returns:** `displayValue` (animated number using requestAnimationFrame)

---

## Pages Reference

| Route | Page | Description |
|-------|------|-------------|
| `/` | Dashboard | Stats grid, charts, polls, sponsor, recent matches, alerts |
| `/members` | Members | Member CRUD, profiles, avatars, balance, transaction history |
| `/matches` | Matches | Match CRUD, player selection, photos, polling, results |
| `/calendar` | Calendar | Month view of matches with date indicators |
| `/tournaments` | Tournaments | Tournament CRUD, match linking, stats |
| `/finance` | Finance | Transactions, monthly reports, data export, payment orders |
| `/payment` | Payment | Razorpay online payment for member deposits |
| `/analytics` | Analytics | Win/loss charts, participation stats |
| `/requests` | Requests | Public join form + admin approval/rejection |
| `/settings` | Settings | Admin login, theme, data export, sponsor management |
| `/feedback` | Feedback | Submit feedback with rating, admin replies |
| `/about` | About | App info, values, sponsor section |
| `/poll/:matchId` | MatchPoll | Standalone poll voting page (no layout wrapper) |

---

## Routing Structure (App.tsx)

```
<Routes>
  <Route element={<Layout />}>
    /                -> Dashboard
    /members         -> Members
    /matches         -> Matches
    /calendar        -> Calendar
    /tournaments     -> Tournaments
    /finance         -> Finance
    /payment         -> Payment
    /analytics       -> Analytics
    /requests        -> Requests
    /settings        -> Settings
    /feedback        -> Feedback
    /about           -> About
  </Route>
  /poll/:matchId     -> MatchPoll (outside Layout, standalone)
</Routes>
```

---

## Styling & Theme

### Tailwind Custom Configuration
- **Primary colors:** Green-based palette (50: #ecfdf5 to 900: #064e3b)
- **Cricket theme:** field green (#22c55e), pitch yellow (#fef3c7)
- **Dark mode:** Class-based (`dark:` prefixes), toggled via ThemeContext
- **Custom animations:** fade-in, fade-in-up, slide-in-right, scale-in, bounce-in, pulse-slow, shimmer, wiggle

### Design Patterns
- Mobile-first responsive design
- Bottom nav (mobile) + sidebar (desktop)
- Card-based layout with animation delays
- Glass morphism effects on select cards
- Consistent loading/error states

---

## Adding New Features Checklist

### Adding a New Database Table
1. Create migration file in `supabase/migrations/`
2. Run SQL manually in Supabase Dashboard -> SQL Editor
3. Add TypeScript interface in `src/types/index.ts`
4. Create custom hook in `src/hooks/`
5. Build page/component that uses the hook
6. Add route in `App.tsx` if new page
7. Add navigation link in `Sidebar.tsx` and `MobileNav.tsx`

### Adding a New Page
1. Create page component in `src/pages/`
2. Add route in `App.tsx` (inside or outside Layout)
3. Add nav item in `Sidebar.tsx` (with icon from lucide-react)
4. Add nav item in `MobileNav.tsx`
5. Use existing hooks or create new ones for data

### Modifying Database Schema
1. Create migration file in `supabase/migrations/`
2. Run SQL manually in Supabase Dashboard -> SQL Editor
3. Update TypeScript types in `src/types/index.ts`
4. Update relevant hooks if needed

---

## Dependencies

### Production
| Package | Version | Purpose |
|---------|---------|---------|
| react | 19.2.0 | UI framework |
| react-dom | 19.2.0 | React DOM renderer |
| react-router-dom | 7.11.0 | Client-side routing |
| @supabase/supabase-js | 2.89.0 | Database + storage client |
| recharts | 3.6.0 | Charts and visualizations |
| lucide-react | 0.562.0 | Icon library |

### Dev
| Package | Version | Purpose |
|---------|---------|---------|
| vite | 7.2.4 | Build tool with HMR |
| typescript | 5.9.3 | Type checking |
| tailwindcss | 3.4.19 | Utility-first CSS |
| eslint | 9.39.1 | Code linting |
| autoprefixer | 10.4.23 | CSS vendor prefixes |
| postcss | 8.5.6 | CSS processing |

---

## Important Notes

1. **No server-side auth** - Authentication is purely client-side via admin password
2. **No pagination** - All data is loaded into memory (works fine for club-sized data)
3. **Real-time** - Only `member_requests` has Supabase real-time subscriptions
4. **Storage cleanup** - Match photos auto-clean to last 5 matches only
5. **RLS public** - All tables use public access policies (security is client-side)
6. **Single sponsor** - Only one active sponsor at a time (fetched with `.maybeSingle()`)
7. **Poll upsert** - Poll responses use upsert to allow changing votes
8. **Internal matches** - Require team assignment (dhurandars/bazigars) for all players
9. **Fee deduction** - When `deduct_from_balance=true`, match creation auto-deducts from member wallets
10. **Data export** - Settings page allows JSON export of members, matches, and transactions
