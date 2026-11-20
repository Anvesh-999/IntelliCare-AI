"""
Pydantic schemas for LLM tool calling in IntelliCare AI.
Provides strict type-checking, field descriptions, and structured outputs for tool execution.
"""

from typing import List, Optional, Dict, Any, Literal
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Tool Input Argument Schemas
# ---------------------------------------------------------------------------

class DrugInteractionInput(BaseModel):
    medicines: List[str] = Field(
        ...,
        min_length=1,
        description="List of medication names to check for drug-drug interactions (e.g. ['Aspirin', 'Warfarin'])."
    )


class ExtractPrescriptionInput(BaseModel):
    raw_text: str = Field(
        ...,
        min_length=3,
        description="Raw unstructured text from a prescription note or OCR scan."
    )


class InterpretReportInput(BaseModel):
    report_text: str = Field(
        ...,
        min_length=5,
        description="Clinical diagnostic text or lab panel values to interpret."
    )
    patient_context: Optional[str] = Field(
        default=None,
        description="Optional patient health background, such as known conditions or demographics."
    )


class RetrieveMedicalReferenceInput(BaseModel):
    query: str = Field(
        ...,
        min_length=3,
        description="Clinical question or medical term to search in verified clinical guidelines."
    )
    top_k: Optional[int] = Field(
        default=3,
        ge=1,
        le=10,
        description="Maximum number of relevant clinical guideline passages to retrieve."
    )


class GetPatientReportInput(BaseModel):
    patient_id: str = Field(
        ...,
        min_length=1,
        description="Unique identifier of the patient whose report is requested."
    )
    report_type: Optional[str] = Field(
        default=None,
        description="Optional report category filter (e.g. 'blood_report', 'lipid_panel', 'prescription')."
    )


# ---------------------------------------------------------------------------
# Tool Execution Metadata & Request/Response Models
# ---------------------------------------------------------------------------

class ToolExecutionRequest(BaseModel):
    tool_name: str = Field(..., description="Name of the registered tool to execute.")
    arguments: Dict[str, Any] = Field(default_factory=dict, description="Key-value arguments for the tool.")
    user_context: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Security context of the caller (e.g. {'user_id': 'patient-101', 'role': 'patient'})."
    )


class ToolExecutionResponse(BaseModel):
    tool_name: str
    success: bool
    result: Optional[Any] = None
    error: Optional[str] = None
    execution_time_ms: float
    disclaimer: Optional[str] = None


class ToolChatRequest(BaseModel):
    message: str = Field(..., min_length=1, description="User question or instruction.")
    conversation_id: Optional[str] = Field(default=None, description="Conversation identifier.")
    patient_id: Optional[str] = Field(default=None, description="Patient identifier context.")
    user_role: Optional[str] = Field(default="patient", description="Role of caller: 'patient', 'doctor', 'admin'.")
    allowed_tools: Optional[List[str]] = Field(default=None, description="Optional restriction on which tools may be called.")


class ToolChatResponse(BaseModel):
    response: str
    conversation_id: Optional[str] = None
    tools_called: List[Dict[str, Any]] = Field(default_factory=list)
    iteration_count: int = 1
    requires_clinician_review: bool = False
    disclaimer: str = (
        "This response was generated with the assistance of automated clinical tools. "
        "It is for educational and informational purposes only and does not constitute formal medical advice."
    )
