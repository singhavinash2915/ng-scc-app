# Design concepts — "Stadium Night" premium UI

Static HTML mockups exploring a premium dark UI direction for the SCC app.
**Reference only** — this folder is NOT part of the build (`npm run build` ships
`dist/`), so nothing here is deployed to the live site. Open the files directly
in a browser to view.

| File | Screen |
|------|--------|
| `home.html` | Dashboard / Home — aurora glow, glass cards, live-match hero, bento stats, Wrapped CTA |
| `profile.html` | Member profile — collectible hero card, OVR badge, skill bars, badges |
| `leaderboard.html` | Leaderboard — gold/silver/bronze podium + ranked list with "you" highlight |

## Design language
- Near-black canvas (`#080b12`) + aurora/mesh radial glows (emerald · violet · amber)
- Glassmorphism: translucent surfaces, hairline borders, `backdrop-blur`, soft shadows
- Type: `Sora` (display / big numerals) + `Inter` (body), tight tracking, tabular numerals
- Per-domain accent gradients: emerald = team, violet = fantasy/players, amber = records
- Data-viz flourishes: progress rings, gradient skill bars, podiums

To apply for real later: add the Sora font + a shared `glass` utility + accent-gradient
tokens, then convert screens one at a time (Home and Profile are highest impact).
