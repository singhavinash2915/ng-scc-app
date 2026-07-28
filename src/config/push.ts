// ─── Web push configuration ────────────────────────────────────────────────────
// The PUBLIC VAPID key is safe to ship in the client — it's how the browser
// identifies our server when subscribing.
//
// The matching PRIVATE key must live ONLY as a Supabase secret:
//   supabase secrets set VAPID_PRIVATE_KEY=... VAPID_PUBLIC_KEY=... VAPID_SUBJECT=mailto:sangriacricket@gmail.com
// It is deliberately not in this repo.

export const VAPID_PUBLIC_KEY =
  'BHfS3Av18EUv0HEIIZeV20aBpb0Cq8iI2NO8BDWoD1Mws4RYZc6PGBVYw9J0IJVoXMvFM_xb13p5naPU1-jwGlI';
