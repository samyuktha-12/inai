# Inai — Project Spec

*The shared surface where a wedding actually lives, reaching even the people who will never install an app, in their own language.*

Version 1.1 · Living spec

---

## 1. Thesis

Every wedding-planning app dies the same death: the data goes stale because keeping it current is manual work nobody signs up for. The incumbents (WedMeGood, WeddingWire India, ShaadiSaga) are vendor-discovery marketplaces with solo-user tools bolted on. They monetize vendor leads, so they have no reason to build the coordination layer the wedding actually runs on. That layer lives in WhatsApp, one cousin's spreadsheet, and a Pinterest board nobody else can edit.

Inai owns coordination. The central bet, and the moat:

> **Voice is not the query interface. It is the primary write path.** An AI coordinator keeps the wedding's state current by *talking to people* (chat, voice note, or call), instead of waiting for anyone to fill in a form. Humans confirm; nothing acts on unconfirmed state.

The same logic applies at the very start: **onboarding ingests what already exists** instead of asking the couple to build from scratch. The win condition is the category's own: the family group chat goes quiet because the tool is where it happens.

---

## 2. Positioning

| | Incumbents | Inai |
|---|---|---|
| Core model | Vendor directory + lead gen | Coordination surface |
| Setup | Blank forms, one person fills them | Agent ingests Pinterest / WhatsApp / sheets |
| Data entry | Manual, ongoing | Agent-driven, by talking to everyone |
| Reaches parents / non-app relatives | No | Yes, by phone call in their language |
| Guest travel & movement | Unmanaged | First-class |
| AI | Blog Q&A, hashtag generator | Coordinator that writes state and runs a hybrid team |

The two holes incumbents structurally can't fill fast: reaching the highest-coordination-load people who won't install anything (parents, out-of-town relatives, older vendors), and managing guest movement (arrivals, pickups, leaving times).

---

## 3. Design invariants

These are non-negotiable. Everything else is detail.

1. **Voice/chat writes, humans confirm.** No machine-extracted fact acts on the world until a human approves it or the agent read it back and got a verbal yes.
2. **Every field carries provenance.** `source`, `updated_by`, `confidence`, `timestamp`. State whose origin you can't trace is not trustworthy state.
3. **Bots can be Responsible, never Accountable.** A bot can chase, track, remind, draft, and aggregate. A human must approve every decision, spend, and commitment.
4. **Cadence bends to the person and the deadline.** Not a fixed daily beat. Urgency + event proximity + personal preference decide when someone is contacted.
5. **The agent contacts a person only about items that person owns.** No open owned item, no contact. This is what keeps the product from becoming spam.
6. **One input pipeline, many front doors.** Chat, voice note, and live call normalize into the same event stream, extraction, and confirmation gate.
7. **Ingest, don't ask.** Onboarding pulls structure out of the artifacts the couple already has (Pinterest, WhatsApp, spreadsheets, quotes) so the surface is populated in minutes, not built from an empty screen.
8. **Bots can be Responsible, never Accountable.** (see invariant 3; enforced in the permission model, not just intent)
9. **No jargon leaks to users.** Internally this is a scrum-master loop. To an uncle it is "a helpful assistant checking in." Nobody outside the build team hears "standup."
10. **SpaceTimeDB stays deterministic.** All LLM reasoning, maps, and telephony live outside the module. Reducers decide *what*; external workers do the *doing*.

---

## 4. Actors

### Human roles
- **Couple** — admin. Ultimate accountable party.
- **Planner** — editor across all lanes (if one exists).
- **Family (bride side / groom side)** — contributors, lane owners. Budget may be scoped/hidden per side.
- **Vendor** — scoped to their own booking only.
- **Guest** — RSVP + photo upload + own travel details only.

### Bot roles (fill unowned lanes, always Responsible-not-Accountable)
- **Coordinator bot** — the project-manager brain. Runs the check-in loop, computes leaving times, detects conflicts, flags decisions that are due.
- **Vendor-liaison bot** — tracks and chases vendors in its lane. Calling a vendor is gated on a recorded consent state (see §12).
- **Guest-logistics bot** — collects RSVPs and travel details from non-app relatives, clusters arrivals, drafts pickup rosters.
- **Decision bot** — watches threads, produces summaries and proposed decisions with suggested owners.

### The RACI boundary (the one that bites if left vague)
| Action | Bot may | Bot may not |
|---|---|---|
| Chase, remind, track, log, aggregate, draft | ✓ | |
| Summarize a thread into a proposed decision | ✓ | |
| Call a vendor | Only with recorded consent | Without consent |
| Finalize a menu / vendor / date | | ✗ (routes to accountable human) |
| Approve or record a payment | | ✗ |
| Commit anything external | | ✗ |

---

## 5. The operating loop

**Kickoff (onboarding = a RACI assignment).** Detailed in §6. The coordinator ingests existing artifacts, drafts the structure, and proposes an ownership map. Humans adjust. Every lane left unowned is assigned to a bot.

**Recurring check-in (the engine).** Each person has their own scheduled window and preferred channel. The agent contacts them only about items they own, in one batched touch: "Menu pending, blouse stitching pending, Chennai relatives' cab unbooked — which can you update me on?" Answers flow into the input pipeline.

Cadence is adaptive: crunch-week owners may get daily, most people weekly, some "only if I'm blocking something." Async (WhatsApp voice note answered on their own time) is preferred; live outbound calls are reserved for non-app relatives and genuinely time-critical chases. Inbound (they call in) is always open and has none of the spam risk.

---

## 6. Onboarding journey

The goal: a populated, moving surface within minutes of signing in, with almost no typing. The couple points Inai at where the planning already lives; the agent turns each artifact into `reported` state the couple confirms.

### Step 1 — Start (under a minute)
Sign in. Give the bare minimum: the two names, the city, and a date or rough date range. Nothing else is required. No long form. Everything else is ingested or inferred.

### Step 2 — Connect what already exists
The couple hands Inai the artifacts the planning already lives in. Each is parsed into structured proposals:

- **Pinterest board** → mood board, clustered by category, plus an inferred vendor checklist and an aesthetic brief. (Mechanics and limits below.)
- **WhatsApp planning-group export** → members mapped to roles, decisions already floated, vendors mentioned, dates discussed. The coordination already started here; ingest it instead of making them redo it.
- **Guest list** (spreadsheet / CSV / phone contacts) → Guest table with side inference.
- **Vendor quotes / budget sheet** (PDF / image / xlsx) → budget lines and vendor cards, via OCR/parse.
- **Forwarded tickets or bookings** → travel plans.

### Step 3 — Agent drafts the whole structure
From the ingested material the coordinator proposes, on a single review screen: the event list, the RACI ownership map, an initial task list, a budget skeleton, and the mood board. All arrive as proposals in `reported` state. The couple accepts or adjusts with taps. This is the kickoff RACI assignment from §5, done for them rather than by them.

### Step 4 — Invite the team, including non-app people
One tap drafts invites to lane owners (chat/app link). Non-app parents and relatives are set up against the inbound voice number, with a short friendly intro call or WhatsApp so they know the assistant exists and what it's for.

### Step 5 — First value moment
Within minutes the couple sees a surface that is already alive: a mood board with votes ready to open, tasks with suggested owners, a budget skeleton, a guest list. Not an empty wizard. That populated-in-minutes moment is the onboarding hook and the thing that earns the next session.

### Acting on a Pinterest board (not just importing pretty pictures)
This is the piece worth doing well. The agent treats the board as input to decisions and vendor action:

1. **Cluster** pins by category (mandap/decor, bridal attire, mehendi, invites, cake, and so on) using the vision model.
2. **Propose decisions**: "You pinned three mandap styles — shall I make this a vote for the family?" Each cluster becomes a candidate proposal on the decision surface.
3. **Infer the vendor checklist** the aesthetic implies: heavy florals and draping → you need a decorator; these bridal looks → a MUA who works in this style; this palette → coordinated invites.
4. **Generate a vendor brief**: an aesthetic summary plus reference images, ready to send to decorators and photographers so their quotes actually match what the couple wants.

So the flow is inspiration → decision → vendor action, automatically. That is what "act on the board" means here.

### Honest constraints on ingestion
Be direct in the build about what is and isn't possible:

- **Pinterest.** You cannot programmatically scrape an arbitrary public board; that violates Pinterest's terms and their API access to third-party boards is limited. The realistic mechanisms are: the couple connects their own Pinterest via OAuth, or shares/exports the board, or simply drops the images. Either way a vision model reads the images. Frame it as "connect your Pinterest" or "share your board," never as magic access to anyone's board.
- **WhatsApp.** You cannot read a group's history through an API. The mechanism is the built-in "Export chat" file (.txt/.zip) that the couple uploads. The WhatsApp Business API is for outbound messaging, not reading arbitrary history. So onboarding ingests an export the couple provides.
- **Everything ingested lands as `reported`, never `confirmed`.** Same gate as all other machine-written state (§9). The couple confirms before anything acts on it. Ingestion is a head start, not an authority.

---

## 7. User journeys (ongoing, per persona)

**Couple — the command center.** Reviews agent-drafted proposals, confirms and decides, watches the surface move, and receives escalations only for things that genuinely need a human. Manual entry is minimal because the agents capture state by talking to people.

**Planner (if one exists) — cross-lane editor.** Works the board across every lane, drives the decision surface, delegates through owned tasks, and is the human the bots escalate lane decisions to.

**Family lane owner (e.g., the groom's brother owns logistics).** Gets personal check-ins about their lane only, on their own cadence and channel. Updates by voice note, chat, or call. Sees their own tasks and the items they're accountable for. Never pinged about other people's lanes.

**Non-app parent (voice-only) — the signature journey no competitor serves.** Never installs anything. Calls the number anytime to ask a question in Tamil or Hindi ("how many have confirmed from our side?", "when is the muhurtham?"). Receives a periodic, friendly call about the one or two things they own, answers naturally, and the agent logs it after reading it back to confirm. Gets leaving-time and reminder calls before events.

**Guest.** Receives an invite link, no forced app install. RSVPs per event in a tap. Shares travel details, or the guest-logistics bot messages/calls to collect them. Uploads photos to the shared timeline. Gets a personalized leaving time for each event they're attending.

**Vendor.** Gets a scoped link to their own booking only. Confirms details and uploads quotes. Is contacted by the vendor-liaison bot only after a consent record exists; until then the bot drafts a message for a human to send.

---

## 8. Input pipeline

```
chat message ─┐
voice note  ──┼─► normalize ─► extract (LLM) ─► confidence gate ─► state machine
live call  ───┘                                      │
                                          low conf ──► pending_confirmation ─► human 1-tap approve
                                          high conf + read-back "yes" ──► confirmed
```

Build the pipeline once. The channel is only how the words arrive. Onboarding ingestion (§6) is the same pipeline running on files instead of speech.

---

## 9. Item state machine + confirmation gate

Every trackable item (a task, a budget line, a vendor status, an RSVP, an ingested pin) moves through:

```
unknown ─► reported (low confidence, machine-written) ─► confirmed
                      │
                      └─ visually distinct in UI, routes to accountable human
```

**Only `confirmed` state is acted on by anything downstream.** Rules:
- Low-confidence extractions never auto-commit. They land in `reported` and route to the couple or lane owner for one-tap approval.
- The agent reads back before hanging up: "So the menu is confirmed, 5 starters and 8 mains, yes?" A verbal yes upgrades confidence.
- Provenance is written on every transition.

This is boring plumbing and it is the entire difference between a demo and something a family trusts with their daughter's wedding. If the agent mishears "menu is *not* finalized" over an 8kHz line and silently commits it, everyone downstream acts on a false state, which is worse than no app.

---

## 10. Feature modules

**Decision surface (the core primitive).** Venue, mood direction, vendors, and menu all collapse into one object: a *proposal* with a shortlist, a threaded discussion, a *vote*, and a *locked outcome*. Pinterest clusters from onboarding seed these proposals directly. Voting is **input to a decision with a named decider**, not binding democracy — a family wedding is not one-person-one-vote, and a human owns the final call. The decision bot summarizes the thread on convergence or on request and emits a proposal card; on confirm it writes a `Decision` and spawns owned `Task` rows.

**Live budget.** Real-time total with overshoot alerts and full change history. Every line carries provenance (was "paid" entered by a human or inferred by an agent from "haan payment kar diya"?).

**Tasks.** Assignable, with owner and due date, visible to the group. This is the direct antidote to "chased by whoever cares most."

**Guest coordination + travel + tickets (the unserved goldmine).**
- `Guest`: side, events invited to, per-event RSVP, home city.
- `TravelPlan` + `Ticket`: arrival/departure, mode, PNR, times; captured via forwarded screenshot (Sarvam Vision OCR → structured fields), in-app upload, or the voice agent asking and logging on a call.
- Travel dashboard: who lands when and where, auto-clustered arrivals for shared cabs, pickups assigned as owned tasks.
- Accommodation and room allocation on top.

**Leaving times.** Coordinator computes `event_start − buffer − travel_time` per person per event (maps API called in the agent layer, not a reducer), personalized by home city and live traffic, delivered as a nudge or spoken to parents by call.

**Nudges.** SpaceTimeDB Schedule tables fire a reducer at time T that checks a condition and writes a `Notification` or inserts a `CallJob`. Escalation ladder: in-app → WhatsApp → for critical items and non-app people, a voice call.

**Photo timeline.** Lightweight guest upload to one shared timeline. Retention feature, not a differentiator; do not let it eat build time.

---

## 11. Voice layer

**Inbound (open always, no spam risk).** Person dials a number, no app. Telephony (Vobiz / Exotel / Plivo) → Sarvam Saaras STT (23 languages, code-mix, barge-in) → LangGraph agent reads live state → Sarvam Bulbul TTS answers in their language (sub-250ms, 8kHz telephony-optimized, 11 languages). "How many confirmed from our side?" / "When is the muhurtham?" / "What do I handle this week?"

**Outbound (deliberate, gated).**
- Daily coordinator sweep: a Schedule reducer scans open items and inserts `CallJob` rows ("this person owns these 3 unresolved items"). An external worker subscribes, places the call, runs the conversation, writes results back through reducers via the confirmation gate.
- Vendor calls: the vendor-liaison bot may only dial when a `VendorConsent` record exists. No consent → it drafts a message for a human to send instead.

**Consent + disclosure.** Every outbound call opens with disclosure: "This is an assistant helping with Priya's wedding; this call may be transcribed." Right thing to do and legally cleaner. Outbound in India also carries DLT/telemarketing friction and per-minute cost — start inbound-heavy, add outbound deliberately.

---

## 12. Architecture

```
┌─────────────────────────────────────────────────────────┐
│  SpaceTimeDB module  (single source of truth)            │
│  • Tables (public/private = RBAC via ctx.sender)         │
│  • Reducers (deterministic mutations)                    │
│  • Schedule tables (nudges, daily sweep, leaving times)  │
│  • Subscriptions (the live surface that "moves")         │
└───────────▲───────────────────────────────▲─────────────┘
            │ subscribe / call reducers      │ subscribe / call reducers
┌───────────┴──────────┐         ┌───────────┴──────────────┐
│  Frontend            │         │  Agent layer (external)   │
│  Angular / React     │         │  LangGraph + FastAPI      │
│  live UI, voting,    │         │  LLM reasoning, extraction│
│  proposals, dashboards│        │  summaries, maps, workers │
│  onboarding ingest UI │        │  Pinterest/WhatsApp parse │
└──────────────────────┘         └───────────▲───────────────┘
                                             │
                                 ┌───────────┴───────────────┐
                                 │  Voice / telephony         │
                                 │  Vobiz/Exotel + Sarvam     │
                                 │  Saaras STT / Bulbul TTS   │
                                 │  Sarvam Vision (OCR)       │
                                 └────────────────────────────┘
```

**The determinism boundary (design tax, respect it).** SpaceTimeDB reducers cannot do network, timers, or randomness. So: reducers decide *who to contact and about what* and insert `CallJob`/`Notification` rows; the external LangGraph layer does all talking, extracting, summarizing, maps calls, and artifact ingestion, then writes back through reducers. STDB Procedures (which can make HTTP calls) are used only as thin bridges, not as the home for agent logic.

---

## 13. Data model (sketch)

Core tables: `Wedding`, `Event`, `Member(role)`, `Proposal`, `Vote`, `Decision`, `Thread`, `Message`, `Expense`, `Task(owner, due, status)`, `Guest(side, home_city)`, `RSVP(guest, event, status)`, `TravelPlan`, `Ticket`, `Accommodation`, `Photo`, `MoodItem(cluster, source_pin)`, `ActivityFeed`, `Notification`.

Coordination tables: `ScheduledNudge` (schedule table), `CallJob(target, items[], status)`, `VendorConsent(vendor, granted_by, timestamp)`, `ChannelPreference(member, channel, cadence)`, `IngestSource(type, status, raw_ref)`.

Provenance is a shared shape on mutable facts:
```
{ value, source: enum(voice_call|voice_note|chat|manual|ocr|pinterest|whatsapp),
  updated_by, confidence: float, state: enum(unknown|reported|confirmed),
  timestamp }
```

---

## 14. RBAC matrix

| Table / action | Couple | Planner | Family (own side) | Vendor | Guest | Bot |
|---|---|---|---|---|---|---|
| Wedding config | RW | RW | R | – | – | R |
| Budget | RW | RW | scoped | – | – | R + propose |
| Proposal / vote | RW | RW | RW | – | – | propose |
| Decision (finalize) | RW | RW | own lane | – | – | ✗ |
| Task | RW | RW | own | – | – | RW own lane |
| Guest / RSVP | RW | RW | own side | – | own RSVP | RW |
| Vendor booking | RW | RW | R | own only | – | R + chase |
| Photos | RW | RW | RW | – | upload | – |
| Place a call | – | – | – | – | – | gated (§11) |

Enforced in-module via public/private tables and `ctx.sender`.

---

## 15. Tech stack

- **State/backend:** SpaceTimeDB (TypeScript module; React SDK for the client).
- **Frontend:** Angular or React.
- **Agents:** LangGraph + FastAPI workers subscribed to STDB.
- **Voice:** Sarvam (Saaras STT, Bulbul TTS, Sarvam-30B for the agent loop, Sarvam Vision for OCR) + Vobiz/Exotel/Plivo telephony.
- **Ingestion:** Pinterest OAuth or shared boards/images (vision model), WhatsApp chat export parser, CSV/xlsx/PDF parsers.
- **Maps:** any traffic-aware routing API, called from the agent layer.
- **Messaging:** WhatsApp Business API for async touches.

---

## 16. Build phases

**Phase 0 — MVP / hackathon cut (build only this).**
Frictionless onboarding from one Pinterest board + one WhatsApp export into a populated surface, plus the live decision + budget surface on SpaceTimeDB, plus one inbound Tamil/Hindi voice call answering real questions from live state, plus one nudge firing, plus leaving-times for one event. The Pinterest-to-populated-surface moment and the voice call against live data are the two things that make a room go quiet. Do not build the other modules yet.

**Phase 1.** Confirmation gate + provenance end to end. Task ownership + RACI kickoff auto-drafted from ingestion. Daily coordinator sweep (outbound `CallJob` to owners only).

**Phase 2.** Guest/travel/ticket module with OCR capture and pickup rosters. WhatsApp async channel. Channel + cadence preferences.

**Phase 3.** Vendor-liaison bot with consent gating. Thread-to-decision summarization. Photo timeline. Full Pinterest-to-vendor-brief flow.

---

## 17. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Number gets blocked from over-calling | Contact only about owned open items; batch; hard frequency cap; prefer async; inbound-first |
| Extraction errors commit false state | Confidence gate + read-back + human confirm; never act on unconfirmed |
| Ingestion promises more than is legal/possible | "Connect your Pinterest" / upload WhatsApp export, not scraping; everything lands as `reported` |
| SpaceTimeDB is young, in-memory, small ecosystem | Great for the demo differentiator; before production, interrogate backup/recovery hard and weigh vs Postgres + realtime (Convex/Electric/Supabase) |
| Determinism constraint fights the build | Keep a clean boundary: reducers decide, external workers do |
| Outbound telephony cost + DLT regulation | Inbound-heavy; outbound deliberate and disclosed |
| Voting produces a socially-overruled "winner" | Vote is input to a human-owned decision, not binding |
| Family trust in an AI touching the wedding | Provenance visible, consent disclosed, humans accountable throughout |

---

## 18. Success metric

Not DAU. The real signal: **does the group chat go quiet?** Concretely, the share of coordination decisions and status updates that resolve inside Inai rather than in WhatsApp, and the share of state kept current by agent-driven capture rather than manual entry. Plus one onboarding signal: time-to-populated-surface, which should be minutes. If those move, the thesis is working.