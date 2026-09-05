import { useMemo, useState } from 'react';
import { tables, reducers } from '../module_bindings';
import { useTable, useReducer, useSpacetimeDB } from 'spacetimedb/react';
import { colors, fonts } from '../theme';

export default function DecisionBoard() {
  const { identity } = useSpacetimeDB();
  const [decisions] = useTable(tables.decision);
  const [options] = useTable(tables.decision_option);
  const [votes] = useTable(tables.vote);
  const [participants] = useTable(tables.participant);
  const castVote = useReducer(reducers.castVote);
  const setDecider = useReducer(reducers.setDecider);
  const lockDecision = useReducer(reducers.lockDecision);

  const [pickingDeciderFor, setPickingDeciderFor] = useState<bigint | null>(
    null
  );

  const myHex = identity?.toHexString();
  const me = participants.find(p => p.identity.toHexString() === myHex);
  const iAmAdmin = me?.role === 'couple' || me?.role === 'planner';

  const nameFor = (hex: string) =>
    participants.find(p => p.identity.toHexString() === hex)?.name ??
    'Someone';

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
          const isLocked = decision.lockedOptionId !== undefined;
          const lockedOption = decisionOptions.find(
            o => o.id === decision.lockedOptionId
          );
          const deciderHex = decision.deciderIdentity?.toHexString();
          const iAmDecider = deciderHex !== undefined && deciderHex === myHex;
          const canLock = iAmDecider || me?.role === 'couple';

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
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: 8,
                  marginBottom: 10,
                }}
              >
                <b style={{ fontSize: 16 }}>{decision.title}</b>
                {isLocked && (
                  <span
                    style={{
                      flex: 'none',
                      fontSize: 11,
                      fontWeight: 700,
                      color: colors.green,
                      background: colors.greenTint,
                      borderRadius: 999,
                      padding: '4px 10px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Decided
                  </span>
                )}
              </div>

              <div style={{ marginBottom: 10 }}>
                {deciderHex ? (
                  <span style={{ fontSize: 12, color: colors.muted }}>
                    {nameFor(deciderHex)} decides
                    {deciderHex === myHex ? ' (you)' : ''}
                  </span>
                ) : iAmAdmin ? (
                  <span style={{ fontSize: 12, color: colors.muted }}>
                    No decider set
                  </span>
                ) : null}
                {iAmAdmin && !isLocked && (
                  <button
                    type="button"
                    onClick={() =>
                      setPickingDeciderFor(
                        pickingDeciderFor === decision.id ? null : decision.id
                      )
                    }
                    style={{
                      marginLeft: 8,
                      border: 'none',
                      background: 'none',
                      color: colors.green,
                      fontFamily: fonts.ui,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    {deciderHex ? 'Change' : 'Set decider'}
                  </button>
                )}
              </div>

              {pickingDeciderFor === decision.id && (
                <select
                  autoFocus
                  defaultValue=""
                  onChange={e => {
                    if (!e.target.value) return;
                    const p = participants.find(
                      p => p.identity.toHexString() === e.target.value
                    );
                    if (p) setDecider({ decisionId: decision.id, identity: p.identity });
                    setPickingDeciderFor(null);
                  }}
                  style={{
                    marginBottom: 10,
                    width: '100%',
                    height: 36,
                    borderRadius: 10,
                    border: `1px solid ${colors.hairline}`,
                    fontFamily: fonts.ui,
                    fontSize: 13,
                    padding: '0 10px',
                  }}
                >
                  <option value="" disabled>
                    Choose a decider…
                  </option>
                  {participants.map(p => (
                    <option key={p.identity.toHexString()} value={p.identity.toHexString()}>
                      {p.name}
                    </option>
                  ))}
                </select>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {decisionOptions.map(opt => {
                  const count = decisionVotes.filter(
                    v => v.optionId === opt.id
                  ).length;
                  const mine = myVote?.optionId === opt.id;
                  const isWinner = isLocked && opt.id === decision.lockedOptionId;
                  return (
                    <div
                      key={String(opt.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <button
                        type="button"
                        disabled={isLocked}
                        onClick={() =>
                          castVote({ decisionId: decision.id, optionId: opt.id })
                        }
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flex: 1,
                          minWidth: 0,
                          padding: '10px 14px',
                          borderRadius: 12,
                          border: `2px solid ${
                            isWinner
                              ? colors.green
                              : mine
                                ? colors.green
                                : colors.hairline
                          }`,
                          background: isWinner
                            ? colors.greenTint
                            : mine
                              ? colors.greenTint
                              : '#FFFFFF',
                          color: colors.ink2,
                          fontFamily: fonts.ui,
                          fontSize: 15,
                          fontWeight: mine || isWinner ? 700 : 500,
                          cursor: isLocked ? 'default' : 'pointer',
                          textAlign: 'left',
                          opacity: isLocked && !isWinner ? 0.55 : 1,
                        }}
                      >
                        <span>{opt.label}</span>
                        <span style={{ color: colors.muted, fontSize: 13 }}>
                          {count} vote{count === 1 ? '' : 's'}
                        </span>
                      </button>
                      {canLock && !isLocked && (
                        <button
                          type="button"
                          onClick={() =>
                            lockDecision({
                              decisionId: decision.id,
                              optionId: opt.id,
                            })
                          }
                          title="Lock in this option"
                          style={{
                            flex: 'none',
                            height: 40,
                            padding: '0 10px',
                            borderRadius: 10,
                            border: `1px solid ${colors.green}`,
                            background: '#FFFFFF',
                            color: colors.green,
                            fontFamily: fonts.ui,
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Lock
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {isLocked && lockedOption && (
                <p style={{ margin: '10px 0 0', fontSize: 13, color: colors.green }}>
                  Decided: {lockedOption.label}
                </p>
              )}
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
