// The live model runs on Gemini's free tier, whose terms only allow paid
// services for users in the EEA, Switzerland and the UK. Those visitors get
// 451 from the chat route and a recorded example on the page instead.
const BLOCKED_COUNTRIES = new Set([
  // EU
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE",
  "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
  // EEA
  "IS", "LI", "NO",
  // Switzerland and the UK
  "CH", "GB",
  // EU outermost regions that geo databases report under their own code
  "AX", "GF", "GP", "MQ", "RE", "YT", "MF",
]);

export const BLOCKED_NOTICE =
  "The live AI part of this demo isn't available in the EEA, Switzerland or the UK, because it runs on a free model tier whose terms exclude those regions.";

/**
 * Vercel sets x-vercel-ip-country on every request. When it is missing (local
 * dev, tests) the request is allowed. The country is only compared, never
 * logged or stored.
 */
export function isBlockedRegion(headers: Headers): boolean {
  const country = headers.get("x-vercel-ip-country")?.trim().toUpperCase();
  return country ? BLOCKED_COUNTRIES.has(country) : false;
}
