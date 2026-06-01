/**
 * Normalises venue name variations to a single canonical form.
 * Matching is case-insensitive and trims whitespace.
 */
const VENUE_ALIASES: Record<string, string> = {
  // Four Star
  'four star': 'Four Star Cricket Ground',
  'four star ground': 'Four Star Cricket Ground',
  'four star cricket ground': 'Four Star Cricket Ground',

  // A2Z / A to Z Lavale
  'a2z lavale': 'A2Z Lavale',
  'a2z': 'A2Z Lavale',
  'a to z cricket ground lavale': 'A2Z Lavale',
  'a to z lavale': 'A2Z Lavale',

  // Infinity
  'infinity cricket ground': 'Infinity Cricket Ground',
  'infinity': 'Infinity Cricket Ground',
  'infinity ground': 'Infinity Cricket Ground',
  'infinity griund': 'Infinity Cricket Ground',

  // Spark / 30YCA
  '30yca spark cricket ground, jambhe': 'Spark Cricket Ground',
  '30yca cricket ground(spark) jambhe': 'Spark Cricket Ground',
  'spark cricket ground a1': 'Spark Cricket Ground',
  'spark sports ground': 'Spark Cricket Ground',
  'sparx a1': 'Spark Cricket Ground',
  'spark a2 ground': 'Spark Cricket Ground',

  // CSMCC
  'csmcc chandkhed': 'CSMCC',
  'csmcc': 'CSMCC',
};

export function normalizeVenue(venue: string): string {
  const key = venue.trim().toLowerCase();
  return VENUE_ALIASES[key] ?? venue.trim();
}
