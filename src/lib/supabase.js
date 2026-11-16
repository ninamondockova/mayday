import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isConfigured = Boolean(url && key);

export const supabase = isConfigured
  ? createClient(url, key, {
      // No user accounts: nothing to persist or refresh.
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      realtime: { params: { eventsPerSecond: 20 } },
    })
  : null;

/** Call a Postgres RPC and throw a friendly error on failure. */
export async function rpc(fn, args) {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw toAppError(error);
  return data;
}

export async function fetchSession(sessionId) {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', sessionId)
    .maybeSingle();
  if (error) throw toAppError(error);
  return data;
}

const MESSAGES = {
  HOST_BAD_PASSCODE: 'Wrong host passcode.',
  HOST_NOT_CONFIGURED: 'No host passcode is set yet. Run private.set_host_passcode(...) in the Supabase SQL editor.',
  HOST_UNAUTHORIZED: 'This screen is no longer authorized to control the session.',
  SESSION_NOT_FOUND: 'This voting room does not exist.',
};

export function toAppError(error) {
  const code = error?.hint && MESSAGES[error.hint] ? error.hint : null;
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  const network = offline || /fetch|network|load failed/i.test(error?.message || '');
  const err = new Error(
    code ? MESSAGES[code] : network ? 'Connection problem. Check the internet and try again.' : error?.message || 'Something went wrong.'
  );
  err.code = code || (network ? 'NETWORK' : 'UNKNOWN');
  return err;
}
