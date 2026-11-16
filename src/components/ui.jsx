import { useEffect, useId, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { APP_TITLE } from '../config/poll.js';

/* ---------- Brand ---------- */

export function BrandMark({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="brand-mark">
      <rect width="64" height="64" rx="20" fill="var(--ink)" />
      <path d="M18 38c5-4 9-4 14 0s9 4 14 0" stroke="var(--lime)" strokeWidth="5" fill="none" strokeLinecap="round" />
      <path d="M18 27c5-4 9-4 14 0s9 4 14 0" stroke="#fff" strokeWidth="5" fill="none" strokeLinecap="round" opacity=".5" />
    </svg>
  );
}

export function Brand({ compact = false, light = false }) {
  return (
    <div className={`brand ${compact ? 'brand--compact' : ''} ${light ? 'brand--light' : ''}`}>
      <BrandMark size={compact ? 26 : 34} />
      <span>{APP_TITLE}</span>
    </div>
  );
}

/** Renders text with one part wrapped in the lime marker. */
export function Highlight({ text, mark }) {
  if (!mark || !text.includes(mark)) return text;
  const i = text.indexOf(mark);
  return (
    <>
      {text.slice(0, i)}
      <mark className="hl">{mark}</mark>
      {text.slice(i + mark.length)}
    </>
  );
}

/* ---------- Status ---------- */

const STATUS_LABEL = {
  waiting: 'Waiting to start',
  voting: 'Voting open',
  closed: 'Voting closed',
  results: 'Results',
};

export function StatusPill({ status, dark = false }) {
  return (
    <span className={`pill pill--${status} ${dark ? 'pill--dark' : ''}`}>
      <i className="pill__dot" aria-hidden="true" />
      {STATUS_LABEL[status] || status}
    </span>
  );
}

export function ConnectionDot({ connection, dark = false }) {
  const label = connection === 'live' ? 'Live' : connection === 'connecting' ? 'Connecting…' : 'Reconnecting…';
  return (
    <span className={`conn conn--${connection} ${dark ? 'conn--dark' : ''}`} title={`Realtime: ${label}`}>
      <i aria-hidden="true" />
      {label}
    </span>
  );
}

/* ---------- Ocean + yacht illustration (pure SVG, no photos) ---------- */

const SEA = {
  storm: ['#052a31', '#0b4b53', '#16717a'],
  calm: ['#0d6c75', '#22a0a6', '#79d6cc'],
};

export function Ocean({ tone = 'calm', yacht = false, animate = false, className = '' }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const [c1, c2, c3] = SEA[tone] || SEA.calm;
  return (
    <div className={`ocean ocean--${tone} ${animate ? 'ocean--animate' : ''} ${className}`} aria-hidden="true">
      <svg className="ocean__svg" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={c1} />
            <stop offset="0.55" stopColor={c2} />
            <stop offset="1" stopColor={c3} />
          </linearGradient>
          <filter id={`w${id}`} x="0" y="0" width="100%" height="100%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency={tone === 'storm' ? '0.012 0.05' : '0.009 0.035'}
              numOctaves="3"
              seed={tone === 'storm' ? 11 : 4}
            />
            <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  4.2 0 0 0 -2.3" />
          </filter>
          <radialGradient id={`v${id}`} cx="0.5" cy="0.4" r="0.8">
            <stop offset="0.5" stopColor="#000" stopOpacity="0" />
            <stop offset="1" stopColor="#000" stopOpacity="0.35" />
          </radialGradient>
        </defs>
        <rect width="400" height="400" fill={`url(#g${id})`} />
        <g transform="rotate(-24 200 200)">
          <rect x="-120" y="-120" width="640" height="640" filter={`url(#w${id})`} opacity={tone === 'storm' ? 0.32 : 0.4} />
        </g>
        <rect width="400" height="400" fill={`url(#v${id})`} />
      </svg>
      {yacht && <Yacht />}
    </div>
  );
}

export function Yacht({ className = '' }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <svg className={`yacht ${className}`} viewBox="0 0 120 340" aria-hidden="true">
      <defs>
        <filter id={`f${id}`} x="-50%" y="-20%" width="200%" height="140%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
        <filter id={`s${id}`} x="-30%" y="-10%" width="160%" height="130%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>
      {/* wake */}
      <path d="M36 250 L-10 340 L130 340 L84 250 Z" fill="#fff" opacity="0.45" filter={`url(#f${id})`} />
      <path d="M44 252 L20 340 M76 252 L100 340" stroke="#fff" strokeWidth="5" opacity="0.6" filter={`url(#f${id})`} />
      {/* shadow */}
      <path
        d="M60 8 C93 62 97 140 93 252 L27 252 C23 140 27 62 60 8Z"
        fill="#00161a"
        opacity="0.35"
        transform="translate(7 9)"
        filter={`url(#s${id})`}
      />
      {/* hull */}
      <path d="M60 8 C93 62 97 140 93 252 L27 252 C23 140 27 62 60 8Z" fill="#fbfbf8" />
      {/* teak deck */}
      <path d="M60 32 C85 76 87 142 85 238 L35 238 C33 142 35 76 60 32Z" fill="#c38d5c" />
      <g stroke="#9e6c40" strokeWidth="1" opacity="0.45">
        <path d="M46 70 V236 M53 50 V236 M60 34 V236 M67 50 V236 M74 70 V236" />
      </g>
      {/* bow loungers */}
      <rect x="49" y="66" width="22" height="30" rx="7" fill="#f1ece3" />
      <circle cx="50" cy="108" r="5" fill="#f1ece3" />
      <circle cx="70" cy="108" r="5" fill="#f1ece3" />
      {/* cabin */}
      <rect x="40" y="122" width="40" height="76" rx="12" fill="#f5f7f7" />
      <path d="M43 132 Q60 114 77 132 L77 146 L43 146 Z" fill="#17343a" />
      <rect x="47" y="156" width="26" height="30" rx="6" fill="#e3e8e8" />
      {/* aft sundeck */}
      <rect x="40" y="208" width="40" height="24" rx="7" fill="#efe9de" />
    </svg>
  );
}

/* ---------- QR ---------- */

/** Large, high-contrast QR code (black on white, quiet zone included). */
export function QrCode({ value, className = '' }) {
  return (
    <div className={`qr ${className}`}>
      <QRCodeSVG
        value={value}
        size={512}
        level="M"
        marginSize={2}
        bgColor="#ffffff"
        fgColor="#0f1a1c"
        style={{ width: '100%', height: '100%', display: 'block' }}
        title="Scan to join the vote"
      />
    </div>
  );
}

/* ---------- Numbers ---------- */

/** Number that counts up/down smoothly to its new value. */
export function AnimatedNumber({ value, duration = 900 }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  const raf = useRef(0);

  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setShown(value);
      from.current = value;
      return undefined;
    }
    const start = performance.now();
    const a = from.current;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(a + (value - a) * eased));
      if (t < 1) raf.current = requestAnimationFrame(tick);
      else from.current = value;
    };
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf.current);
      from.current = value;
    };
  }, [value, duration]);

  return <span className="num">{shown}</span>;
}

/** Number that pops each time it changes. */
export function BumpNumber({ value }) {
  return (
    <span key={value} className="bump">
      {value}
    </span>
  );
}

/** Avatar-stack style row of dots for joined participants. */
export function PeopleStack({ count, max = 7 }) {
  const shown = Math.min(count, max);
  const rest = count - shown;
  return (
    <div className="people" aria-hidden="true">
      {Array.from({ length: shown }, (_, i) => (
        <span key={i} className={`people__dot people__dot--${i % 4}`} style={{ '--i': i }} />
      ))}
      {rest > 0 && <span className="people__dot people__more">+{rest}</span>}
    </div>
  );
}

/* ---------- Misc ---------- */

export function ArrowIcon({ dir = 'right' }) {
  const rot = { right: 0, down: 90, left: 180, up: -90 }[dir];
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" style={{ transform: `rotate(${rot}deg)` }} aria-hidden="true">
      <path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true">
      <rect x="5" y="10.5" width="14" height="10" rx="3" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export function Spinner({ label = 'Loading…' }) {
  return (
    <div className="spinner" role="status">
      <span className="spinner__ring" aria-hidden="true" />
      <span className="spinner__label">{label}</span>
    </div>
  );
}
