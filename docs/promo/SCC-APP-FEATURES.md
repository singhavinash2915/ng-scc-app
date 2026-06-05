# 🏏 Sangria Cricket Club — Club Management App

**Built by cricketers, for cricketers.** Everything your club needs in one place — match tracking, stats, predictions, online payments, ground booking & more.

🔗 **Try it live:** https://singhavinash2915.github.io/ng-scc-app/
📱 **Installable** as a PWA on any phone — no app store needed

---

## 📤 Share message for WhatsApp groups

> _Copy-paste this into your cricket group chats:_

```
🏏 Check out this Cricket Club app — built by SCC for free use!

✅ Track every match, score & stat (auto-synced from CricHeroes)
✅ AI Insights — Best XI selector, Cricket DNA, MOM predictions
✅ Predictions game with bonus questions (₹ prizes!)
✅ Member profiles with 21 unlockable achievements
✅ Live scorecard on match day
✅ Online payments + ground booking for opponent teams

Try it 👉 https://singhavinash2915.github.io/ng-scc-app/
```

---

## ⭐ Highlight Features

### 1. 📊 Live Dashboard — Everything at a Glance
Form streak, season stats, live ticker, MOM race, weather for next match, low-balance alerts — all in one scroll.

> **Screenshot to attach:** `/` (home page)

---

### 2. 🤖 AI-Powered Insights
- **Squad AI** — Best XI selector based on form + availability
- **Cricket DNA** — Player personality cards (Strategist / Destroyer / All-rounder)
- **AI Chat** — Ask anything about the club in natural language
- **Season Highlights** — Auto-generated analysis

> **Screenshot to attach:** `/ai-insights`

---

### 3. 🎰 Predictions Game with Real Prizes
Pre-match predictions for every game:
- Winner (+5 pts) · Top Scorer (+10 pts) · Top Wicket-Taker (+10 pts) · MOM (+5 pts)
- **NEW bonus questions:** Total score range, will anyone score 50+?, will anyone take 3+ wickets? (+25 pts)
- **Max 55 points per match**
- Season leaderboard with gift hamper for #1 🎁

> **Screenshot to attach:** `/predictions`

---

### 4. 🏆 Auto-Synced Stats from CricHeroes
- 41+ players tracked, all seasons
- Batting / Bowling / Fielding / Overall leaderboards
- Daily sync — no manual entry
- **21 unlockable achievements**: Half-Century, Iron Man, Triple Threat, Most Valuable & more

> **Screenshots to attach:** `/leaderboard`, `/profile/<member-id>` (Achievements tab)

---

### 5. 📅 Match Day Tools
- **Live scorecard** auto-loads from CricHeroes during the match
- **Squad polling** — members mark available/unavailable
- **Match poster generator** — share on WhatsApp instantly
- **Emoji reactions** + comment threads on every match

> **Screenshot to attach:** `/matches`

---

### 6. 💰 Online Payments + Ground Booking
- **Opponents can book a match** vs your club directly via the app — pick a date, pay via UPI or Razorpay
- **AI auto-verifies UPI screenshots** in real-time (saves 2% Razorpay fees!)
- **Online deposits** for members via Razorpay
- **Auto-deduction** of match fees from member wallets
- **Monthly reports** + annual financial summary

> **Screenshot to attach:** `/book-match`

---

## ✅ Full Feature List

### Match Management
- [x] Match scheduling, results, scorecards
- [x] Internal team rivalry tracking (Dhurandars vs Bazigars-style)
- [x] Player squad selection per match
- [x] Live scorecard from CricHeroes
- [x] Photo galleries (auto-cleaned)
- [x] Match highlights cards

### Stats & Records
- [x] Auto-synced career stats (CricHeroes)
- [x] Season-wise + all-time leaderboards
- [x] Club Hall of Fame
- [x] Head-to-Head vs every opponent
- [x] Player of the Month (rolling)
- [x] Best ground / toughest opponent analytics

### Engagement
- [x] Predictions game with seasonal prizes
- [x] Squad availability polling
- [x] Emoji reactions + comments
- [x] Team Wall / notice board with auto-expiry
- [x] Birthday banners
- [x] Member achievements (21 unlockable badges)

### AI Features
- [x] AI Chat (ask anything about the club)
- [x] Cricket DNA personality cards
- [x] Best XI Squad Selector
- [x] Season highlights generator

### Finance
- [x] Member wallet system (deposits, match fees, refunds)
- [x] Razorpay online payment integration
- [x] Monthly + Annual finance reports
- [x] Low-balance member alerts
- [x] Data export (CSV / JSON)

### Opponents / External
- [x] **Book a Match vs SCC** — opponents can self-book + pay online
- [x] AI-verified UPI screenshot validation
- [x] Ground photos carousel
- [x] Win/loss record displayed for credibility

### Admin Tools
- [x] Fee tracking + match-day logistics
- [x] Annual report (financial + performance)
- [x] Player auction runner
- [x] CricHeroes daily sync
- [x] Custom awards & seasonal voting
- [x] Member request approval flow

### Polish
- [x] Dark mode
- [x] Mobile-first responsive design
- [x] Installable PWA (works offline)
- [x] Real-time updates (Supabase subscriptions)
- [x] What's New release notes

---

## 🎯 Why Cricket Clubs Love It

| What other apps lack | What SCC App provides |
|---|---|
| Generic dashboards | Cricket-specific UI (overs, run rate, MOM, etc.) |
| Manual stat entry | Auto-sync from CricHeroes |
| Static records | Live leaderboards + season filtering |
| Cash-only finance | UPI + Razorpay + AI verification |
| No engagement | Predictions, polls, achievements, chat |
| Admin-only | Members get personal stats + history |

---

## 📞 Get In Touch

Want to use this for your club? It's **free to fork & adapt** for any cricket club.

- 🌐 **Live demo:** https://singhavinash2915.github.io/ng-scc-app/
- 💻 **GitHub:** https://github.com/singhavinash2915/ng-scc-app
- 📧 **Contact:** sangriacricket@gmail.com
- 📷 **Instagram:** @sangriacricket_official

---

## 📸 Screenshot Checklist (for attaching to this doc)

To include screenshots in this document, open the app on mobile and capture these screens. Save them as `screenshots/<name>.png` in this folder, then replace the **"Screenshot to attach"** lines above with `![Caption](./screenshots/<name>.png)`.

| Section | Page URL | Filename suggestion |
|---|---|---|
| Dashboard | `/` | `01-dashboard.png` |
| AI Insights | `/ai-insights` | `02-ai-insights.png` |
| Predictions | `/predictions` | `03-predictions.png` |
| Leaderboard | `/leaderboard` | `04-leaderboard.png` |
| Member profile + Achievements | `/profile/<your-id>` → Achievements tab | `05-achievements.png` |
| Matches | `/matches` | `06-matches.png` |
| Book a Match | `/book-match` | `07-book-match.png` |
| Records / Hall of Fame | `/records` | `08-records.png` |
| Analytics | `/analytics` | `09-analytics.png` |

---

*Built with React + Supabase + Claude AI · v2026.06*
