"""
Comprehensive automated tests for Phase 5: LLM Tool Calling.
Tests:
- Tool registration and catalog listing
- Rejection of unregistered / arbitrary tool calls
- Strict Pydantic argument validation
- Execution of all 5 candidate tools
- Role-based authorization & cross-patient data access prevention
- Execution timeout bounds
- Bounded tool iteration loop
- FastAPI endpoints (/ai/tools, /ai/tools/execute, /ai/tools/chat)
"""

import asyncio
import pytest
from fastapi.testclient import TestClient

from main import app
from tools.registry import ToolRegistry, get_tool_registry
from tools.schemas import ToolChatRequest
from tools.agent import ToolAgent
from core.llm_service import MockLLMProvider


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def registry():
    return ToolRegistry()


def test_tool_registry_registration_and_listing(registry):
    """Verifies that all 5 required tools are registered with schemas and metadata."""
    tools = registry.list_tools()
    tool_names = {t["name"] for t in tools}
    expected = {
        "lookup_drug_interaction",
        "extract_prescription",
        "interpret_report",
        "retrieve_medical_reference",
        "get_patient_report"
    }
    assert expected.issubset(tool_names)
    
    declarations = registry.get_declarations()
    assert len(declarations) >= 5
    for decl in declarations:
        assert "name" in decl
        assert "description" in decl
        assert "parameters" in decl
        assert decl["parameters"]["type"] == "object"


@pytest.mark.asyncio
async def test_unregistered_tool_rejection(registry):
    """Ensures arbitrary, unapproved, or malicious tool execution is strictly rejected."""
    result = await registry.execute_tool(
        name="run_arbitrary_shell_command",
        arguments={"cmd": "whoami"},
        user_context={"role": "admin"}
    )
    assert result.success is False
    assert "not registered" in result.error.lower()


@pytest.mark.asyncio
async def test_tool_argument_validation(registry):
    """Verifies that invalid or missing arguments fail safely before execution."""
    # Missing required 'medicines' parameter
    result = await registry.execute_tool(
        name="lookup_drug_interaction",
        arguments={"wrong_key": ["aspirin"]},
        user_context={"role": "patient"}
    )
    assert result.success is False
    assert "invalid arguments" in result.error.lower()


@pytest.mark.asyncio
async def test_tool_drug_interaction_execution(registry):
    """Verifies drug interaction tool identifies severe contraindications."""
    result = await registry.execute_tool(
        name="lookup_drug_interaction",
        arguments={"medicines": ["Aspirin", "Warfarin"]},
        user_context={"role": "patient"}
    )
    assert result.success is True
    assert result.result["has_interactions"] is True
    assert len(result.result["interactions"]) > 0
    assert "bleeding" in result.result["interactions"][0]["explanation"].lower()
    assert result.disclaimer is not None


@pytest.mark.asyncio
async def test_tool_extract_prescription_execution(registry):
    """Verifies prescription parsing tool extracts structured medications."""
    sample_text = "Rx: Amoxicillin 500mg, take 1 tablet three times daily for 7 days."
    result = await registry.execute_tool(
        name="extract_prescription",
        arguments={"raw_text": sample_text},
        user_context={"role": "patient"}
    )
    assert result.success is True
    meds = result.result["medicines_extracted"]
    assert len(meds) > 0
    assert any(m["medicine_name"].lower() == "amoxicillin" for m in meds)


@pytest.mark.asyncio
async def test_tool_interpret_report_execution(registry):
    """Verifies report interpretation tool flags clinical anomalies."""
    lab_text = "Lipid Panel:\nTotal Cholesterol: 240 mg/dL (High)\nHDL: 35 mg/dL (Low)\nLDL: 155 mg/dL (High)"
    result = await registry.execute_tool(
        name="interpret_report",
        arguments={"report_text": lab_text},
        user_context={"role": "patient"}
    )
    assert result.success is True
    assert len(result.result["anomalies_detected"]) > 0
    assert result.result["requires_clinician_review"] is True


@pytest.mark.asyncio
async def test_tool_retrieve_medical_reference_execution(registry):
    """Verifies medical reference tool returns guideline citations."""
    result = await registry.execute_tool(
        name="retrieve_medical_reference",
        arguments={"query": "hypertension blood pressure stage 1", "top_k": 2},
        user_context={"role": "doctor"}
    )
    assert result.success is True
    assert result.result["evidence_count"] > 0
    refs = result.result["references"]
    assert len(refs) > 0
    assert "guideline" in refs[0]["title"].lower() or "reference" in refs[0]["title"].lower()


@pytest.mark.asyncio
async def test_tool_patient_report_authorization_own_record(registry):
    """Verifies a patient can access their own report."""
    result = await registry.execute_tool(
        name="get_patient_report",
        arguments={"patient_id": "patient-101"},
        user_context={"role": "patient", "patient_id": "patient-101", "user_id": "patient-101"}
    )
    assert result.success is True
    assert result.result["name"] == "Sarah Jenkins"
    assert len(result.result["reports"]) > 0


@pytest.mark.asyncio
async def test_tool_patient_report_cross_patient_access_strictly_prevented(registry):
    """Verifies that patient A cannot access patient B's report."""
    result = await registry.execute_tool(
        name="get_patient_report",
        arguments={"patient_id": "patient-102"},
        user_context={"role": "patient", "patient_id": "patient-101", "user_id": "patient-101"}
    )
    assert result.success is False
    assert "access denied" in result.error.lower()
    assert "strictly prohibited" in result.error.lower()


@pytest.mark.asyncio
async def test_tool_patient_report_doctor_access(registry):
    """Verifies doctor role can access clinical patient reports."""
    result = await registry.execute_tool(
        name="get_patient_report",
        arguments={"patient_id": "patient-102"},
        user_context={"role": "doctor", "user_id": "dr-smith"}
    )
    assert result.success is True
    assert result.result["name"] == "David Chen"


@pytest.mark.asyncio
async def test_tool_execution_timeout_enforcement(registry):
    """Verifies slow tool execution is terminated when exceeding timeout limit."""
    from pydantic import BaseModel
    class SlowInput(BaseModel):
        delay: float

    async def slow_handler(delay: float, user_context=None):
        await asyncio.sleep(delay)
        return {"done": True}

    registry.register(
        name="slow_tool",
        description="Simulated slow tool",
        input_schema=SlowInput,
        handler=slow_handler,
        timeout_seconds=0.1
    )

    result = await registry.execute_tool(
        name="slow_tool",
        arguments={"delay": 0.5},
        user_context={"role": "admin"}
    )
    assert result.success is False
    assert "timed out" in result.error.lower()


@pytest.mark.asyncio
async def test_tool_agent_bounded_iterations():
    """Verifies ToolAgent does not exceed bounded max iteration limit."""
    agent = ToolAgent(llm_provider=MockLLMProvider())
    req = ToolChatRequest(
        message="Can I take aspirin and warfarin together?",
        patient_id="patient-101",
        user_role="patient"
    )
    res = await agent.run(req, max_iterations=2)
    assert res.iteration_count <= 2
    assert len(res.tools_called) <= 2
    assert "aspirin" in res.response.lower() or "warfarin" in res.response.lower()
    assert res.requires_clinician_review is True


def test_api_tools_list_endpoint(client):
    """Tests GET /ai/tools endpoint returns catalog."""
    resp = client.get("/ai/tools")
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert len(data["tools"]) >= 5


def test_api_tools_execute_endpoint(client):
    """Tests POST /ai/tools/execute endpoint with drug interaction check."""
    payload = {
        "tool_name": "lookup_drug_interaction",
        "arguments": {"medicines": ["Lisinopril", "Potassium"]},
        "user_context": {"role": "doctor", "user_id": "dr-jones"}
    }
    resp = client.post("/ai/tools/execute", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["result"]["has_interactions"] is True


def test_api_tools_chat_endpoint(client, monkeypatch):
    """Tests POST /ai/tools/chat agentic tool calling endpoint."""
    payload = {
        "message": "Check interactions between Aspirin and Warfarin",
        "conversation_id": "test-conv-tools-1",
        "patient_id": "patient-101",
        "user_role": "patient"
    }
    resp = client.post("/ai/tools/chat", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["tools_called"]) > 0
    assert "aspirin" in data["response"].lower() or "warfarin" in data["response"].lower()
    assert data["conversation_id"] == "test-conv-tools-1"
