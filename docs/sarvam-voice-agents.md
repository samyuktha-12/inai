# Sarvam Voice Agents

This is the operating configuration for Inai's Sarvam Voice Agents. Build the
agents in Sarvam's **Voice Agents** product; do not separately wire Saaras and
Bulbul for phone calls. Voice Agents provides the live STT/TTS and agent loop.
Inai provides the live, scoped wedding data through API tools.

## Create these agents

| Sarvam agent | Direction | Job | Do not allow it to |
| --- | --- | --- | --- |
| **Inai family help line** | Inbound | Answer a recognised family member's questions about their events, owned tasks, confirmed decisions and leaving time. | Reveal another side's private information, make a decision, or commit an update without confirmation. |
| **Inai coordinator check-in** | Outbound + inbound | Batch a member's owned open items, collect an update and read it back. | Call a person without an owned open item, exceed their cadence, or mark a report confirmed. |
| **Inai guest travel desk** | Inbound + WhatsApp/phone follow-up | Collect RSVP and travel details; answer arrival, pickup, room and event questions. | Contact a guest outside their invitation/travel scope, assign a pickup without a human owner. |
| **Inai vendor liaison** | Inbound + consented outbound | Capture quote and availability updates; explain the current booking brief. | Dial a vendor without `VendorConsent`, negotiate, book, spend, or accept a quote. |
| **Inai event-day help line** | Inbound | Answer today's schedule, venue, pickup and personalised leaving-time questions. | Share another person's location or use location unless the person opted in for the event. |

The decision facilitator is a capability of the coordinator, rather than its
own telephone number. It may summarise preferences and create a *proposed*
decision, but routes the final choice to the named human decider.

## Build the family help line first

1. In Sarvam, open **Build -> Agents** and create **Inai family help line**.
2. Enable Hindi, Tamil and English/Indian English. Let the caller code-mix;
   reply in the language they started with unless they ask to switch.
3. Pick a calm, clear voice and slow it slightly for older callers. Add a
   pronunciation dictionary for both families' names, venues, and event names.
4. Add the `get_wedding_context` API tool below as an **on_start** hook.
   Map its response fields into variables. Mark phone number and any contact
   data as PII in Sarvam.
5. Add the same tool as a **during conversation** tool. This lets the agent
   refresh data before giving a time-sensitive answer (especially leaving
   times and RSVP counts).
6. Add `report_task_completion` as an **on_end** hook. It is allowed only to
   submit an owned task the caller explicitly confirmed in a read-back. The
   endpoint records a `reported` update; a human still confirms it in Inai.
7. Under **Deploy**, attach an inbound number and create an inbound deployment.
   Set the deployment completion webhook only for audit/analytics; it is not
   how the agent gets data during a live call.

## API tools

Use the public SpaceTimeDB module endpoint. Substitute `DATABASE_ID` with the
deployed database identity/name and keep the bearer value in Sarvam Secrets.
The secret must match the value set through Inai's `setWebhookSecret` reducer.

### `get_wedding_context`

- Lifecycle: **on_start**, and also enabled **during conversation**.
- Method: `GET`
- URL: `https://maincloud.spacetimedb.com/v1/database/DATABASE_ID/route/voice/context`
- Header: `Authorization: Bearer {{INAI_VOICE_WEBHOOK_SECRET}}`
- Query parameter: `phone` = select Sarvam's **User Identifier** call-context
  variable from the variable picker (inbound calls supply it in E.164 format).
- Timeout: 5 seconds.
- Failure reply: “I can’t reach the wedding details right now. Please try again
  in a little while.”

Current response fields are `name`, `role`, `side`, `weddings`, `events`,
`decisions`, and `openTasks`. Events and decisions are restricted to weddings
where the caller is a member; tasks are restricted to tasks owned by the
caller. An event with `state=reported` is not settled information and must be
phrased that way. Extend this response as RSVP, travel, consent, and
private-budget tables are added; never solve scope control with prompt
instructions alone.

### `report_task_completion`

- Lifecycle: **on_end**.
- Method: `POST`
- URL: `https://maincloud.spacetimedb.com/database/DATABASE_ID/voice/report-task-done`
- Header: `Authorization: Bearer {{INAI_VOICE_WEBHOOK_SECRET}}`
- JSON body:

```json
{
  "phone": "<Sarvam User Identifier>",
  "taskId": "<task id repeated back and confirmed by the caller>",
  "confidence": 0.9
}
```

Only send this after the caller says yes to a read-back such as: “I heard that
the flowers are arranged. Is that right?” A successful response means
`state=reported`, not that the task is complete.

### `post_call_suggestion`

- Lifecycle: **on_end**, after the worker has transcribed the caller's note
  and prepared one short suggested next step.
- Method: `POST`
- URL: `https://maincloud.spacetimedb.com/v1/database/DATABASE_ID/route/voice/call-suggestion`
- Header: `Authorization: Bearer {{INAI_VOICE_WEBHOOK_SECRET}}`
- JSON body:

```json
{
  "phone": "<Sarvam User Identifier>",
  "weddingId": "<wedding id from get_wedding_context>",
  "note": "Mum said the caterer still needs the final guest count by Friday.",
  "suggestion": "Please review whether Priya should confirm the guest count with the caterer.",
  "confidence": 0.86
}
```

This adds a single **Call note · needs review** item to the shared wedding
chat. Both the note and suggestion are saved as `reported`; the endpoint does
not create work, place a call, contact a vendor, or update a confirmed plan.
Do not call it unless the caller has heard and agreed to the read-back of the
note. Omit `weddingId` only when the caller belongs to exactly one wedding.

## Family help line instructions

Paste and adapt this into the agent instructions:

> You are Inai, a calm wedding coordinator for Indian families. Speak in the
> caller's language and keep each answer short and practical. At the start of
> every call, use `get_wedding_context` to identify the caller and fetch their
> current information. Only answer from tool results. If the caller is not
> recognised, explain that their phone number needs to be linked by the couple
> or planner; do not disclose wedding information. You may answer questions
> about the caller's own open tasks and event information they are allowed to
> see. You may collect an update only about a task they own. Repeat the update
> in plain language and ask for an explicit yes. Never finalise a decision,
> approve a payment, make a vendor commitment, or state an unconfirmed fact as
> settled. If the caller asks for an answer not in the live context, say you
> will ask the family to confirm it. Do not mention internal tools, databases,
> confidence, provenance, or workflows.

## Agent-specific additions

- **Coordinator check-in:** Its call-job worker must supply exactly the
  caller's owned open items. Begin every outbound call with: “This is Inai,
  helping with [name]'s wedding. This call may be transcribed.” Do not create
  an outbound campaign until `CallJob`, channel preference, and frequency-cap
  checks are live.
- **Guest travel desk:** Add tools for RSVP, invite scope and travel details.
  Travel details extracted from speech or OCR are always `reported` until the
  guest/human confirms them. Pickup roster changes create owned human tasks.
- **Vendor liaison:** Require a `VendorConsent` lookup tool before an outbound
  call is scheduled. If consent is missing, draft a WhatsApp message for the
  responsible human instead.
- **Event-day help line:** Add an event-day context tool for confirmed event
  timing, venues, and precomputed leaving times. Maps and route calculations
  run outside SpaceTimeDB and write results back with provenance.

## Architecture boundary

Sarvam calls the API tools *during* a conversation, which is what makes the
answer live. The optional Sarvam deployment webhook runs after an inbound call
finishes and is useful for transcript/audit ingestion, not live Q&A.

SpaceTimeDB reducers remain deterministic. They store state and decide future
contact jobs. Sarvam, telephony, LLM extraction, maps, and outbound calling
remain outside reducers.
