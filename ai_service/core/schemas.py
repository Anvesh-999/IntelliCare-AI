import uuid
import re
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, model_validator

class ChatMessage(BaseModel):
    """Individual conversational turn message."""
    role: str = Field(description="Role of the sender: 'user', 'assistant', or 'system'")
    content: str = Field(description="Text content of the message")

class ChatRequest(BaseModel):
    """
    Request model for AI Chat endpoint.
    Supports both new contract ('message', 'conversation_id') and legacy ('query', 'health_profile').
    """
    message: Optional[str] = Field(default=None, description="The user query or prompt")
    query: Optional[str] = Field(default=None, description="Backward compatibility alias for message")
    conversation_id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="Conversation identifier")
    health_profile: Optional[Dict[str, Any]] = Field(default=None, description="Optional authorized patient profile context")
    consent_given: bool = Field(default=False, description="Explicit patient consent to access and inject personal medical records")
    history: List[ChatMessage] = Field(default_factory=list, description="Optional previous conversation turns")
    model: Optional[str] = Field(default=None, description="Configurable model override")
    temperature: Optional[float] = Field(default=None, description="Sampling temperature")

    @model_validator(mode="before")
    @classmethod
    def resolve_message_field(cls, data: Any) -> Any:
        if isinstance(data, dict):
            # Normalize 'query' into 'message' if 'message' is missing
            if not data.get("message") and data.get("query"):
                data["message"] = data.get("query")
            # If conversation_id is empty, generate one
            if not data.get("conversation_id"):
                data["conversation_id"] = str(uuid.uuid4())
        return data

    @model_validator(mode="after")
    def validate_content_and_sanitize(self) -> "ChatRequest":
        raw_msg = self.message or self.query
        if not raw_msg or not raw_msg.strip():
            raise ValueError("Chat message content cannot be empty.")
        
        # Max length validation
        clean_text = raw_msg.strip()
        if len(clean_text) > 4000:
            clean_text = clean_text[:4000]
        
        # Strip potential null bytes or non-printable control characters
        clean_text = re.sub(r'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', '', clean_text)
        
        self.message = clean_text
        self.query = clean_text
        return self

class ChatResponse(BaseModel):
    """
    Validated response model for AI Chat endpoint.
    """
    success: bool = True
    response: str = Field(description="Assistant message text")
    message: str = Field(description="Alias for response")
    conversation_id: str = Field(description="Conversation identifier")
    provider: str = Field(default="gemini", description="LLM provider name")
    model: str = Field(description="Model utilized for generation")
    disclaimer: str = Field(
        default="This AI assistant provides educational health information and does NOT replace professional medical diagnosis or care. In case of an emergency, call emergency services immediately.",
        description="Clinical disclaimer"
    )
    error: Optional[str] = Field(default=None, description="Error message if operation encountered an issue")
    metadata: Optional[Dict[str, Any]] = Field(default=None, description="Additional response metadata")

    @model_validator(mode="before")
    @classmethod
    def sync_message_field(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if "response" in data and "message" not in data:
                data["message"] = data["response"]
            elif "message" in data and "response" not in data:
                data["response"] = data["message"]
        return data
