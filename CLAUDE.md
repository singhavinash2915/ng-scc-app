# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Sangria Cricket Club (SCC) Management App - A React TypeScript application for managing a cricket club's members, matches, finances, and tournaments. Uses Supabase as the backend (database + storage).

## Commands

```bash
npm run dev      # Start development server (Vite)
npm run build    # TypeScript check + production build
npm run lint     # ESLint check
npm run preview  # Preview production build locally
```

## Deployment

Pushes to `main` trigger automatic deployment to GitHub Pages via `.github/workflows/deploy.yml`.

## Architecture

### Tech Stack
- **Frontend**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Storage)
- **Charts**: Recharts
- **Icons**: Lucide React
- **Routing**: React Router DOM

### Data Flow Pattern
All data operations follow a consistent pattern using custom hooks in `src/hooks/`:

```
Page Component → useHook() → Supabase Client → Database
```

Each hook (useMembers, useMatches, useTransactions, etc.) provides:
- State (data, loading, error)
- CRUD operations that update both Supabase and local state
- Related operations (e.g., useMembers has addFunds, uploadAvatar)

### Key Domain Concepts

**Match Types:**
- `external` - Regular matches against other teams
- `internal` - Dhurandars vs Bazigars (internal SCC teams)

**Transaction Types:**
- `deposit` - Money added to member balance (real cash in)
- `match_fee` - Deducted from member balance for match participation (internal transfer)
- `expense` - Club expenses like ground charges (real cash out)
- `refund` - Money returned

**Finance Logic:**
- Net Flow = Deposits - Expenses (match fees excluded - they're internal balance transfers)
- Club Funds = Sum of all member balances

### File Structure

```
src/
├── types/index.ts       # All TypeScript interfaces
├── lib/supabase.ts      # Supabase client + admin password
├── hooks/               # Data fetching hooks (useMembers, useMatches, etc.)
├── context/             # ThemeContext, AuthContext
├── components/
│   ├── ui/              # Reusable UI components (Button, Card, Modal, etc.)
│   └── layout/          # Layout components (Header, Sidebar, MobileNav)
└── pages/               # Route pages (Dashboard, Members, Matches, Finance, etc.)

supabase/
├── setup.sql            # Initial database schema
└── migrations/          # Schema updates (run manually in Supabase SQL Editor)
```

### Database Schema

Core tables: `members`, `matches`, `match_players`, `transactions`, `tournaments`, `tournament_matches`, `member_requests`, `match_photos`

All tables have RLS enabled with public access policies (client-side auth via admin password).

### Adding Database Changes

1. Create migration file in `supabase/migrations/`
2. Run SQL manually in Supabase Dashboard → SQL Editor
3. Update TypeScript types in `src/types/index.ts`
4. Update relevant hooks if needed
