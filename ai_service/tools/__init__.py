"""
Tools package for IntelliCare AI.
Provides controlled clinical tools, schema validation, authorization, and agent loop.
"""

from tools.schemas import (
    DrugInteractionInput,
    ExtractPrescriptionInput,
    InterpretReportInput,
    RetrieveMedicalReferenceInput,
    GetPatientReportInput,
    ToolExecutionRequest,
    ToolExecutionResponse,
    ToolChatRequest,
    ToolChatResponse
)
from tools.registry import ToolRegistry, get_tool_registry
from tools.agent import ToolAgent

__all__ = [
    "DrugInteractionInput",
    "ExtractPrescriptionInput",
    "InterpretReportInput",
    "RetrieveMedicalReferenceInput",
    "GetPatientReportInput",
    "ToolExecutionRequest",
    "ToolExecutionResponse",
    "ToolChatRequest",
    "ToolChatResponse",
    "ToolRegistry",
    "get_tool_registry",
    "ToolAgent"
]
