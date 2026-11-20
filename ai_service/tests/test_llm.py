import pytest
from fastapi.testclient import TestClient

from main import app
from core.config import settings, mask_secret, sanitize_for_logs
from core.schemas import ChatRequest, ChatResponse, ChatMessage
from core.prompt_service import format_user_prompt, build_system_instruction
from core.llm_service import (
    GeminiProvider,
    MockLLMProvider,
    LLMAuthenticationError,
    LLMTimeoutError,
    LLMProviderError
)

client = TestClient(app)

# 1. Test Configuration and Secret Masking
def test_secret_masking():
    assert mask_secret(None) == "<not set>"
    assert mask_secret("") == "<not set>"
    assert mask_secret("short") == "***"
    secret = "AIzaSyD-1234567890abcdefghijklmnopqrstuv"
    masked = mask_secret(secret)
    assert masked.startswith("AIza")
    assert masked.endswith("stuv")
    assert "1234567890" not in masked

def test_sanitize_logs():
    raw_log = "Error with key AIzaSyD1234567890abcdefghijklmnopqrstu and patient SSN 123-45-6789"
    sanitized = sanitize_for_logs(raw_log)
    assert "AIza" not in sanitized
    assert "123-45-6789" not in sanitized
    assert "[MASKED_GEMINI_KEY]" in sanitized
    assert "[MASKED_SSN]" in sanitized

# 2. Test Schemas
def test_chat_request_validation():
    # Valid new contract
    req = ChatRequest(message="What is hypertension?", conversation_id="conv-101")
    assert req.message == "What is hypertension?"
    assert req.query == "What is hypertension?"
    assert req.conversation_id == "conv-101"

    # Backward compatibility with 'query'
    legacy_req = ChatRequest(query="Explain cholesterol")
    assert legacy_req.message == "Explain cholesterol"
    assert legacy_req.conversation_id is not None

    # Empty message should raise ValueError
    with pytest.raises(ValueError):
        ChatRequest(message="   ")

def test_chat_response_schema():
    resp = ChatResponse(
        response="Hemoglobin carries oxygen.",
        conversation_id="conv-abc",
        model="gemini-2.5-flash"
    )
    assert resp.success is True
    assert resp.message == "Hemoglobin carries oxygen."
    assert "educational health information" in resp.disclaimer

# 3. Test Prompt Construction & Injection Guardrails
def test_prompt_formatting():
    sys_prompt = build_system_instruction()
    assert "NEVER PRESCRIBE DOSAGES" in sys_prompt
    assert "EMERGENCY INTERCEPTION" in sys_prompt

    profile = {
        "name": "Jane Doe",
        "conditions": ["Type 2 Diabetes"],
        "medications": ["Metformin 500mg"],
        "allergies": ["Penicillin"]
    }
    user_prompt = format_user_prompt("Can I take Aspirin?", health_profile=profile)
    assert "<patient_context>" in user_prompt
    assert "</patient_context>" in user_prompt
    assert "Jane Doe" in user_prompt
    assert "Type 2 Diabetes" in user_prompt
    assert "CONFIDENTIAL CLINICAL RECORD" in user_prompt
    assert "User Question: Can I take Aspirin?" in user_prompt

# 4. Test Gemini Provider Authentication Failure on Missing Key
@pytest.mark.asyncio
async def test_gemini_provider_fails_safely_without_key():
    provider = GeminiProvider(api_key="")
    with pytest.raises(LLMAuthenticationError):
        await provider.generate_response(prompt="Hello")

# 5. Test Mock Provider (Deterministic test fixture)
@pytest.mark.asyncio
async def test_mock_provider_generation():
    provider = MockLLMProvider()
    res = await provider.generate_response(prompt="Explain what hemoglobin means")
    assert "Hemoglobin is the iron-rich protein" in res["text"]
    assert res["provider"] == "mock"

# 6. Test API Endpoints via TestClient
def test_health_check_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "llm_provider" in data

def test_api_chat_rejects_empty():
    response = client.post("/ai/chat", json={"message": "   "})
    assert response.status_code == 422

def test_api_chat_with_mock_provider(monkeypatch):
    import main
    monkeypatch.setattr(main, "get_llm_service", lambda: MockLLMProvider())

    payload = {
        "message": "Explain what hemoglobin means",
        "conversation_id": "test-conv-001",
        "health_profile": {
            "name": "Alice",
            "conditions": ["Mild Anemia"]
        }
    }
    response = client.post("/ai/chat", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "Hemoglobin" in data["response"]
    assert data["conversation_id"] == "test-conv-001"
    assert data["model"] == "mock-clinical-model"

def test_legacy_chat_payload_compatibility(monkeypatch):
    import main
    monkeypatch.setattr(main, "get_llm_service", lambda: MockLLMProvider())

    # Legacy payload format used by backend/routes/patients.js
    payload = {
        "query": "Explain what hemoglobin means",
        "health_profile": {
            "name": "Bob"
        }
    }
    response = client.post("/ai/chat", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "response" in data
    assert "disclaimer" in data
