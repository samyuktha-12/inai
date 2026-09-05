import { useMemo, useState } from 'react';
import { Check, ChevronRight, Crown, LockKeyhole } from 'lucide-react';
import { tables, reducers } from '../module_bindings';
import { useReducer, useSpacetimeDB, useTable } from 'spacetimedb/react';
import '../decision-board.css';
import '../open-polls.css';

export default function DecisionBoard({ weddingId }: { weddingId: bigint }) {
  const { identity } = useSpacetimeDB();
  const [decisions] = useTable(tables.decision);
  const [options] = useTable(tables.decisionOption);
  const [votes] = useTable(tables.vote);
  const [participants] = useTable(tables.participant);
  const [members] = useTable(tables.member);
  const castVote = useReducer(reducers.castVote);
  const lockDecision = useReducer(reducers.lockDecision);
  const setDecider = useReducer(reducers.setDecider);
  const [choice, setChoice] = useState<bigint | undefined>();
  const [showAll, setShowAll] = useState(false);
  const [activeDecisionId, setActiveDecisionId] = useState<bigint | undefined>();
  const myHex = identity?.toHexString();
  const myMembership = members.find(row => row.weddingId === weddingId && row.identity.toHexString() === myHex);
  const iAmAdmin = myMembership?.role === 'couple' || myMembership?.role === 'planner';
  const open = useMemo(() => [...decisions].filter(row => row.weddingId === weddingId && row.lockedOptionId === undefined).sort((a, b) => Number(a.id - b.id)), [decisions, weddingId]);
  const next = open.find(row => row.id === activeDecisionId) ?? open[0];
  const settled = useMemo(() => decisions.filter(row => row.weddingId === weddingId && row.lockedOptionId !== undefined).sort((a, b) => Number(b.id - a.id)), [decisions, weddingId]);
  const settledPolls = settled.length ? <section className="settled-polls"><p className="section-label">Past polls</p><h2>Settled decisions</h2>{settled.map(decision => { const winner = options.find(option => option.id === decision.lockedOptionId); const decider = decision.deciderIdentity ? participants.find(person => person.identity.equals(decision.deciderIdentity!)) : undefined; return <article key={String(decision.id)}><b>{decision.title}</b><p><strong>{winner?.label ?? 'Final choice'}</strong> · decided by {decider?.name ?? 'Wedding team'}</p></article>; })}</section> : null;

  if (!next) return <div className="decision-page"><div className="empty-state"><Check size={28}/><h1 className="headline">Every decision is settled</h1><p>New choices from your wedding team will appear here.</p></div>{settledPolls}</div>;

  const decisionOptions = options.filter(row => row.decisionId === next.id);
  const myVote = votes.find(row => row.decisionId === next.id && row.voterIdentity.toHexString() === myHex);
  const picked = choice ?? myVote?.optionId;
  const decider = next.deciderIdentity
    ? participants.find(row => row.identity.equals(next.deciderIdentity!))
    : undefined;
  const iCanDecide = next.deciderIdentity?.toHexString() === myHex || myMembership?.role === 'couple';
  const count = (optionId: bigint) => votes.filter(row => row.decisionId === next.id && row.optionId === optionId).length;
  const submitVote = () => { if (picked !== undefined) castVote({ decisionId: next.id, optionId: picked }); };

  return <div className="decision-page">
    <p className="eyebrow">Decisions</p>
    {open.length > 1 && <div className="open-poll-list" aria-label="Open polls"><p>{open.length} open polls</p>{open.map((decision, index) => <button type="button" className={decision.id === next.id ? 'active' : ''} key={String(decision.id)} onClick={() => { setActiveDecisionId(decision.id); setChoice(undefined); setShowAll(false); }}><span>{index + 1}</span><b>{decision.title}</b><small>{votes.filter(vote => vote.decisionId === decision.id).length} vote{votes.filter(vote => vote.decisionId === decision.id).length === 1 ? '' : 's'}</small></button>)}</div>}
    <div className="decision-active"><p className="section-label">{open.length > 1 ? 'Selected poll' : 'Open poll'}</p><h1 className="decision-question">{next.title}</h1><p className="decision-meta">Your vote helps the named decider choose. It doesn’t replace their final call.</p></div>
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
    {!next.deciderIdentity && iAmAdmin && <select className="select-control" defaultValue="" aria-label="Choose a decider" onChange={event => { const person = participants.find(row => row.identity.toHexString() === event.target.value); if (person) setDecider({ decisionId: next.id, identity: person.identity }); }}><option value="" disabled>Choose who makes the final call</option>{participants.filter(person => members.some(member => member.weddingId === weddingId && member.identity.equals(person.identity))).map(person => <option key={person.identity.toHexString()} value={person.identity.toHexString()}>{person.name}</option>)}</select>}
    <div className="decision-actions"><button className="primary-button" disabled={picked === undefined} onClick={submitVote}>{picked === undefined ? 'Choose an option' : `Vote: ${decisionOptions.find(item => item.id === picked)?.label}`}</button>{iCanDecide && picked !== undefined && <button className="lock-button" onClick={() => lockDecision({ decisionId: next.id, optionId: picked })}><LockKeyhole size={16}/> Make final call</button>}</div>{settledPolls}
  </div>;
}
