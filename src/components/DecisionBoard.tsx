import { useMemo } from 'react';
import { tables, reducers } from '../module_bindings';
import { useTable, useReducer, useSpacetimeDB } from 'spacetimedb/react';
import { colors, fonts } from '../theme';

export default function DecisionBoard() {
  const { identity } = useSpacetimeDB();
  const [decisions] = useTable(tables.decision);
  const [options] = useTable(tables.decision_option);
  const [votes] = useTable(tables.vote);
  const castVote = useReducer(reducers.castVote);

  const myHex = identity?.toHexString();

  const sortedDecisions = useMemo(
    () => [...decisions].sort((a, b) => Number(a.id - b.id)),
    [decisions]
  );

  return (
    <div>
      <h2
        style={{
          fontFamily: fonts.serif,
          fontWeight: 400,
          fontSize: 22,
          color: colors.ink2,
          margin: '0 0 16px',
        }}
      >
        Decisions
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {sortedDecisions.map(decision => {
          const decisionOptions = options.filter(
            o => o.decisionId === decision.id
          );
          const decisionVotes = votes.filter(v => v.decisionId === decision.id);
          const myVote = decisionVotes.find(
            v => v.voterIdentity.toHexString() === myHex
          );

          return (
            <div
              key={String(decision.id)}
              style={{
                background: '#FFFFFF',
                border: `1px solid ${colors.hairline}`,
                borderRadius: 16,
                padding: 16,
              }}
            >
              <b style={{ display: 'block', fontSize: 16, marginBottom: 10 }}>
                {decision.title}
              </b>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {decisionOptions.map(opt => {
                  const count = decisionVotes.filter(
                    v => v.optionId === opt.id
                  ).length;
                  const mine = myVote?.optionId === opt.id;
                  return (
                    <button
                      key={String(opt.id)}
                      type="button"
                      onClick={() =>
                        castVote({ decisionId: decision.id, optionId: opt.id })
                      }
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: 12,
                        border: `2px solid ${mine ? colors.green : colors.hairline}`,
                        background: mine ? colors.greenTint : '#FFFFFF',
                        color: colors.ink2,
                        fontFamily: fonts.ui,
                        fontSize: 15,
                        fontWeight: mine ? 700 : 500,
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <span>{opt.label}</span>
                      <span style={{ color: colors.muted, fontSize: 13 }}>
                        {count} vote{count === 1 ? '' : 's'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
        {sortedDecisions.length === 0 && (
          <p style={{ color: colors.muted, fontSize: 14 }}>
            No decisions yet.
          </p>
        )}
      </div>
    </div>
  );
}
