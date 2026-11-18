import { useEffect, useState } from 'react';
import { POLL } from '../config/poll.js';
import { computeResults } from '../lib/results.js';
import { AnimatedNumber, CheckIcon, TrophyIcon, Sparkles } from './ui.jsx';

/** "Results" title + two bars (label, %, bar, votes). Bars grow from 0 and animate on updates. */
export function ResultsBars({ session, highlight = null }) {
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
    <div className="results">
      <Sparkles>
        <h1 className="title title--xl">Results</h1>
      </Sparkles>
      {rows.map((row, i) => {
        const isWinner = r.winner === row.key;
        return (
          <div
            key={row.key}
            className={`result ${isWinner ? 'is-winner' : ''}`}
            style={{ '--delay': `${200 + i * 180}ms` }}
          >
            <div className="result__head">
              <span className="result__label">
                {POLL.options[row.key].label}
                {highlight === row.key && (
                  <span className="result__mine">
                    <CheckIcon /> your vote
                  </span>
                )}
              </span>
              <span className="result__pct">
                <AnimatedNumber value={ready ? row.pct : 0} duration={1400} />%
              </span>
            </div>
            <div className="result__track">
              <div className="result__fill" style={{ width: ready ? `${row.pct}%` : '0%' }} />
            </div>
            <div className="result__votes">
              <AnimatedNumber value={row.votes} /> {row.votes === 1 ? 'vote' : 'votes'}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function WinnerBanner({ session }) {
  const r = computeResults(session);
  let title = 'Winner:';
  let text = r.winner && r.winner !== 'TIE' ? `${POLL.options[r.winner].label}!` : '';
  if (r.winner === 'TIE') {
    title = "It's a tie!";
    text = 'Both options got the same number of votes.';
  } else if (r.winner === null) {
    title = 'No votes';
    text = 'Nobody voted this time.';
  }
  return (
    <div className="winner">
      <span className="winner__icon">
        <TrophyIcon />
      </span>
      <span className="winner__text">
        <b>{title}</b>
        <span>{text}</span>
      </span>
    </div>
  );
}
