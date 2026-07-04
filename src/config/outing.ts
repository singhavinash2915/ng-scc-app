// ─── Team Outing 2026 — event details ──────────────────────────────────────
// Single source of truth for the Barguje Farms team outing (also Awards Night).

export const TEAM_OUTING = {
  title: 'SCC Team Outing 2026',
  date: '2026-07-18T08:00:00',          // Sat 18 July 2026 — day outing
  dateLabel: 'Saturday, 18 July 2026',
  timeRange: '8 AM – 6 PM',
  venue: 'Barguje Farms',
  venueAddress: 'Shirvali Gaon, Pune 412108',
  mapsUrl: 'https://maps.app.goo.gl/Qfsh9j2qMdoNJaiF8',
  distanceKm: 40,
  distanceFrom: 'Sangria (Hinjawadi)',
  whatsappNumber: '918888546860',       // for coordination (no +)

  // Day plan — kept light and fun; edit freely.
  itinerary: [
    { time: '7:00 AM',  emoji: '🚗', title: 'Depart from Sangria',    desc: 'Carpools roll out — 40 km, ~1 hr drive.' },
    { time: '10:00 AM', emoji: '🏏', title: 'Gully cricket + games',   desc: 'Farm-ground cricket, box cricket & fun games.' },
    { time: '1:00 PM',  emoji: '🍛', title: 'Lunch',                   desc: 'BBQ, DJ, farm-style feast — veg & non-veg.' },
    { time: '3:00 PM',  emoji: '🏊', title: 'Riverside beer + chill',  desc: 'Swim, music, cards & masti.' },
    { time: '5:00 PM',  emoji: '🏆', title: 'SCC Awards Night',        desc: 'Season awards + People’s Awards reveal!' },
  ],

  // What to bring
  packing: [
    { emoji: '🩳', label: 'Swimwear & towel' },
    { emoji: '👟', label: 'Sports shoes' },
    { emoji: '🧴', label: 'Sunscreen & cap' },
    { emoji: '🏏', label: 'Your cricket kit (optional)' },
    { emoji: '🔌', label: 'Power bank / speaker' },
    { emoji: '😎', label: 'Full energy & vibes' },
  ],
};

/** Confirmed attendees seeded into the RSVP list (also lives in the migration). */
export const SEED_ATTENDEES = [
  'Avinash', 'Shakhil', 'Honey', 'Harshit', 'Sumit', 'Cheeku', 'Shubham', 'Monu',
  'Aditya', 'Abhi', 'Saurabh', 'Divyanshu', 'Mayank', 'Prateek', 'Akash', 'Nikhil',
  'Arpan', 'Vaibhav', 'Amit', 'Adarsh', 'Sushil', 'Naveen', 'Bharat',
];
