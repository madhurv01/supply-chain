import json

from backend.agent.tools import TOOL_DISPATCH, TOOL_SCHEMA
from backend.config import settings

SYSTEM_PROMPT = (
    "You are Agri-Chain OS's AI operations agent. You help farm operators with price forecasting, "
    "market analysis, farm plot management, inventory, logistics (shipments), and finance/sales. "
    "You have tools to look up and act on all of this data directly — use them instead of guessing. "
    "Be concise. Always use ₹ for currency. After answering, proactively suggest a sensible next action "
    "when relevant (e.g. suggest shipping ready inventory, or logging a sale for an arrived shipment)."
)

MAX_ITERATIONS = 6


async def run_agent_chat(client, user_id: str, messages: list[dict]) -> dict:
    if not settings.GROQ_API_KEY:
        return {
            "reply": (
                "The AI agent is not configured yet. Add a GROQ_API_KEY to backend/.env "
                "(get a free key at console.groq.com) and restart the backend to enable it."
            ),
            "tool_calls": [],
        }

    from groq import Groq

    groq_client = Groq(api_key=settings.GROQ_API_KEY)

    chat_messages = [{"role": "system", "content": SYSTEM_PROMPT}] + messages
    trace = []

    for _ in range(MAX_ITERATIONS):
        response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=chat_messages,
            tools=TOOL_SCHEMA,
            tool_choice="auto",
        )
        choice = response.choices[0]
        msg = choice.message

        if not msg.tool_calls:
            return {"reply": msg.content or "", "tool_calls": trace}

        chat_messages.append(
            {
                "role": "assistant",
                "content": msg.content or "",
                "tool_calls": [
                    {
                        "id": tc.id,
                        "type": "function",
                        "function": {"name": tc.function.name, "arguments": tc.function.arguments},
                    }
                    for tc in msg.tool_calls
                ],
            }
        )

        for tc in msg.tool_calls:
            name = tc.function.name
            try:
                args = json.loads(tc.function.arguments or "{}")
            except json.JSONDecodeError:
                args = {}

            fn = TOOL_DISPATCH.get(name)
            if fn is None:
                result = {"error": f"Unknown tool '{name}'"}
            else:
                try:
                    result = fn(client, user_id, **args)
                except Exception as exc:
                    result = {"error": str(exc)}

            trace.append({"tool": name, "arguments": args, "result": result})
            chat_messages.append(
                {
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": json.dumps(result, default=str),
                }
            )

    return {
        "reply": "I reached the maximum number of tool-call steps. Please refine your request.",
        "tool_calls": trace,
    }
