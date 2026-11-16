import { useCallback, useEffect, useMemo, useState } from 'react';
import { POLL } from '../config/poll.js';
import { rpc } from '../lib/supabase.js';
import { getParticipantId, getItem, setItem, removeItem } from '../lib/storage.js';
import { useLiveSession } from '../hooks/useLiveSession.js';
import { Brand, ConnectionDot, Spinner, Ocean, Highlight, ArrowIcon, CheckIcon, LockIcon } from '../components/ui.jsx';
import { ResultsBars, WinnerBanner } from '../components/ResultsBars.jsx';

/** Retry idempotent calls on network hiccups (classroom Wi-Fi under load). */
async function rpcWithRetry(fn, args, tries = 4) {
  let lastErr;
  for (let i = 0; i < tries; i += 1) {
    try {
      return await rpc(fn, args);
    } catch (err) {
      lastErr = err;
      if (err.code !== 'NETWORK' && err.code !== 'UNKNOWN') throw err;
      await new Promise((r) => setTimeout(r, 500 * (i + 1) + Math.random() * 400));
    }
  }
  throw lastErr;
}

export default function VotePage({ sessionId }) {
  const participantId = useMemo(() => getParticipantId(), []);
  const voteKey = `livevote:vote:${sessionId}`;

  const [phase, setPhase] = useState('loading'); // loading | ready | notfound | error
  const [errorMsg, setErrorMsg] = useState('');
  const [myVote, setMyVote] = useState(() => getItem(voteKey));
  const [pending, setPending] = useState(null);
  const [submitError, setSubmitError] = useState('');

  const { session, setSession, connection, refresh, notFound } = useLiveSession(sessionId, { pollMs: 10000 });

  const rememberVote = useCallback(
    (choice) => {
      if (choice) setItem(voteKey, choice);
      else removeItem(voteKey);
      setMyVote(choice || null);
    },
    [voteKey]
  );

  const join = useCallback(async () => {
    setPhase('loading');
    try {
      const res = await rpcWithRetry('join_session', {
        p_session_id: sessionId,
        p_participant_id: participantId,
      });
      setSession(res.session);
      rememberVote(res.has_voted ? res.choice : null); // server is the source of truth
      setPhase('ready');
    } catch (err) {
      setErrorMsg(err.message);
      setPhase(err.code === 'SESSION_NOT_FOUND' ? 'notfound' : 'error');
    }
  }, [sessionId, participantId, setSession, rememberVote]);

  useEffect(() => {
    join();
  }, [join]);

  useEffect(() => {
    if (notFound && phase === 'ready') setPhase('notfound');
  }, [notFound, phase]);

  const vote = async (choice) => {
    if (pending || myVote || session?.status !== 'voting') return;
    setPending(choice);
    setSubmitError('');
    try {
      navigator.vibrate?.(25);
    } catch {
      /* not supported */
    }
    try {
      const res = await rpcWithRetry('cast_vote', {
        p_session_id: sessionId,
        p_participant_id: participantId,
        p_choice: choice,
      });
      if (res.result === 'counted' || res.result === 'already_voted') {
        rememberVote(res.choice);
      } else {
        refresh();
        setSubmitError('Voting is closed — your vote was not counted.');
      }
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setPending(null);
    }
  };

  /* ---------- render ---------- */

  if (phase === 'loading' || (phase === 'ready' && !session)) {
    return (
      <Shell connection={connection}>
        <div className="center grow">
          <Spinner label="Joining the vote…" />
        </div>
      </Shell>
    );
  }

  if (phase === 'notfound') {
    return (
      <Shell connection={connection}>
        <Message
          tone="error"
          title="Room not found"
          text="This voting room doesn't exist anymore. Scan the QR code on the main screen again."
        />
      </Shell>
    );
  }

  if (phase === 'error') {
    return (
      <Shell connection={connection}>
        <Message tone="error" title="Can't connect" text={errorMsg}>
          <button className="go-btn" onClick={join}>
            <span className="go-btn__icon">
              <ArrowIcon />
            </span>
            <span className="go-btn__label">Try again</span>
          </button>
        </Message>
      </Shell>
    );
  }

  const status = session.status;

  if (myVote) {
    if (status === 'results') {
      return (
        <Shell connection={connection}>
          <div className="card phone-results">
            <p className="eyebrow">{POLL.question}</p>
            <WinnerBanner session={session} variant="compact" />
            <ResultsBars session={session} variant="compact" highlight={myVote} />
          </div>
        </Shell>
      );
    }
    return (
      <Shell connection={connection}>
        <div className="card counted">
          <span className="counted__check" aria-hidden="true">
            <CheckIcon />
          </span>
          <h1 className="h-title counted__title">
            Your vote has been <mark className="hl">counted!</mark>
          </h1>
          <p className="muted">Results will appear right here when the host reveals them.</p>
          <div className={`counted__choice counted__choice--${myVote.toLowerCase()}`}>
            <span className="counted__letter">{myVote}</span>
            <span>{POLL.options[myVote]?.label}</span>
          </div>
        </div>
      </Shell>
    );
  }

  if (status === 'waiting') {
    return (
      <Shell connection={connection}>
        <div className="hero-card lobby">
          <Ocean tone="calm" yacht />
          <div className="hero-card__content">
            <p className="eyebrow eyebrow--light">You&apos;re in</p>
            <h1 className="h-display h-display--light">
              Get <mark className="hl">ready</mark>
            </h1>
            <p className="hero-card__hint">Voting opens as soon as the host starts it. Keep this page open.</p>
            <div className="waiting-ring" aria-hidden="true">
              <span>Wait</span>
            </div>
          </div>
        </div>
        <div className="card lobby__preview">
          <span className="eyebrow">The question</span>
          <p>{POLL.question}</p>
        </div>
      </Shell>
    );
  }

  if (status === 'voting') {
    return (
      <Shell connection={connection}>
        <div className="ballot">
          <p className="eyebrow eyebrow--live">
            <i aria-hidden="true" /> Voting is open
          </p>
          <h1 className="h-title ballot__q">
            <Highlight text={POLL.question} mark={POLL.questionHighlight} />
          </h1>
          <div className="ballot__buttons">
            {['A', 'B'].map((k) => (
              <button
                key={k}
                className={`vote-btn vote-btn--${k.toLowerCase()} ${pending === k ? 'is-pending' : ''} ${
                  pending && pending !== k ? 'is-dim' : ''
                }`}
                onClick={() => vote(k)}
                disabled={Boolean(pending)}
                aria-label={`Vote ${k}: ${POLL.options[k].label}`}
              >
                <Ocean tone={POLL.options[k].tone} />
                <span className="letter-chip">{k}</span>
                <span className="vote-btn__label">{POLL.options[k].label}</span>
                <span className="vote-btn__go">{pending === k ? <span className="mini-spin" /> : <ArrowIcon />}</span>
              </button>
            ))}
          </div>
          {submitError ? (
            <p className="form-error" role="alert">
              {submitError}
            </p>
          ) : (
            <p className="muted ballot__note">One tap. One vote. No take-backs.</p>
          )}
        </div>
      </Shell>
    );
  }

  // closed or results without a vote
  return (
    <Shell connection={connection}>
      {status === 'results' ? (
        <div className="card phone-results">
          <p className="eyebrow">Voting is closed</p>
          <WinnerBanner session={session} variant="compact" />
          <ResultsBars session={session} variant="compact" />
        </div>
      ) : (
        <Message tone="closed" title="Voting is closed" text="No more votes are being accepted." icon={<LockIcon />} />
      )}
    </Shell>
  );
}

function Shell({ children, connection }) {
  return (
    <div className="screen phone">
      <header className="phone__top">
        <Brand compact />
        <ConnectionDot connection={connection} />
      </header>
      <main className="phone__main">{children}</main>
    </div>
  );
}

function Message({ title, text, tone, children, icon = null }) {
  return (
    <div className={`card message message--${tone}`}>
      {icon && <span className="round-icon">{icon}</span>}
      <h1 className="h-title message__title">{title}</h1>
      {text && <p className="muted">{text}</p>}
      {children}
    </div>
  );
}
