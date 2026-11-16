/** Derive totals, percentages and the winner from a session row. */
export function computeResults(session) {
  const a = session?.votes_a ?? 0;
  const b = session?.votes_b ?? 0;
  const total = a + b;
  const pctA = total ? Math.round((a / total) * 100) : 0;
  const pctB = total ? 100 - pctA : 0;
  let winner = null; // 'A' | 'B' | 'TIE' | null (no votes)
  if (total > 0) winner = a > b ? 'A' : b > a ? 'B' : 'TIE';
  return { a, b, total, pctA, pctB, winner };
}

function baseUrl() {
  return (import.meta.env.VITE_PUBLIC_APP_URL || window.location.origin).replace(/\/+$/, '');
}

/** Link students open (encoded in the QR code). */
export function voteUrl(sessionId) {
  return `${baseUrl()}/v/${sessionId}`;
}

/** Link for the projector: shows only the QR code. */
export function screenUrl(sessionId) {
  return `${baseUrl()}/s/${sessionId}`;
}

export function prettyUrl(url) {
  return url.replace(/^https?:\/\//, '');
}

export function isLocalHostUrl(url) {
  return /\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:|\/)/.test(url);
}
