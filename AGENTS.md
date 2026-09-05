# CLAUDE.md

Operating instructions for anyone (human or agent) writing code in this repo. Read this before touching anything. The full product spec lives in `docs/inai-project-spec.md`; this file is the build contract.
Use `CLAUDE-spacetimedb.md` for spacetimedb information.

---

## What Inai is

A wedding coordination app for Indian families that spans three generations, including parents who will never install an app. It replaces the WhatsApp-plus-spreadsheet-plus-Pinterest mess with one live surface. The core bet:

> **Voice is the primary write path, not a query interface.** An AI coordinator keeps state current by talking to people (chat, voice note, phone call) instead of waiting for anyone to fill in a form. Humans confirm; nothing acts on unconfirmed state.

Win condition: the family group chat goes quiet because the tool is where it happens.

---

## Non-negotiable invariants

Violating any of these breaks the product, not just a test. If a task seems to require breaking one, stop and flag it.

1. **Humans confirm machine-written state.** Anything the agent hears, reads, or infers lands as `reported`, never `confirmed`. Only `confirmed` state is acted on downstream. No exceptions for "high confidence."
2. **Every mutable fact carries provenance.** `source`, `updated_by`, `confidence`, `state`, `timestamp`. A fact you can't trace is not trustworthy state.
3. **Bots can be Responsible, never Accountable.** A bot may chase, track, remind, draft, aggregate, summarize. A human must approve every decision, spend, commitment, and outbound vendor call. Enforce this in the permission layer, not just intent.
4. **SpaceTimeDB stays deterministic.** No network, timers, randomness, or filesystem inside reducers. Reducers decide *what*; the agent layer does the *doing*. See the boundary section below. This is the rule most likely to be broken.
5. **Contact a person only about items they own.** No open owned item, no message or call. Frequency-capped, per-person channel preference. This is what stops the product from becoming spam and getting the number blocked.
6. **Ingest, don't ask.** Onboarding pulls structure from existing artifacts (Pinterest, WhatsApp export, sheets, quotes). Do not add blank-form setup flows.
7. **No jargon reaches users.** Internally: scrum-master loop, RACI, standup. To users: "a helpful assistant checking in." UI copy is plain, sentence case, active voice, elder-legible.
8. **Consent and privacy are features, not polish.** Disclose recording at the start of every outbound call. Live location is opt-in per person and expires after the event. Never scrape Pinterest or read WhatsApp history via API (both violate terms and aren't available); ingest only what the user hands over.

---

## The determinism boundary (read this twice)

SpaceTimeDB reducers run inside the database and must be pure and deterministic. This shapes the entire architecture.

**Inside the SpaceTimeDB module (deterministic only):**
- Tables (the source of truth), public/private for RBAC.
- Reducers: transactional mutations. They do not return data to callers, do not call the network, do not use wall-clock time or random. Authorize with `ctx.sender`.
- Schedule tables: time-based reducers. Use these to decide *who to contact and about what* by inserting `CallJob` / `Notification` rows. They do not place calls or send messages.
- Subscriptions: how clients read. Never read via reducer return values.

**Outside, in the agent layer (LangGraph + FastAPI workers):**
- All LLM reasoning, extraction, summarization.
- All maps calls (geocoding, routing, optimization, places).
- All telephony and messaging (Sarvam, Vobiz/Exotel, WhatsApp).
- All artifact ingestion (Pinterest images, WhatsApp export, OCR).
- Workers subscribe to STDB, do the work, write results back through reducers.

**SpaceTimeDB Procedures** can make outbound HTTP calls. Use them only as thin bridges when unavoidable, never as the home for agent logic.

The one-line rule: **the database stores the answer; the outside world computes it.**

---

## SpaceTimeDB rules (common mistakes to avoid)

- Reducers do **not** return data. Clients read through subscriptions. Do not design a reducer as an RPC that returns a result.
- Reducers must be **deterministic**: no `fetch`, no timers, no `Math.random`, no `Date.now()` for logic. Pass any needed external value in as an argument written by the agent layer.
- **Auto-increment IDs are not sequential.** Gaps are normal. Never use them for ordering. Use explicit timestamps or a sequence column.
- Authorize every mutation with `ctx.sender`. Do not trust client-supplied identity.
- Use **private tables** for anything not everyone in the wedding should see (budget scoped per side, vendor-only booking views).
- Time-based work goes through **Schedule tables**, not external cron hitting reducers, wherever possible.
- Modules are TypeScript, bundled and deployed with the `spacetime` CLI (`spacetime publish`). Client uses the TS SDK + React bindings.

---

## Proposed repo layout

```
/module            SpaceTimeDB TypeScript module (tables, reducers, schedule tables)
  /tables
  /reducers
  /schedule        daily sweep, leaving-time jobs, nudge firing
/agents            LangGraph + FastAPI workers (subscribe to STDB, write back)
  /coordinator     check-in loop, conflict detection, leaving times
  /voice           telephony + Sarvam STT/TTS pipeline (inbound + outbound)
  /ingest          pinterest, whatsapp-export, ocr parsers
  /maps            geocoding, routes, optimization, places (India-first)
  /extract         LLM extraction + confidence scoring -> confirmation gate
/web               frontend (Angular or React), 3-tab app + onboarding + guest RSVP
/docs              inai-project-spec.md, inai-screens.html
CLAUDE.md
```

---

## Data conventions

Provenance shape on every mutable fact:
```
{ value,
  source: "voice_call"|"voice_note"|"chat"|"manual"|"ocr"|"pinterest"|"whatsapp",
  updated_by,
  confidence: number,        // 0..1
  state: "unknown"|"reported"|"confirmed",
  timestamp }
```

Item state machine: `unknown -> reported -> confirmed`. Machine writes land in `reported`. A human tap, or an agent read-back that got a verbal yes, promotes to `confirmed`. UI must render `reported` visibly differently from `confirmed`.

Key tables: `Wedding, Event, Member(role), Proposal, Vote, Decision, Thread, Message, Expense, Task(owner,due,status), Guest(side,home_city,geo), RSVP, TravelPlan, Ticket, Accommodation, Photo, MoodItem, Notification`. Coordination: `ScheduledNudge, CallJob, VendorConsent, ChannelPreference, IngestSource`.

---

## Maps rules

- **Every maps call happens in the agent layer**, never in a reducer. The result (a leaving time, a route, a cluster, an ETA) is written back as a normal field with provenance.
- **Evaluate Mappls before defaulting to Google** for India: landmark-style address parsing, geocoding accuracy, and cost usually favor Mappls domestically. Google is stronger for route optimization and destination weddings abroad. Keep the maps provider behind one interface in `/agents/maps` so it's swappable.
- Use traffic-aware routing for leaving times and for schedule-feasibility checks (is the gap between two events shorter than the drive between their venues?).
- Pickup rosters and shuttle loops are route-**optimization** problems (many stops, many vehicles), not point-to-point directions. Use Google Route Optimization or OR-Tools over a distance matrix.
- Drivers and guests get **navigation deep links** (open native Google Maps / Mappls turn-by-turn). We never build our own nav.
- **Live location is day-of only, opt-in per person, and expires after the event.** Build it last, guard it hardest.

---

## Voice and notification rules

- **Inbound is always open** and carries no spam risk; lean on it. A person calls the number, Sarvam Saaras transcribes, the agent answers from live state via Sarvam Bulbul in their language.
- **Outbound is deliberate and gated.** The daily sweep (a Schedule reducer) inserts `CallJob` rows for owners with open items; a voice worker places the call, runs the conversation, and writes back through the confirmation gate.
- **Vendor calls require a `VendorConsent` record.** No consent, the bot drafts a message for a human to send instead.
- Channel by persona: couple/family get in-app + WhatsApp; non-app parents get voice call + WhatsApp voice note; guests get WhatsApp/SMS link; vendors get WhatsApp (call only if consented).
- Escalation ladder: quietest working channel first, climb to a call only for urgent items or people with no other channel. Respect the per-person frequency cap.
- Every outbound call opens with disclosure that it's an assistant and may be transcribed.

---

## UI and copy rules

- **Three tabs total** in the couple/family app: Today, Decide, Wedding. Do not add tabs. Detailed material lives behind the Wedding tab so Home stays calm.
- One clear primary action per screen. Voice button is the primary write affordance; typing is the fallback.
- Elder-legible: body type 19px+, tap targets 56px+, high contrast, one calm primary color (jade) for all actions, one attention color (marigold) used sparingly.
- Guests use a one-screen RSVP via link, no app install. Parents get no screen at all.
- Copy is plain, sentence case, active voice, no filler. A button names what happens ("Send RSVP", not "Submit") and keeps that name through the flow. Errors say what happened and how to fix it. Empty states invite an action.
- No wedding-cliché visual noise (heavy gold/maroon/mandala). Restraint is the brand; it also serves low fatigue and older eyes.

---

## Tech stack

- **State/backend:** SpaceTimeDB (TypeScript module, `spacetime` CLI, React SDK).
- **Frontend:** Angular or React (decide once, then be consistent).
- **Agents:** LangGraph + FastAPI (Python), subscribed to STDB via the client SDK.
- **Voice/AI:** Sarvam (Saaras STT, Bulbul TTS, Sarvam-30B for the voice loop, Sarvam Vision for OCR) + Vobiz/Exotel/Plivo telephony.
- **Maps:** Mappls or Google, behind `/agents/maps`.
- **Messaging:** WhatsApp Business API for async touches.

---

## Build order (current scope)

**Phase 0 (now):** onboarding from one Pinterest board + one WhatsApp export into a populated surface; live decision + budget surface on STDB; one inbound Tamil/Hindi voice call answering from live state; one nudge firing; leaving-times for one event using traffic-aware routing.

Do not build ahead of Phase 0. Later phases (confirmation gate everywhere, daily sweep, guest/travel/tickets, vendor-liaison bot, live tracking) are in the spec.

---

## Commands

Not yet scaffolded. When set up, document here:
- `module` build/publish
- `agents` run/test
- `web` dev/build
- lint/format/test for each package

Until then, do not invent commands; ask or scaffold explicitly.

---

## When in doubt

- If a change would let unconfirmed state act on the world, stop.
- If a change puts network/time/random inside a reducer, move it to the agent layer.
- If a bot would decide, spend, or call a vendor without a human, stop.
- If a flow contacts someone who owns nothing open, or exceeds their cap, stop.
- If setup asks users to type what could be ingested, reconsider.
- Flag the tension rather than quietly working around an invariant.