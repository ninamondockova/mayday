import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase, fetchSession } from '../lib/supabase.js';

/**
 * Keeps one `sessions` row in sync in real time.
 *
 * - Supabase Realtime (postgres_changes) pushes every update instantly.
 * - On (re)subscribe, tab focus, coming back online or waking a phone,
 *   the row is re-fetched so nothing is missed while disconnected.
 * - A slow safety poll covers networks that silently drop websockets.
 * - Updates are applied only if their `version` is newer, so a late
 *   message can never overwrite fresher data.
 *
 * @returns {{ session, setSession, connection: 'connecting'|'live'|'reconnecting', refresh, notFound }}
 */
export function useLiveSession(sessionId, { pollMs = 10000 } = {}) {
  const [session, setSessionState] = useState(null);
  const [connection, setConnection] = useState('connecting');
  const [notFound, setNotFound] = useState(false);
  const latest = useRef(null);

  const apply = useCallback((row) => {
    if (!row) return;
    const cur = latest.current;
    if (cur && cur.id === row.id && (row.version ?? 0) < (cur.version ?? 0)) return;
    latest.current = row;
    setSessionState(row);
  }, []);

  const refresh = useCallback(async () => {
    if (!sessionId) return;
    try {
      const row = await fetchSession(sessionId);
      if (!row) setNotFound(true);
      else {
        setNotFound(false);
        apply(row);
      }
    } catch {
      /* transient — realtime or the next poll will catch up */
    }
  }, [sessionId, apply]);

  useEffect(() => {
    if (!sessionId || !supabase) return undefined;
    let disposed = false;

    refresh();

    const channel = supabase
      .channel(`session-${sessionId}-${Math.random().toString(36).slice(2, 8)}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${sessionId}` },
        (payload) => apply(payload.new)
      )
      .subscribe((status) => {
        if (disposed) return;
        if (status === 'SUBSCRIBED') {
          setConnection('live');
          refresh(); // catch anything that happened while we were connecting
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setConnection('reconnecting');
        }
      });

    const wake = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    const offline = () => setConnection('reconnecting');
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('focus', wake);
    window.addEventListener('online', wake);
    window.addEventListener('offline', offline);
    window.addEventListener('pageshow', wake); // iOS back/forward cache

    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, pollMs);

    return () => {
      disposed = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('focus', wake);
      window.removeEventListener('online', wake);
      window.removeEventListener('offline', offline);
      window.removeEventListener('pageshow', wake);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, pollMs, apply, refresh]);

  return { session, setSession: apply, connection, refresh, notFound };
}
