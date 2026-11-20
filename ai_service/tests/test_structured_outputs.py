import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from main import app
from core.structured_schemas import (
    LabFinding,
    ReportExplanationResponse,
    PrescribedMedicine,
    PrescriptionExtractionResponse,
    ClinicalGeneralResponse,
    KnowledgeRetrievalResponse,
    RetrievedEvidence,
    ToolExecutionResult
)
from core.llm_service import (
    extract_and_validate_json,
    LLMSchemaValidationError,
    MockLLMProvider
)

client = TestClient(app)

# 1. Test Schema Definitions and Validation
def test_clinical_general_response_schema():
    resp = ClinicalGeneralResponse(
        summary="Hemoglobin is an oxygen-carrying protein in red blood cells.",
        findings=["Normal reference range is 12.0–17.0 g/dL.", "Iron is essential for synthesis."],
        sources=["National Institutes of Health (NIH)", "Mayo Clinic Reference Guidelines"],
        urgency_level="Low",
        requires_clinician_review=False
    )
    assert resp.summary.startswith("Hemoglobin")
    assert len(resp.findings) == 2
    assert len(resp.sources) == 2
    assert resp.urgency_level == "Low"
    assert resp.requires_clinician_review is False
    assert "educational" in resp.disclaimer.lower()

def test_report_explanation_schema_separation_of_facts():
    finding = LabFinding(
        panel="Lipid Panel",
        metric="Total Cholesterol",
        value="240 mg/dL",
        reference_range="< 200 mg/dL",
        status="High",
        explanation="Elevated cholesterol increases cardiovascular risk."
    )
    resp = ReportExplanationResponse(
        summary="Lipid panel shows elevated cholesterol levels.",
        anomalies=["Elevated Total Cholesterol"],
        findings=[finding],
        recommendations=["Adopt low-saturated fat diet", "Schedule follow-up lipid test"],
        requires_clinician_review=True
    )
    assert resp.findings[0].value == "240 mg/dL"
    assert resp.findings[0].status == "High"
    assert resp.requires_clinician_review is True
    assert len(resp.limitations) > 0

def test_prescription_extraction_schema():
    med = PrescribedMedicine(
        medicine_name="Amoxicillin",
        dosage="500mg",
        frequency="Three times daily",
        duration="7 days",
        instructions="Take with water after meals",
        confidence=0.99
    )
    resp = PrescriptionExtractionResponse(
        patient_name="John Doe",
        prescriber_name="Dr. Smith",
        date="2026-11-20",
        medicines=[med],
        warnings=["Complete full 7-day course."]
    )
    assert resp.medicines[0].medicine_name == "Amoxicillin"
    assert resp.requires_pharmacist_verification is True

# 2. Test JSON Extraction & Fence Handling
def test_extract_and_validate_json_raw():
    raw_json = '{"summary": "Test summary", "findings": ["Fact 1"], "sources": ["CDC"], "urgency_level": "Low", "requires_clinician_review": false}'
    res = extract_and_validate_json(raw_json, ClinicalGeneralResponse)
    assert res.summary == "Test summary"
    assert res.sources == ["CDC"]

def test_extract_and_validate_json_markdown_fences():
    fenced_json = """```json
    {
      "summary": "Fenced summary",
      "findings": ["Fact 2"],
      "sources": ["WHO Guidelines"],
      "urgency_level": "Moderate",
      "requires_clinician_review": true
    }
    ```"""
    res = extract_and_validate_json(fenced_json, ClinicalGeneralResponse)
    assert res.summary == "Fenced summary"
    assert res.urgency_level == "Moderate"

def test_extract_and_validate_json_invalid_fails_safely():
    invalid_json = "This is not valid json at all"
    with pytest.raises(LLMSchemaValidationError):
        extract_and_validate_json(invalid_json, ClinicalGeneralResponse)

# 3. Test API Endpoint /ai/chat/structured
def test_structured_chat_endpoint_general(monkeypatch):
    import main
    monkeypatch.setattr(main, "get_llm_service", lambda: MockLLMProvider())

    payload = {
        "message": "Explain what hemoglobin means",
        "response_type": "general",
        "conversation_id": "conv-struct-1"
    }
    response = client.post("/ai/chat/structured", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "summary" in data
    assert "findings" in data
    assert "sources" in data
    assert "limitations" in data
    assert "urgency_level" in data
    assert "requires_clinician_review" in data
    assert "disclaimer" in data

def test_structured_chat_endpoint_report(monkeypatch):
    import main
    monkeypatch.setattr(main, "get_llm_service", lambda: MockLLMProvider())

    payload = {
        "message": "Cholesterol: 240 mg/dL, HDL: 35 mg/dL, LDL: 155 mg/dL",
        "response_type": "report"
    }
    response = client.post("/ai/chat/structured", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "summary" in data
    assert "anomalies" in data
    assert "findings" in data
    assert len(data["findings"]) > 0
    assert "status" in data["findings"][0]

def test_structured_chat_endpoint_prescription(monkeypatch):
    import main
    monkeypatch.setattr(main, "get_llm_service", lambda: MockLLMProvider())

    payload = {
        "message": "Amoxicillin 500mg TID 7 days",
        "response_type": "prescription"
    }
    response = client.post("/ai/chat/structured", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "medicines" in data
    assert len(data["medicines"]) > 0
    assert data["medicines"][0]["medicine_name"] == "Amoxicillin"
    assert data["requires_pharmacist_verification"] is True

def test_structured_chat_endpoint_rejects_empty():
    response = client.post("/ai/chat/structured", json={"message": "   "})
    assert response.status_code == 422

# 4. Test Summarize Endpoint Returns Structured Schema
def test_summarize_endpoint_returns_structured_schema():
    payload = {"report_text": "Lipid Panel:\nCholesterol: 240 mg/dL (High)\nHDL: 35 mg/dL (Low)"}
    res = client.post("/ai/summarize", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert "summary" in data
    assert "anomalies" in data
    assert "findings" in data
    assert "recommendations" in data
    assert "limitations" in data
    assert "requires_clinician_review" in data
    assert "disclaimer" in data
