import { useMemo, useState } from 'react';
import { Check, ChevronRight, Crown, LockKeyhole } from 'lucide-react';
import { tables, reducers } from '../module_bindings';
import { useReducer, useSpacetimeDB, useTable } from 'spacetimedb/react';

export default function DecisionBoard({ weddingId }: { weddingId: bigint }) {
  const { identity } = useSpacetimeDB();
  const [decisions] = useTable(tables.decision);
  const [options] = useTable(tables.decisionOption);
  const [votes] = useTable(tables.vote);
  const [participants] = useTable(tables.participant);
  const castVote = useReducer(reducers.castVote);
  const lockDecision = useReducer(reducers.lockDecision);
  const setDecider = useReducer(reducers.setDecider);
  const [choice, setChoice] = useState<bigint | undefined>();
  const [showAll, setShowAll] = useState(false);
  const myHex = identity?.toHexString();
  const me = participants.find(row => row.identity.toHexString() === myHex);
  const next = useMemo(() => [...decisions].filter(row => row.weddingId === weddingId && row.lockedOptionId === undefined).sort((a, b) => Number(a.id - b.id))[0], [decisions, weddingId]);

  if (!next) return <div className="empty-state"><Check size={28}/><h1 className="headline">Every decision is settled</h1><p>New choices from your wedding team will appear here.</p></div>;

  const decisionOptions = options.filter(row => row.decisionId === next.id);
  const myVote = votes.find(row => row.decisionId === next.id && row.voterIdentity.toHexString() === myHex);
  const picked = choice ?? myVote?.optionId;
  const decider = next.deciderIdentity
    ? participants.find(row => row.identity.equals(next.deciderIdentity!))
    : undefined;
  const iCanDecide = next.deciderIdentity?.toHexString() === myHex || me?.role === 'couple';
  const count = (optionId: bigint) => votes.filter(row => row.decisionId === next.id && row.optionId === optionId).length;
  const submitVote = () => { if (picked !== undefined) castVote({ decisionId: next.id, optionId: picked }); };

  return <div className="decision-page">
    <p className="eyebrow">Decisions</p>
    <h1 className="decision-question">{next.title}</h1>
    <p className="decision-meta">Your vote helps the named decider choose. It doesn’t replace their final call.</p>
    <div className="decision-options">
      {decisionOptions.slice(0, showAll ? undefined : 3).map((option, index) => {
        const active = picked === option.id;
        return <button key={String(option.id)} type="button" className={`decision-option ${active ? 'selected' : ''}`} onClick={() => setChoice(option.id)}>
          <span className={`option-swatch swatch-${index % 3}`} aria-hidden />
          <span className="option-name">{option.label}</span>
          <span className="option-votes">{count(option.id)} vote{count(option.id) === 1 ? '' : 's'}</span>
          {active ? <Check size={18} className="option-check"/> : <ChevronRight size={18} className="option-arrow"/>}
        </button>;
      })}
    </div>
    {decisionOptions.length > 3 && <button className="ghost-button" onClick={() => setShowAll(value => !value)}>{showAll ? 'Show fewer options' : `See all ${decisionOptions.length} options`}</button>}
    <div className="decider-card"><Crown size={18}/><span>{decider ? <><b>{decider.name}</b> makes the final call.</> : <><b>A decider is needed.</b> A couple or planner can assign one.</>}</span></div>
    {!next.deciderIdentity && (me?.role === 'couple' || me?.role === 'planner') && <select className="select-control" defaultValue="" aria-label="Choose a decider" onChange={event => { const person = participants.find(row => row.identity.toHexString() === event.target.value); if (person) setDecider({ decisionId: next.id, identity: person.identity }); }}><option value="" disabled>Choose who makes the final call</option>{participants.map(person => <option key={person.identity.toHexString()} value={person.identity.toHexString()}>{person.name}</option>)}</select>}
    <div className="decision-actions"><button className="primary-button" disabled={picked === undefined} onClick={submitVote}>{picked === undefined ? 'Choose an option' : `Vote: ${decisionOptions.find(item => item.id === picked)?.label}`}</button>{iCanDecide && picked !== undefined && <button className="lock-button" onClick={() => lockDecision({ decisionId: next.id, optionId: picked })}><LockKeyhole size={16}/> Make final call</button>}</div>
  </div>;
}
