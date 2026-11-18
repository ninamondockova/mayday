import { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

/* =====================================================================
   Logo
   ===================================================================== */

/** mayday mark — a boat seen from above; its wake forms a "V" (for vote). */
export function LogoMark({ size = 34, bg = 'var(--blue)', fg = 'var(--cream)', className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className={`logo-mark ${className}`}>
      <circle cx="32" cy="32" r="31" fill={bg} />
      <g transform="translate(32 31) rotate(24) scale(0.8) translate(-32 -32)">
        <path d="M21 63 L32 54 L43 63" stroke={fg} strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M32 4 C45.5 15 48 30 47 45 C47 49.5 41.5 51 32 51 C22.5 51 17 49.5 17 45 C16 30 18.5 15 32 4 Z" fill={fg} />
        <rect x="26" y="20" width="12" height="22" rx="6" fill={bg} />
      </g>
    </svg>
  );
}

/** Hand-built rounded wordmark "mayday" (no font needed). */
export function Wordmark({ height = 22, className = '' }) {
  return (
    <svg
      height={height}
      viewBox="-5 -5 160 48"
      aria-label="mayday"
      role="img"
      className={`wordmark ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="7.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 26 V14 A6 6 0 0 1 15 14 V26 M15 14 A6 6 0 0 1 27 14 V26" />
      <circle cx="42" cy="17" r="9" />
      <path d="M51 8 V26" />
      <path d="M57 8 V16 A9 9 0 0 0 75 16 M75 8 V30 A7 7 0 0 1 61 34" />
      <circle cx="90" cy="17" r="9" />
      <path d="M99 0 V26" />
      <circle cx="114" cy="17" r="9" />
      <path d="M123 8 V26" />
      <path d="M129 8 V16 A9 9 0 0 0 147 16 M147 8 V30 A7 7 0 0 1 133 34" />
    </svg>
  );
}

/** Logo that adapts to the screen colour (cream screen → blue logo, blue screen → cream logo). */
export function Brand({ size = 'md', theme = 'cream' }) {
  const mark = { sm: 30, md: 38, lg: 96 }[size];
  const word = { sm: 18, md: 23, lg: 58 }[size];
  const onBlue = theme === 'blue';
  return (
    <div className={`brand brand--${size}`}>
      <LogoMark
        size={mark}
        bg={onBlue ? 'var(--cream)' : 'var(--blue)'}
        fg={onBlue ? 'var(--blue)' : 'var(--cream)'}
      />
      <Wordmark height={word} />
    </div>
  );
}

/* =====================================================================
   Scene — one screen: colour theme, header pill, decorations
   ===================================================================== */

export function Scene({ theme = 'cream', right = null, decor = 'default', className = '', children }) {
  return (
    <div className={`scene scene--${theme} ${className}`}>
      <Decor variant={decor} />
      <header className="scene__top">{right}</header>
      <main className="scene__main">{children}</main>
    </div>
  );
}

/** Waves, coral, seaweed, bubbles — coloured through CSS (currentColor / vars). */
export function Decor({ variant = 'default' }) {
  return (
    <div className={`decor decor--${variant}`} aria-hidden="true">
      <Bubbles className="decor__bubbles decor__bubbles--l" />
      <Bubbles className="decor__bubbles decor__bubbles--r" small />
      {variant === 'qr' && <Shell className="decor__shell" />}
      <Coral className="decor__coral" />
      <Seaweed className="decor__weed" />
      <Waves className="decor__waves" />
    </div>
  );
}

export function Waves({ className = '' }) {
  return (
    <svg className={`waves ${className}`} viewBox="0 0 400 120" preserveAspectRatio="none">
      <path className="waves__back" d="M0 58 C55 30 110 86 200 58 C290 30 340 78 400 48 V120 H0 Z" />
      <path className="waves__mid" d="M0 78 C70 54 140 104 220 80 C300 56 350 96 400 74 V120 H0 Z" />
      <path className="waves__front" d="M0 98 C60 84 120 112 200 98 C280 84 340 110 400 96 V120 H0 Z" />
      <path
        className="waves__line"
        d="M0 70 C40 56 80 84 120 70 C160 56 200 84 240 70 C280 56 320 84 360 70 C380 63 395 66 400 68"
        fill="none"
      />
    </svg>
  );
}

export function Coral({ className = '' }) {
  return (
    <svg className={`coral ${className}`} viewBox="0 0 120 140">
      <g fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="19">
        <path d="M48 160 C47 128 44 110 38 92 C32 76 20 70 18 50 M38 92 C46 78 58 72 60 54 C61 42 56 34 58 20 M44 112 C60 104 76 98 84 80 C88 70 86 60 92 48 M18 50 C14 40 10 34 10 24" />
      </g>
    </svg>
  );
}

export function Seaweed({ className = '' }) {
  return (
    <svg className={`seaweed ${className}`} viewBox="0 0 100 150">
      <path d="M50 150 C44 128 50 112 40 98 C26 100 18 88 28 80 C18 72 22 58 36 62 C30 50 40 38 50 48 C52 34 66 32 66 46 C78 40 86 52 76 60 C88 64 86 78 72 76 C78 88 68 98 60 90 C60 110 64 128 60 150 Z" />
    </svg>
  );
}

export function Starfish({ className = '' }) {
  let d = '';
  for (let i = 0; i < 10; i += 1) {
    const r = i % 2 ? 17 : 42;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    d += `${i ? 'L' : 'M'}${(50 + r * Math.cos(a)).toFixed(1)} ${(52 + r * Math.sin(a)).toFixed(1)} `;
  }
  return (
    <svg className={`starfish ${className}`} viewBox="0 0 100 100">
      <path d={`${d}Z`} strokeWidth="10" strokeLinejoin="round" />
      <g className="starfish__dots">
        <circle cx="50" cy="30" r="2.6" />
        <circle cx="68" cy="46" r="2.6" />
        <circle cx="60" cy="68" r="2.6" />
        <circle cx="40" cy="68" r="2.6" />
        <circle cx="32" cy="46" r="2.6" />
      </g>
    </svg>
  );
}

export function Shell({ className = '' }) {
  return (
    <svg className={`shell ${className}`} viewBox="0 0 100 100">
      <path className="shell__body" d="M50 92 L40 84 C22 76 8 62 8 44 C8 24 26 10 50 10 C74 10 92 24 92 44 C92 62 78 76 60 84 Z" />
      <path className="shell__base" d="M38 84 H62 L58 94 H42 Z" />
      <g className="shell__ribs" fill="none" strokeLinecap="round" strokeWidth="4.5">
        <path d="M50 80 V18 M50 80 L32 22 M50 80 L68 22 M50 80 L18 36 M50 80 L82 36 M50 80 L12 54 M50 80 L88 54" />
      </g>
    </svg>
  );
}

export function Bubbles({ className = '', small = false }) {
  return (
    <svg className={`bubbles ${className}`} viewBox="0 0 40 60" fill="none" strokeWidth="3.4">
      <circle cx="12" cy="14" r={small ? 5 : 7} />
      <circle cx="26" cy="40" r={small ? 4 : 6} />
      {!small && <circle cx="10" cy="52" r="3.5" />}
    </svg>
  );
}

/** Little "sparkle" dashes on both sides of a headline. */
export function Sparkles({ children, className = '' }) {
  const marks = (
    <svg className="sparkles__mark" viewBox="0 0 30 40" aria-hidden="true">
      <path d="M8 6 L18 14 M4 22 H18 M8 36 L18 29" />
    </svg>
  );
  return (
    <div className={`sparkles ${className}`}>
      {marks}
      <div className="sparkles__content">{children}</div>
      {marks}
    </div>
  );
}

/** Big check in a circle with a burst of dashes around it. */
export function CheckBurst() {
  return (
    <svg className="check-burst" viewBox="0 0 200 160" aria-hidden="true">
      <g className="check-burst__rays" strokeLinecap="round" strokeWidth="7">
        <path d="M34 34 L50 46 M24 80 H44 M34 126 L50 114 M166 34 L150 46 M176 80 H156 M166 126 L150 114" />
      </g>
      <circle cx="100" cy="80" r="56" className="check-burst__circle" />
      <path d="M74 82 L92 100 L128 62" className="check-burst__tick" fill="none" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Line-art ship on waves (for "Voting is closed"). */
export function ShipArt() {
  return (
    <svg className="ship-art" viewBox="0 0 180 120" aria-hidden="true" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="5">
      <path d="M86 10 V30 M86 12 L104 18 L86 24" />
      <path d="M70 46 V30 H102 V46" />
      <path d="M58 64 V46 H114 V64" />
      <path className="ship-art__fill" d="M40 64 H140 L126 92 H52 Z" />
      <circle cx="74" cy="56" r="3" className="ship-art__dot" />
      <circle cx="88" cy="56" r="3" className="ship-art__dot" />
      <circle cx="102" cy="56" r="3" className="ship-art__dot" />
      <path d="M10 102 C25 92 40 112 55 102 C70 92 85 112 100 102 C115 92 130 112 145 102 C160 92 168 106 172 102" />
    </svg>
  );
}

/* =====================================================================
   Icons
   ===================================================================== */

const OPTION_ICONS = {
  wave: (
    <g>
      <path d="M3 50 C6 32 20 16 40 16 C55 16 63 27 59 38 C56 46 45 46 43 39 C42 34 45 30 50 30 C44 24 33 26 27 35 C22 42 22 50 22 50 Z" />
      <rect x="2" y="51" width="60" height="7" rx="3.5" />
    </g>
  ),
  island: (
    <g>
      <path d="M8 52 C16 40 48 40 56 52 Z" />
      <path d="M31 44 C31 34 32 26 34 18" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      <path d="M34 18 C26 12 16 14 12 20 C20 18 26 18 34 18 Z M34 18 C40 10 50 10 56 16 C48 16 42 16 34 18 Z M34 18 C30 22 26 30 26 36 C30 28 32 24 34 18 Z M34 18 C40 22 44 28 46 34 C42 28 38 24 34 18 Z" />
    </g>
  ),
  storm: (
    <g>
      <path d="M14 34 C8 34 6 24 14 22 C14 12 28 10 32 18 C36 10 52 12 50 24 C58 24 58 34 50 34 Z" />
      <path d="M30 36 L24 48 H32 L28 60 L42 44 H34 L38 36 Z" />
    </g>
  ),
  lifebuoy: (
    <g>
      <path fillRule="evenodd" d="M32 6 A26 26 0 1 1 31.9 6 Z M32 19 A13 13 0 1 0 32.1 19 Z" />
      <g stroke="var(--cream)" strokeWidth="5">
        <path d="M32 6 V19 M32 45 V58 M6 32 H19 M45 32 H58" />
      </g>
    </g>
  ),
  ship: (
    <g>
      <path d="M10 40 H54 L48 52 H16 Z" />
      <path d="M20 40 V30 H44 V40 Z M28 30 V22 H38 V30 Z" />
    </g>
  ),
  anchor: (
    <g fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round">
      <circle cx="32" cy="12" r="5" />
      <path d="M32 17 V54 M20 26 H44 M10 38 C12 50 22 56 32 56 C42 56 52 50 54 38" />
    </g>
  ),
};

export function OptionIcon({ name }) {
  return (
    <svg className="option-icon" viewBox="0 0 64 64" fill="currentColor" aria-hidden="true">
      {OPTION_ICONS[name] || OPTION_ICONS.wave}
    </svg>
  );
}

export function PeopleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="1.1em" height="1.1em" fill="currentColor" aria-hidden="true">
      <circle cx="9" cy="8" r="3.6" />
      <path d="M2 19.5 C2 15.5 5 13.5 9 13.5 C13 13.5 16 15.5 16 19.5 Z" />
      <circle cx="17" cy="9" r="2.8" />
      <path d="M15.5 13.3 C19.5 13 22 15 22 18.5 H17.6 C17.6 16.4 16.9 14.6 15.5 13.3 Z" />
    </svg>
  );
}

export function TrophyIcon() {
  return (
    <svg viewBox="0 0 48 48" width="1em" height="1em" fill="currentColor" aria-hidden="true">
      <path d="M14 6 H34 V18 C34 25 29 30 24 30 C19 30 14 25 14 18 Z" />
      <path d="M14 10 H6 C6 18 10 22 15 22 M34 10 H42 C42 18 38 22 33 22" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      <path d="M21 30 H27 V36 H21 Z M14 38 H34 V43 H14 Z" />
    </svg>
  );
}

export function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true">
      <path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* =====================================================================
   Small UI bits
   ===================================================================== */

export function CountPill({ count, label = 'joined', theme = 'cream' }) {
  return (
    <span className={`count-pill count-pill--${theme}`}>
      <PeopleIcon />
      <BumpNumber value={count} /> {label}
    </span>
  );
}

export function ConnectionDot({ connection }) {
  if (connection === 'live') return null;
  return (
    <span className="conn" role="status">
      <i aria-hidden="true" />
      {connection === 'connecting' ? 'Connecting…' : 'Reconnecting…'}
    </span>
  );
}

/** Renders text with one part wrapped in a marker. */
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

/** High-contrast QR code (dark blue on white, quiet zone included). */
export function QrCode({ value, className = '' }) {
  return (
    <div className={`qr ${className}`}>
      <QRCodeSVG
        value={value}
        size={512}
        level="M"
        marginSize={2}
        bgColor="#ffffff"
        fgColor="#14247a"
        style={{ width: '100%', height: '100%', display: 'block' }}
        title="Scan to join the vote"
      />
    </div>
  );
}

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

export function Spinner({ label = 'Loading…' }) {
  return (
    <div className="spinner" role="status">
      <span className="spinner__ring" aria-hidden="true" />
      <span className="spinner__label">{label}</span>
    </div>
  );
}

export function GoButton({ label, onClick, disabled, type = 'button', tone = 'go' }) {
  return (
    <button className={`go-btn go-btn--${tone}`} type={type} onClick={onClick} disabled={disabled}>
      <span>{label}</span>
      <span className="go-btn__icon">{tone === 'stop' ? <span className="stop-square" /> : <ArrowIcon />}</span>
    </button>
  );
}
