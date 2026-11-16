// localStorage with an in-memory fallback (private browsing, blocked storage…)
const memory = new Map();

export function getItem(key) {
  try {
    const v = window.localStorage.getItem(key);
    return v ?? memory.get(key) ?? null;
  } catch {
    return memory.get(key) ?? null;
  }
}

export function setItem(key, value) {
  memory.set(key, value);
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export function removeItem(key) {
  memory.delete(key);
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** RFC 4122 v4 UUID. Works on plain http:// too (crypto.randomUUID needs https). */
export function uuidv4() {
  if (window.crypto?.randomUUID) {
    try {
      return window.crypto.randomUUID();
    } catch {
      /* fall through */
    }
  }
  const b = window.crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Anonymous participant id — one per browser, kept across refreshes. */
export function getParticipantId() {
  const KEY = 'livevote:participant-id';
  let id = getItem(KEY);
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    id = uuidv4();
    setItem(KEY, id);
  }
  return id;
}

const HOST_KEY = 'livevote:host';

export function loadHost() {
  try {
    const v = JSON.parse(getItem(HOST_KEY) || 'null');
    return v?.sessionId && v?.hostSecret ? v : null;
  } catch {
    return null;
  }
}

export function saveHost(sessionId, hostSecret) {
  setItem(HOST_KEY, JSON.stringify({ sessionId, hostSecret }));
}

export function clearHost() {
  removeItem(HOST_KEY);
}
