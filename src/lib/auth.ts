/** String comparison that doesn't stop at the first different character. */
export function safeEqual(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  let diff = left.length ^ right.length;
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  }
  return diff === 0;
}

/** Checks an `Authorization: Basic ...` header against one user and password. */
export function checkBasicAuth(header: string | null, user: string, password: string): boolean {
  const match = /^Basic\s+([A-Za-z0-9+/=]+)$/i.exec(header?.trim() ?? "");
  if (!match?.[1]) return false;

  let decoded: string;
  try {
    const bytes = Uint8Array.from(atob(match[1]), (c) => c.charCodeAt(0));
    decoded = new TextDecoder().decode(bytes);
  } catch {
    return false;
  }

  const separator = decoded.indexOf(":");
  if (separator === -1) return false;
  // Check both halves every time so a wrong user and a wrong password take as long.
  const userOk = safeEqual(decoded.slice(0, separator), user);
  const passwordOk = safeEqual(decoded.slice(separator + 1), password);
  return userOk && passwordOk;
}
