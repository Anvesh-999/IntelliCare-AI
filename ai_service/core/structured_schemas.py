from typing import List, Optional, Dict, Any, Literal
from pydantic import BaseModel, Field, field_validator

class LabFinding(BaseModel):
    """Individual structured lab finding or metric."""
    panel: str = Field(description="Laboratory panel name, e.g., 'Lipid Panel', 'CBC'")
    metric: str = Field(description="Specific analyte or test name, e.g., 'HDL Cholesterol'")
    value: Optional[str] = Field(default=None, description="Reported numerical or categorical value with original units")
    reference_range: Optional[str] = Field(default=None, description="Established standard reference range for comparison")
    status: Literal["Normal", "Low", "High", "Needs Attention", "Inconclusive"] = Field(
        default="Normal",
        description="Clinical status relative to reference interval"
    )
    explanation: str = Field(description="Plain-language educational explanation of the metric and its significance")

class ReportExplanationResponse(BaseModel):
    """
    Structured output schema for medical lab and diagnostic report interpretation.
    Separates factual measured findings from educational summaries and recommendations.
    Never silently invents missing metrics.
    """
    success: bool = Field(default=True, description="Status flag")
    summary: str = Field(description="High-level patient-friendly overview of the report findings")
    anomalies: List[str] = Field(default_factory=list, description="Out-of-range or abnormal markers requiring clinical attention")
    findings: List[LabFinding] = Field(default_factory=list, description="Detailed breakdown of analyzed laboratory panels and metrics")
    recommendations: List[str] = Field(default_factory=list, description="Actionable lifestyle and physician follow-up suggestions")
    limitations: List[str] = Field(
        default_factory=lambda: [
            "This summary is an educational translation and not a diagnostic confirmation.",
            "Reference intervals vary by testing laboratory instrumentation and patient demographics."
        ],
        description="Known limitations or uncertainties regarding the provided text"
    )
    requires_clinician_review: bool = Field(default=True, description="Flag indicating if a licensed clinician must review")
    disclaimer: str = Field(
        default="This automated report summary is for educational purposes only. Diagnostic decisions must be made by a qualified healthcare professional.",
        description="Mandatory clinical disclaimer"
    )

class PrescribedMedicine(BaseModel):
    """Structured details of an individual prescribed medication."""
    medicine_name: str = Field(description="Standardized name of the medication")
    dosage: str = Field(description="Extracted strength or dose, e.g., '500mg', '10mg'")
    frequency: str = Field(description="Usage frequency, e.g., 'Once daily', 'Every 8 hours'")
    duration: str = Field(description="Duration of the regimen, e.g., '7 days', '30 days'")
    instructions: Optional[str] = Field(default=None, description="Special administration instructions (e.g., 'Take with food')")
    confidence: float = Field(default=1.0, ge=0.0, le=1.0, description="Confidence score of OCR/NLP extraction")

class PrescriptionExtractionResponse(BaseModel):
    """
    Structured response for prescription OCR parsing and medication extraction.
    """
    patient_name: Optional[str] = Field(default=None, description="Patient name if visible on prescription")
    prescriber_name: Optional[str] = Field(default=None, description="Doctor or clinic name if visible")
    date: Optional[str] = Field(default=None, description="Prescription issue date if identified")
    medicines: List[PrescribedMedicine] = Field(default_factory=list, description="List of parsed medications")
    warnings: List[str] = Field(default_factory=list, description="Alerts regarding illegible handwriting, incomplete dosage, or ambiguity")
    requires_pharmacist_verification: bool = Field(default=True, description="Always true: human pharmacist verification required")

class ClinicalGeneralResponse(BaseModel):
    """
    Structured response for general healthcare consultations and triage queries.
    """
    success: bool = Field(default=True, description="Status flag")
    summary: str = Field(description="Direct, empathetic, and clear explanation answering the patient's query")
    findings: List[str] = Field(default_factory=list, description="Key factual health points relevant to the query")
    sources: List[str] = Field(default_factory=list, description="Reputable clinical references or guidelines cited")
    limitations: List[str] = Field(
        default_factory=lambda: ["Individual patient health factors may alter standard recommendations."],
        description="Limitations of the general health information"
    )
    urgency_level: Literal["Low", "Moderate", "High", "Emergency"] = Field(
        default="Low",
        description="Assessed clinical urgency level based on described symptoms"
    )
    requires_clinician_review: bool = Field(default=False, description="Whether in-person evaluation is recommended")
    disclaimer: str = Field(
        default="This information is educational and does not constitute formal medical advice. Seek prompt medical care for concerning symptoms.",
        description="Clinical disclaimer"
    )

class RetrievedEvidence(BaseModel):
    """Individual retrieved document chunk with source metadata."""
    document_id: str = Field(description="Identifier of the source document")
    title: str = Field(description="Document title or reference heading")
    excerpt: str = Field(description="Relevant text excerpt providing evidence")
    relevance_score: float = Field(ge=0.0, le=1.0, description="Vector similarity or retrieval score")

class KnowledgeRetrievalResponse(BaseModel):
    """
    Structured output for semantic retrieval and clinical reference search.
    """
    query: str = Field(description="Original search or clinical query")
    direct_answer: str = Field(description="Concise answer synthesized from retrieved references")
    retrieved_evidence: List[RetrievedEvidence] = Field(default_factory=list, description="Retrieved chunks supporting the answer")
    has_sufficient_context: bool = Field(description="False if available reference context was insufficient")
    limitations: List[str] = Field(default_factory=list, description="Context boundaries or unindexed areas")

class ToolExecutionResult(BaseModel):
    """
    Standardized result envelope for LLM tool calling execution.
    """
    tool_name: str = Field(description="Name of the executed backend tool")
    success: bool = Field(description="Whether tool execution succeeded")
    arguments: Dict[str, Any] = Field(default_factory=dict, description="Arguments passed to the tool")
    result_data: Any = Field(default=None, description="Structured output produced by the tool")
    error: Optional[str] = Field(default=None, description="Error message if execution failed")
    execution_time_ms: float = Field(default=0.0, description="Tool execution duration in milliseconds")
