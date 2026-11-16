import { useEffect, useState } from 'react';
import { POLL } from '../config/poll.js';
import { computeResults } from '../lib/results.js';
import { AnimatedNumber, CheckIcon } from './ui.jsx';

/**
 * Two big percentage bars. Bars grow from 0 on mount and animate on every update.
 * variant: 'stage' (projector) | 'compact' (phone)
 */
export function ResultsBars({ session, variant = 'stage', highlight = null }) {
  const r = computeResults(session);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setReady(true)));
    return () => cancelAnimationFrame(id);
  }, []);

  const rows = [
    { key: 'A', votes: r.a, pct: r.pctA },
    { key: 'B', votes: r.b, pct: r.pctB },
  ];

  return (
    <div className={`results results--${variant}`}>
      {rows.map((row, i) => {
        const isWinner = r.winner === row.key;
        const isLoser = r.winner && r.winner !== 'TIE' && !isWinner;
        return (
          <div
            key={row.key}
            className={`result result--${row.key.toLowerCase()} ${isWinner ? 'is-winner' : ''} ${
              isLoser ? 'is-loser' : ''
            }`}
            style={{ '--delay': `${i * 160}ms` }}
          >
            <div className="result__head">
              <span className="result__letter">{row.key}</span>
              <span className="result__label">{POLL.options[row.key].label}</span>
              {isWinner && <span className="result__crown">Winner</span>}
              {highlight === row.key && (
                <span className="result__mine">
                  <CheckIcon /> Your vote
                </span>
              )}
              <span className="result__votes">
                <AnimatedNumber value={row.votes} /> {row.votes === 1 ? 'vote' : 'votes'}
              </span>
            </div>
            <div className="result__track">
              <div className="result__fill" style={{ width: ready ? `${Math.max(row.pct, 0)}%` : '0%' }}>
                <span className="result__pct">
                  <AnimatedNumber value={ready ? row.pct : 0} duration={1400} />%
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function WinnerBanner({ session, variant = 'stage' }) {
  const r = computeResults(session);
  if (r.winner === null) {
    return (
      <div className={`winner winner--none winner--${variant}`}>
        <span className="winner__kicker">Results</span>
        <span className="winner__name">No votes were cast</span>
      </div>
    );
  }
  if (r.winner === 'TIE') {
    return (
      <div className={`winner winner--tie winner--${variant}`}>
        <span className="winner__kicker">Dead even</span>
        <span className="winner__name">
          It&apos;s a <mark className="hl">tie</mark>
        </span>
      </div>
    );
  }
  return (
    <div className={`winner winner--${r.winner.toLowerCase()} winner--${variant}`}>
      <span className="winner__kicker">The class has decided</span>
      <span className="winner__name">
        <mark className="hl">{POLL.options[r.winner].label}</mark>
      </span>
    </div>
  );
}
