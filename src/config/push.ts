// ─── Web push configuration ────────────────────────────────────────────────────
// The PUBLIC VAPID key is safe to ship in the client — it's how the browser
// identifies our server when subscribing.
//
// The matching PRIVATE key must live ONLY as a Supabase secret:
//   supabase secrets set VAPID_PRIVATE_KEY=... VAPID_PUBLIC_KEY=... VAPID_SUBJECT=mailto:sangriacricket@gmail.com
// It is deliberately not in this repo.

export const VAPID_PUBLIC_KEY =
  'BAeI3GDna2Fiph6hYDUg3STzPU3ftR6_L93YyVEcMg-TonKJgyolHame48-Qv3RU2zEEc-2vRD6lQOtFnhkFXJg';
