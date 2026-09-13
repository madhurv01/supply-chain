from fastapi import APIRouter, Depends
from pydantic import BaseModel

from backend.agent.orchestrator import run_agent_chat
from backend.auth import CurrentUser, get_current_user
from backend.supabase_client import get_client

router = APIRouter(prefix="/agent", tags=["agent"])


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]


@router.post("/chat")
async def chat(body: ChatRequest, user: CurrentUser = Depends(get_current_user)):
    client = get_client(user.token)
    messages = [m.model_dump() for m in body.messages]
    return await run_agent_chat(client, user.id, messages)
