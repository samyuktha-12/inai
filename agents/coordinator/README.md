# In-app Coordinator

This FastAPI + LangGraph service produces drafts for confirmed, task-linked
`coordinator_request` rows. It is intentionally in-app only: it never calls,
sends WhatsApp, books, spends, or promotes a draft to confirmed state.

## Setup

```bash
cd agents/coordinator
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Put your API key in `agents/coordinator/.env`:

```env
OPENAI_API_KEY=your_key_here
```

Run it with:

```bash
uvicorn main:app --reload --port 8000
```

Set `VITE_AGENT_RUNTIME_URL=http://127.0.0.1:8000` in the web app's `.env`
when running locally. Each custom assistant is registered with
`POST /v1/agents/deploy` immediately after it is created and becomes available
on every Inai screen. In production, set this to the deployed worker URL; the
worker should also subscribe to `custom_wedding_agent` to rebuild its active
configuration after a restart.
Set `AGENT_ALLOWED_ORIGINS` on the worker to the web app's origin (comma-
separate multiple origins) so the activation request can be accepted.

Test without exposing a key to the browser:

```bash
curl -X POST http://127.0.0.1:8000/v1/drafts \
  -H 'content-type: application/json' \
  -d '{"request_id":"demo","kind":"followup","owner_name":"Rahul","instruction":"ask for the flower quote"}'
```

The next integration step is a server-side SpaceTimeDB subscriber using a
service identity. It should read only open coordinator requests, verify the
linked task is still open and owned by the target, request this draft, then
write a `reported` proposal for a human to approve. Do not put the API key in
the React app, SpaceTimeDB module, or a `VITE_*` variable.
