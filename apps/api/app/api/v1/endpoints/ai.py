from fastapi import APIRouter
from apps.api.app.schemas import AIChatRequest, AIChatResponse
from apps.api.app.engine.ai_agent import AIAssistantAgent

router = APIRouter()


@router.post("/chat", response_model=AIChatResponse)
async def chat_with_assistant(request: AIChatRequest):
    """
    Conversational AI Transportation Assistant with grounded tool calling.
    Answers route questions, compares alternatives, computes costs, and triggers optimizations.
    """
    history_dicts = [{"role": m.role, "content": m.content} for m in (request.history or [])]
    result = await AIAssistantAgent.process_user_query(
        message=request.message,
        history=history_dicts,
        context=request.current_context
    )

    return AIChatResponse(
        reply=result["reply"],
        tool_calls_made=result.get("tool_calls_made", []),
        suggested_action=result.get("suggested_action")
    )
