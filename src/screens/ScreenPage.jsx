import { useEffect } from 'react';
import { Scene, QrCode, CountPill } from '../components/ui.jsx';
import { voteUrl, prettyUrl, isLocalHostUrl } from '../lib/results.js';
import { isConfigured } from '../lib/supabase.js';
import { useLiveSession } from '../hooks/useLiveSession.js';

/**
 * Projector view: the QR code (plus the short link and a live "joined" counter).
 * Double-click or press F for fullscreen.
 */
export default function ScreenPage({ sessionId }) {
  const url = voteUrl(sessionId);
  const { session } = useLiveSession(isConfigured ? sessionId : null, { pollMs: 5000 });

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'f' || e.key === 'F') toggleFullscreen();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div onDoubleClick={toggleFullscreen} title="Double-click or press F for fullscreen">
      <Scene
        theme="cream"
        decor="qr"
        className="scene--projector"
        right={session ? <CountPill count={session.joined_count} theme="cream" /> : null}
      >
        {isLocalHostUrl(url) && (
          <p className="notice">
            This QR code points to <b>{prettyUrl(url)}</b>, which phones cannot open. Use the deployed site or set{' '}
            <code>VITE_PUBLIC_APP_URL</code>.
          </p>
        )}
        <div className="stack stack--center grow projector">
          <h1 className="title title--xl">
            Scan the QR code
            <br />
            to join the vote!
          </h1>
          <div className="qr-frame">
            <QrCode value={url} />
          </div>
          <p className="url-pill">{prettyUrl(url)}</p>
        </div>
      </Scene>
    </div>
  );
}

function toggleFullscreen() {
  const d = document;
  if (d.fullscreenElement || d.webkitFullscreenElement) {
    (d.exitFullscreen || d.webkitExitFullscreen)?.call(d);
  } else {
    const el = d.documentElement;
    (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el);
  }
}
