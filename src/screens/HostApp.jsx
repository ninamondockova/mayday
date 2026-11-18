import { useCallback, useEffect, useState } from 'react';
import { POLL, APP_TAGLINE } from '../config/poll.js';
import { rpc } from '../lib/supabase.js';
import { loadHost, saveHost, clearHost } from '../lib/storage.js';
import { voteUrl, screenUrl, prettyUrl, isLocalHostUrl } from '../lib/results.js';
import { useLiveSession } from '../hooks/useLiveSession.js';
import {
  Scene,
  ConnectionDot,
  AnimatedNumber,
  BumpNumber,
  Spinner,
  Sparkles,
  ShipArt,
  OptionIcon,
  GoButton,
  CountPill,
  CheckIcon,
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
      <Scene theme="cream">
        <div className="stack stack--center grow">
          <Spinner label="Restoring session…" />
        </div>
      </Scene>
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
      <label htmlFor="passcode" className="label">
        Host passcode
      </label>
      <input
        id="passcode"
        type="password"
        autoComplete="current-password"
        value={passcode}
        onChange={(e) => setPasscode(e.target.value)}
        autoFocus={autoFocus}
        placeholder="••••••"
      />
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      <GoButton type="submit" disabled={!passcode || busy} label={busy ? 'Opening…' : submitLabel} />
    </form>
  );
}

function HostLogin({ onCreated }) {
  return (
    <Scene theme="cream" right={<span className="tag">Host</span>}>
      <div className="stack stack--center grow">
        <Sparkles>
          <h1 className="title title--lg">
            Host
            <br />
            the vote
          </h1>
        </Sparkles>
        <p className="lead">{APP_TAGLINE}. You run the whole vote from this phone.</p>
        <div className="panel">
          <PasscodeForm onCreated={onCreated} />
        </div>
      </div>
    </Scene>
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
      <Scene theme="cream">
        <div className="stack stack--center grow">
          <Spinner label="Connecting to the voting room…" />
        </div>
      </Scene>
    );
  }

  const status = session.status;
  const voted = session.votes_a + session.votes_b;
  const joined = Math.max(session.joined_count, voted);
  const theme = status === 'voting' || status === 'closed' ? 'blue' : 'cream';
  const right = (
    <div className="top-right">
      <ConnectionDot connection={connection} />
      <CountPill
        count={status === 'results' ? voted : joined}
        label={status === 'results' ? 'total votes' : 'joined'}
        theme={theme}
      />
    </div>
  );

  const footer = (
    <div className="host-footer">
      <span className="host-code">Room #{session.id}</span>
      <button className="link-btn" onClick={() => setShowNew(true)}>
        New session
      </button>
    </div>
  );

  return (
    <>
      <Scene theme={theme} decor={status === 'closed' ? 'closed' : 'default'} right={right} key={status}>
        <div className="stack grow">
          {status === 'waiting' && (
            <>
              <Sparkles>
                <h1 className="title title--lg">
                  Waiting for
                  <br />
                  the class
                </h1>
              </Sparkles>
              <div className="big-count">
                <BumpNumber value={session.joined_count} />
                <span>{session.joined_count === 1 ? 'person on board' : 'people on board'}</span>
              </div>
              <ScreenLinkCard sessionId={session.id} />
              <GoButton label="Start voting" disabled={busy} onClick={() => setStatus('voting')} />
            </>
          )}

          {status === 'voting' && (
            <>
              <Sparkles>
                <h1 className="title title--lg">{POLL.question}</h1>
              </Sparkles>
              <div className="choices choices--host">
                {['A', 'B'].map((k) => (
                  <div key={k} className="choice choice--static">
                    <OptionIcon name={POLL.options[k].icon} />
                    <span className="choice__label">{POLL.options[k].label}</span>
                    <span className="choice__count">
                      <BumpNumber value={k === 'A' ? session.votes_a : session.votes_b} />
                    </span>
                  </div>
                ))}
              </div>
              <VoteProgress joined={joined} voted={voted} />
              <GoButton tone="stop" label="Close voting" disabled={busy} onClick={() => setStatus('closed')} />
            </>
          )}

          {status === 'closed' && (
            <>
              <div className="stack stack--center">
                <ShipArt />
                <h1 className="title title--lg">Voting is closed</h1>
                <p className="lead">
                  <AnimatedNumber value={voted} /> {voted === 1 ? 'vote is in' : 'votes are in'}. Reveal them when the
                  class is ready.
                </p>
              </div>
              <GoButton label="Reveal results" disabled={busy} onClick={() => setStatus('results')} />
              <button className="link-btn" disabled={busy} onClick={() => setStatus('voting')}>
                Reopen voting
              </button>
            </>
          )}

          {status === 'results' && (
            <>
              <ResultsBars session={session} />
              <WinnerBanner session={session} />
              <button className="link-btn" disabled={busy} onClick={() => setStatus('closed')}>
                Hide results
              </button>
            </>
          )}

          {error && (
            <p className="notice" role="alert">
              {error}
            </p>
          )}
          {footer}
        </div>
      </Scene>

      {showNew && (
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="new-title">
          <div className="modal__card">
            <h2 id="new-title" className="title title--md">
              Start a new session?
            </h2>
            <p className="lead">New QR code, zero votes. Room #{session.id} stays saved in the database.</p>
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
    </>
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
    <div className="panel screen-card">
      <span className="label">Big screen</span>
      <p className="screen-card__text">
        Open this link on the projector — it shows <b>only the QR code</b>.
      </p>
      <div className="screen-card__link">{prettyUrl(link)}</div>
      <div className="screen-card__actions">
        <button className="pill-btn pill-btn--solid" onClick={copy}>
          {copied ? (
            <>
              <CheckIcon /> Copied
            </>
          ) : (
            'Copy link'
          )}
        </button>
        <a className="pill-btn" href={link} target="_blank" rel="noreferrer">
          Open ↗
        </a>
      </div>
      {isLocalHostUrl(voteUrl(sessionId)) && (
        <p className="notice">Phones can&apos;t open localhost — use the deployed site or set VITE_PUBLIC_APP_URL.</p>
      )}
    </div>
  );
}

function VoteProgress({ joined, voted }) {
  const share = joined ? Math.round((voted / joined) * 100) : 0;
  return (
    <div className="vote-progress">
      <div className="vote-progress__row">
        <span>
          <b>
            <BumpNumber value={voted} />
          </b>{' '}
          of {joined} voted
        </span>
        <span>{share}%</span>
      </div>
      <div className="vote-progress__track" aria-hidden="true">
        <div className="vote-progress__fill" style={{ width: `${share}%` }} />
      </div>
    </div>
  );
}
