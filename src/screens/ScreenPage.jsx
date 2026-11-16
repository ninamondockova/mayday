import { useEffect } from 'react';
import { QrCode } from '../components/ui.jsx';
import { voteUrl, prettyUrl, isLocalHostUrl } from '../lib/results.js';

/**
 * Projector view: nothing but the QR code (and the short link under it).
 * Click anywhere or press F for fullscreen.
 */
export default function ScreenPage({ sessionId }) {
  const url = voteUrl(sessionId);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'f' || e.key === 'F') toggleFullscreen();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="qr-screen" onDoubleClick={toggleFullscreen} title="Double-click or press F for fullscreen">
      {isLocalHostUrl(url) && (
        <div className="warn-banner" role="alert">
          This QR code points to <b>{prettyUrl(url)}</b>, which phones cannot open. Use the deployed site or set{' '}
          <code>VITE_PUBLIC_APP_URL</code>.
        </div>
      )}
      <div className="qr-screen__inner">
        <QrCode value={url} className="qr--screen" />
        <p className="qr-screen__url">{prettyUrl(url)}</p>
      </div>
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
