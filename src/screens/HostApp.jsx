import { useCallback, useEffect, useState } from 'react';
import { POLL, APP_TAGLINE } from '../config/poll.js';
import { rpc } from '../lib/supabase.js';
import { loadHost, saveHost, clearHost } from '../lib/storage.js';
import { voteUrl, screenUrl, prettyUrl, isLocalHostUrl } from '../lib/results.js';
import { useLiveSession } from '../hooks/useLiveSession.js';
import {
  Brand,
  StatusPill,
  ConnectionDot,
  AnimatedNumber,
  BumpNumber,
  PeopleStack,
  Ocean,
  Highlight,
  ArrowIcon,
  CheckIcon,
  LockIcon,
  Spinner,
} from '../components/ui.jsx';
import { ResultsBars, WinnerBanner } from '../components/ResultsBars.jsx';

export default function HostApp() {
  const [host, setHost] = useState(() => loadHost());
  const [checking, setChecking] = useState(() => Boolean(loadHost()));

  // On reload, make sure the stored host secret is still valid.
  useEffect(() => {
    if (!host) return;
    let cancelled = false;
    rpc('verify_host', { p_session_id: host.sessionId, p_host_secret: host.hostSecret })
      .then((ok) => {
        if (cancelled) return;
        if (!ok) {
          clearHost();
          setHost(null);
        }
      })
      .catch(() => {
        /* offline: keep the stored session and let the stage reconnect */
      })
      .finally(() => !cancelled && setChecking(false));
    return () => {
      cancelled = true;
    };
    // only on first load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onCreated = useCallback((sessionId, hostSecret) => {
    saveHost(sessionId, hostSecret);
    setHost({ sessionId, hostSecret });
  }, []);

  const onLost = useCallback(() => {
    clearHost();
    setHost(null);
  }, []);

  if (checking) {
    return (
      <div className="screen phone center">
        <Spinner label="Restoring session…" />
      </div>
    );
  }

  if (!host) return <HostLogin onCreated={onCreated} />;

  return <HostStage key={host.sessionId} host={host} onCreated={onCreated} onLost={onLost} />;
}

/* ------------------------------------------------------------------ */

function PasscodeForm({ onCreated, submitLabel = 'Open voting room', autoFocus = false }) {
  const [passcode, setPasscode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (!passcode || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await rpc('create_session', { p_passcode: passcode });
      onCreated(res.session_id, res.host_secret);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <form className="passcode" onSubmit={submit}>
      <label htmlFor="passcode" className="eyebrow">
        Host passcode
      </label>
      <input
        id="passcode"
        type="password"
        autoComplete="current-password"
        value={passcode}
        onChange={(e) => setPasscode(e.target.value)}
        autoFocus={autoFocus}
        placeholder="••••••••"
      />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <GoButton type="submit" disabled={!passcode || busy} label={busy ? 'Opening…' : submitLabel} />
    </form>
  );
}

function GoButton({ label, onClick, disabled, type = 'button', tone = 'go' }) {
  return (
    <button className={`go-btn go-btn--${tone}`} type={type} onClick={onClick} disabled={disabled}>
      <span className="go-btn__icon">
        {tone === 'stop' ? <span className="stop-square" aria-hidden="true" /> : <ArrowIcon />}
      </span>
      <span className="go-btn__label">{label}</span>
      <span className="go-btn__chev" aria-hidden="true">
        »
      </span>
    </button>
  );
}

function HostLogin({ onCreated }) {
  return (
    <div className="screen phone">
      <header className="phone__top">
        <Brand compact />
        <span className="conn">Host</span>
      </header>
      <main className="phone__main">
        <div className="hero-card host-hero">
          <Ocean tone="calm" yacht />
          <div className="hero-card__content">
            <p className="eyebrow eyebrow--light">{APP_TAGLINE}</p>
            <h1 className="h-display h-display--light">
              Let&apos;s start <mark className="hl">the vote</mark>
            </h1>
          </div>
        </div>
        <div className="card">
          <p className="muted">Enter the host passcode to open a new voting room. You control everything from this phone.</p>
          <PasscodeForm onCreated={onCreated} />
        </div>
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function HostStage({ host, onCreated, onLost }) {
  const { session, setSession, connection, notFound } = useLiveSession(host.sessionId, { pollMs: 5000 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    if (notFound) onLost();
  }, [notFound, onLost]);

  const setStatus = async (status) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const row = await rpc('set_session_status', {
        p_session_id: host.sessionId,
        p_host_secret: host.hostSecret,
        p_status: status,
      });
      setSession(row);
    } catch (err) {
      if (err.code === 'HOST_UNAUTHORIZED') onLost();
      else setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (!session) {
    return (
      <div className="screen phone center">
        <Spinner label="Connecting to the voting room…" />
      </div>
    );
  }

  const status = session.status;
  const voted = session.votes_a + session.votes_b;
  const joined = Math.max(session.joined_count, voted);

  return (
    <div className="screen phone">
      <header className="phone__top">
        <Brand compact />
        <div className="phone__top-right">
          <ConnectionDot connection={connection} />
          <button className="chip-btn" onClick={() => setShowNew(true)}>
            New
          </button>
        </div>
      </header>

      <main className="phone__main host-panel" key={status}>
        <div className="host-panel__status">
          <StatusPill status={status} />
          <span className="host__code">#{session.id}</span>
        </div>

        {status === 'waiting' && (
          <>
            <div className="hero-card host-hero">
              <Ocean tone="calm" yacht />
              <div className="hero-card__content">
                <p className="eyebrow eyebrow--light">Joined so far</p>
                <div className="host-hero__count">
                  <BumpNumber value={session.joined_count} />
                </div>
                <PeopleStack count={session.joined_count} />
              </div>
            </div>
            <ScreenLinkCard sessionId={session.id} />
            <GoButton label="Start voting" disabled={busy} onClick={() => setStatus('voting')} />
          </>
        )}

        {status === 'voting' && (
          <>
            <div>
              <p className="eyebrow eyebrow--live">
                <i aria-hidden="true" /> Voting is open
              </p>
              <h1 className="h-title">
                <Highlight text={POLL.question} mark={POLL.questionHighlight} />
              </h1>
            </div>
            <VoteStats joined={joined} voted={voted} />
            <LiveSplit session={session} />
            <GoButton tone="stop" label="Close voting" disabled={busy} onClick={() => setStatus('closed')} />
          </>
        )}

        {status === 'closed' && (
          <>
            <div className="card closed-card">
              <span className="round-icon">
                <LockIcon />
              </span>
              <h1 className="h-title">
                Voting is <mark className="hl">closed</mark>
              </h1>
              <p className="closed-card__total">
                <span className="closed-card__num">
                  <AnimatedNumber value={voted} />
                </span>
                {voted === 1 ? 'vote is in' : 'votes are in'}
              </p>
              <p className="muted">Students see “Voting is closed”. Reveal the results when you&apos;re ready.</p>
            </div>
            <GoButton label="Reveal results" disabled={busy} onClick={() => setStatus('results')} />
            <button className="link-btn" disabled={busy} onClick={() => setStatus('voting')}>
              Reopen voting
            </button>
          </>
        )}

        {status === 'results' && (
          <>
            <div className="card phone-results">
              <p className="eyebrow">{POLL.question}</p>
              <WinnerBanner session={session} variant="compact" />
              <ResultsBars session={session} variant="compact" />
              <p className="muted results-total">
                Total votes: <b>{voted}</b>
              </p>
            </div>
            <GoButton label="New session" onClick={() => setShowNew(true)} />
            <button className="link-btn" disabled={busy} onClick={() => setStatus('closed')}>
              Hide results
            </button>
          </>
        )}

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </main>

      {showNew && (
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="new-title">
          <div className="modal__card">
            <h2 id="new-title" className="h-title">
              Start a <mark className="hl">new session?</mark>
            </h2>
            <p className="muted">
              New QR code, zero votes. The current session (#{session.id}) stays saved in the database.
            </p>
            <PasscodeForm
              submitLabel="Create new session"
              onCreated={(id, secret) => {
                setShowNew(false);
                onCreated(id, secret);
              }}
            />
            <button className="link-btn" onClick={() => setShowNew(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function ScreenLinkCard({ sessionId }) {
  const link = screenUrl(sessionId);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      const t = document.createElement('textarea');
      t.value = link;
      document.body.appendChild(t);
      t.select();
      document.execCommand('copy');
      t.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="card screen-card">
      <p className="eyebrow">Big screen</p>
      <p className="screen-card__text">
        Open this link on the projector. It shows <b>only the QR code</b>.
      </p>
      <div className="screen-card__link">{prettyUrl(link)}</div>
      <div className="screen-card__actions">
        <button className="chip-btn chip-btn--dark" onClick={copy}>
          {copied ? (
            <>
              <CheckIcon /> Copied
            </>
          ) : (
            'Copy link'
          )}
        </button>
        <a className="chip-btn" href={link} target="_blank" rel="noreferrer">
          Open ↗
        </a>
      </div>
      {isLocalHostUrl(voteUrl(sessionId)) && (
        <p className="form-error">Phones can&apos;t open localhost — use the deployed site or set VITE_PUBLIC_APP_URL.</p>
      )}
    </div>
  );
}

function VoteStats({ joined, voted }) {
  const share = joined ? Math.round((voted / joined) * 100) : 0;
  return (
    <div className="card vote-stats">
      <div className="vote-stats__row">
        <div>
          <span className="eyebrow">Joined</span>
          <span className="stat__num">
            <BumpNumber value={joined} />
          </span>
        </div>
        <div>
          <span className="eyebrow">Voted</span>
          <span className="stat__num">
            <BumpNumber value={voted} />
          </span>
        </div>
        <span className="tag">{share}%</span>
      </div>
      <div className="progress" aria-hidden="true">
        <div className="progress__fill" style={{ width: `${share}%` }} />
      </div>
    </div>
  );
}

/** Live A/B counts — only on the host's phone. */
function LiveSplit({ session }) {
  return (
    <div className="live-split">
      {['A', 'B'].map((k) => (
        <div key={k} className="live-split__item">
          <Ocean tone={POLL.options[k].tone} />
          <div className="live-split__content">
            <span className="letter-chip">{k}</span>
            <span className="live-split__label">{POLL.options[k].label}</span>
            <span className="live-split__num">
              <BumpNumber value={k === 'A' ? session.votes_a : session.votes_b} />
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
