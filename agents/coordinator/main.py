"""In-app Coordinator draft service.

This service never calls, messages, spends, or changes wedding state. A caller
supplies an already-authorized coordinator request and receives a draft for a
human to review. Persisting or acting on the draft belongs to a separately
authorized SpaceTimeDB reducer/worker flow.
"""

import os
from functools import lru_cache

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from langgraph.graph import END, START, StateGraph
from openai import OpenAI
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    openai_api_key: str
    openai_model: str = "gpt-4.1-mini"


class DraftRequest(BaseModel):
    request_id: str = Field(min_length=1)
    kind: str = Field(pattern="^(remind|followup|summarize)$")
    owner_name: str = Field(min_length=1)
    instruction: str = Field(min_length=1, max_length=2000)
    scheduled_for: str | None = None


class DraftResponse(BaseModel):
    request_id: str
    draft: str
    needs_human_review: bool = True
    action: str = "draft_only"


class AgentDeployment(BaseModel):
    """A user-created assistant activated by the live wedding surface.

    This is deliberately configuration, not authority. The agent can only
    prepare drafts and the record remains the source of truth in SpaceTimeDB.
    """
    wedding_id: str = Field(min_length=1)
    agent_id: str = Field(min_length=1)
    name: str = Field(min_length=1, max_length=80)
    instructions: str = Field(min_length=1, max_length=2000)


class DeploymentResponse(BaseModel):
    agent_id: str
    status: str = "active"
    action: str = "draft_only"


SYSTEM_PROMPT = """You are Inai's in-app wedding Coordinator. Write a short,
kind reviewable draft. For a reminder or follow-up, write for the named person
about their single task. For a summary, clearly separate confirmed facts from
items that still need review. Do not claim an action happened, make decisions,
commit money, contact vendors, or send a message. Do not mention tools or
policies. Return plain text only."""


@lru_cache
def settings() -> Settings:
    return Settings()


def make_draft(state: dict) -> dict:
    request: DraftRequest = state["request"]
    client = OpenAI(api_key=settings().openai_api_key)
    when = f" Planned reminder time: {request.scheduled_for}." if request.scheduled_for else ""
    response = client.responses.create(
        model=settings().openai_model,
        instructions=SYSTEM_PROMPT,
        input=f"Person: {request.owner_name}\nRequest type: {request.kind}\nTask: {request.instruction}.{when}",
    )
    return {"request": request, "draft": response.output_text.strip()}


workflow = StateGraph(dict)
workflow.add_node("make_draft", make_draft)
workflow.add_edge(START, "make_draft")
workflow.add_edge("make_draft", END)
draft_graph = workflow.compile()

app = FastAPI(title="Inai Coordinator", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in os.getenv("AGENT_ALLOWED_ORIGINS", "http://localhost:5173").split(",") if origin.strip()],
    allow_methods=["POST"],
    allow_headers=["Content-Type"],
)

# The worker keeps the active runtime configuration in memory; production
# workers should also subscribe to `custom_wedding_agent` so a restart simply
# rebuilds this cache from the deterministic source of truth.
active_agents: dict[tuple[str, str], AgentDeployment] = {}


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/v1/agents/deploy", response_model=DeploymentResponse)
def deploy_agent(agent: AgentDeployment) -> DeploymentResponse:
    active_agents[(agent.wedding_id, agent.agent_id)] = agent
    return DeploymentResponse(agent_id=agent.agent_id)


@app.post("/v1/drafts", response_model=DraftResponse)
def create_draft(request: DraftRequest) -> DraftResponse:
    try:
        result = draft_graph.invoke({"request": request})
    except Exception as error:
        raise HTTPException(status_code=502, detail="The Coordinator could not prepare a draft. Try again shortly.") from error
    draft = result.get("draft", "")
    if not draft:
        raise HTTPException(status_code=502, detail="The Coordinator returned an empty draft.")
    return DraftResponse(request_id=request.request_id, draft=draft)
