import { useCallback, useEffect, useMemo, useState } from 'react';
import { POLL } from '../config/poll.js';
import { rpc } from '../lib/supabase.js';
import { getParticipantId, getItem, setItem, removeItem } from '../lib/storage.js';
import { useLiveSession } from '../hooks/useLiveSession.js';
import { Scene, ConnectionDot, Spinner, Sparkles, CheckBurst, ShipArt, OptionIcon, GoButton, CountPill } from '../components/ui.jsx';
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

  const conn = <ConnectionDot connection={connection} />;
  const live = connection === 'live';

  if (phase === 'loading' || (phase === 'ready' && !session)) {
    return (
      <Scene theme="cream" right={conn}>
        <div className="stack stack--center grow">
          <Spinner label="Joining the vote…" />
        </div>
      </Scene>
    );
  }

  if (phase === 'notfound' || phase === 'error') {
    return (
      <Scene theme="blue" right={conn}>
        <div className="stack stack--center grow">
          <ShipArt />
          <h1 className="title title--lg">{phase === 'notfound' ? 'Room not found' : "Can't connect"}</h1>
          <p className="lead">
            {phase === 'notfound' ? 'Scan the QR code on the main screen again.' : errorMsg}
          </p>
          {phase === 'error' && <GoButton label="Try again" onClick={join} />}
        </div>
      </Scene>
    );
  }

  const status = session.status;
  const pill = (theme) => <CountPill count={session.joined_count} theme={theme} />;

  // Results are revealed: everyone sees them (with their own vote marked)
  if (status === 'results') {
    return (
      <Scene theme="cream" right={<CountPill count={session.votes_a + session.votes_b} label="total votes" />}>
        <div className="stack grow">
          <ResultsBars session={session} highlight={myVote} />
          <WinnerBanner session={session} />
        </div>
      </Scene>
    );
  }

  if (myVote) {
    return (
      <Scene theme="cream" right={live ? pill('cream') : conn}>
        <div className="stack stack--center grow">
          <CheckBurst />
          <h1 className="title title--lg">
            Your vote
            <br />
            has been counted!
          </h1>
          <p className="chip">
            <OptionIcon name={POLL.options[myVote]?.icon} />
            {POLL.options[myVote]?.label}
          </p>
          <p className="lead">The results will appear here when the host reveals them.</p>
        </div>
      </Scene>
    );
  }

  if (status === 'waiting') {
    return (
      <Scene theme="cream" right={live ? pill('cream') : conn}>
        <div className="stack stack--center grow">
          <Sparkles>
            <h1 className="title title--lg">
              You&apos;re
              <br />
              on board!
            </h1>
          </Sparkles>
          <p className="lead">Voting starts as soon as the host opens it. Keep this page open.</p>
          <div className="dots" aria-hidden="true">
            <i /> <i /> <i />
          </div>
          <div className="preview">
            <span className="preview__label">The question</span>
            <span className="preview__text">{POLL.question}</span>
          </div>
        </div>
      </Scene>
    );
  }

  if (status === 'voting') {
    return (
      <Scene theme="blue" right={live ? pill('blue') : conn}>
        <div className="stack grow">
          <Sparkles>
            <h1 className="title title--lg">{POLL.question}</h1>
          </Sparkles>
          <div className="choices">
            {['A', 'B'].map((k) => (
              <button
                key={k}
                className={`choice ${pending === k ? 'is-pending' : ''} ${pending && pending !== k ? 'is-dim' : ''}`}
                onClick={() => vote(k)}
                disabled={Boolean(pending)}
                aria-label={`Vote ${k}: ${POLL.options[k].label}`}
              >
                <OptionIcon name={POLL.options[k].icon} />
                <span className="choice__label">{POLL.options[k].label}</span>
                {pending === k && <span className="choice__sending">Sending…</span>}
              </button>
            ))}
          </div>
          {submitError ? (
            <p className="notice" role="alert">
              {submitError}
            </p>
          ) : (
            <p className="hint">One tap · one vote</p>
          )}
        </div>
      </Scene>
    );
  }

  // closed (participant did not vote)
  return (
    <Scene theme="blue" decor="closed" right={conn}>
      <div className="stack stack--center grow">
        <ShipArt />
        <h1 className="title title--lg">Voting is closed</h1>
        <p className="lead">Thanks for participating!</p>
      </div>
    </Scene>
  );
}
