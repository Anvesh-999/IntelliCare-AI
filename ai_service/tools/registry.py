"""
Controlled Tool Execution Registry for IntelliCare AI.
Provides explicit schema validation, role-based authorization, execution timeouts,
bounded iteration safety, and sanitization of logs.
"""

import time
import asyncio
import logging
from typing import Dict, Any, List, Optional, Callable, Type
from pydantic import BaseModel, ValidationError

from core.config import sanitize_for_logs
from tools.schemas import (
    DrugInteractionInput,
    ExtractPrescriptionInput,
    InterpretReportInput,
    RetrieveMedicalReferenceInput,
    GetPatientReportInput,
    ToolExecutionResponse
)
from tools.definitions import (
    tool_lookup_drug_interaction,
    tool_extract_prescription,
    tool_interpret_report,
    tool_retrieve_medical_reference,
    tool_get_patient_report
)

logger = logging.getLogger("intellicare.tools.registry")


class RegisteredTool(BaseModel):
    name: str
    description: str
    input_schema: Type[BaseModel]
    handler: Callable
    allowed_roles: List[str] = ["patient", "doctor", "admin", "laboratory", "pharmacy"]
    timeout_seconds: float = 5.0

    model_config = {
        "arbitrary_types_allowed": True
    }


class ToolRegistry:
    """
    Central, secure registry for LLM tools.
    Strictly forbids execution of unapproved tools, arbitrary shell commands,
    or raw database queries.
    """

    def __init__(self):
        self._tools: Dict[str, RegisteredTool] = {}
        self._register_default_tools()

    def register(
        self,
        name: str,
        description: str,
        input_schema: Type[BaseModel],
        handler: Callable,
        allowed_roles: Optional[List[str]] = None,
        timeout_seconds: float = 5.0
    ):
        """Registers a verified tool with strict input schema and role bounds."""
        roles = allowed_roles or ["patient", "doctor", "admin", "laboratory", "pharmacy"]
        self._tools[name] = RegisteredTool(
            name=name,
            description=description,
            input_schema=input_schema,
            handler=handler,
            allowed_roles=roles,
            timeout_seconds=timeout_seconds
        )
        logger.info("Registered clinical tool: %s (allowed roles: %s)", name, roles)

    def _register_default_tools(self):
        """Registers the 5 core candidate tools."""
        self.register(
            name="lookup_drug_interaction",
            description="Checks for documented drug-drug interactions and severity risks across a list of medications.",
            input_schema=DrugInteractionInput,
            handler=tool_lookup_drug_interaction,
            allowed_roles=["patient", "doctor", "admin", "pharmacy"],
            timeout_seconds=5.0
        )
        self.register(
            name="extract_prescription",
            description="Extracts structured medicines, dosages, frequencies, and durations from prescription text.",
            input_schema=ExtractPrescriptionInput,
            handler=tool_extract_prescription,
            allowed_roles=["patient", "doctor", "admin", "pharmacy"],
            timeout_seconds=5.0
        )
        self.register(
            name="interpret_report",
            description="Analyzes medical laboratory report findings, compares values against reference ranges, and flags anomalies.",
            input_schema=InterpretReportInput,
            handler=tool_interpret_report,
            allowed_roles=["patient", "doctor", "admin", "laboratory"],
            timeout_seconds=8.0
        )
        self.register(
            name="retrieve_medical_reference",
            description="Searches vetted institutional medical guidelines for evidence-based clinical reference passages.",
            input_schema=RetrieveMedicalReferenceInput,
            handler=tool_retrieve_medical_reference,
            allowed_roles=["patient", "doctor", "admin", "laboratory", "pharmacy"],
            timeout_seconds=5.0
        )
        self.register(
            name="get_patient_report",
            description="Retrieves confidential patient clinical reports. Enforces cross-patient privacy and access controls.",
            input_schema=GetPatientReportInput,
            handler=tool_get_patient_report,
            allowed_roles=["patient", "doctor", "admin"],
            timeout_seconds=5.0
        )

    def get_tool(self, name: str) -> Optional[RegisteredTool]:
        return self._tools.get(name)

    def list_tools(self) -> List[Dict[str, Any]]:
        """Returns catalog of registered tools and their schemas."""
        catalog = []
        for name, tool in self._tools.items():
            catalog.append({
                "name": name,
                "description": tool.description,
                "parameters": tool.input_schema.model_json_schema(),
                "allowed_roles": tool.allowed_roles,
                "timeout_seconds": tool.timeout_seconds
            })
        return catalog

    def get_declarations(self) -> List[Dict[str, Any]]:
        """Returns tool declarations formatted for standard LLM function calling."""
        declarations = []
        for name, tool in self._tools.items():
            schema = tool.input_schema.model_json_schema()
            declarations.append({
                "name": name,
                "description": tool.description,
                "parameters": {
                    "type": "object",
                    "properties": schema.get("properties", {}),
                    "required": schema.get("required", [])
                }
            })
        return declarations

    async def execute_tool(
        self,
        name: str,
        arguments: Dict[str, Any],
        user_context: Optional[Dict[str, Any]] = None
    ) -> ToolExecutionResponse:
        """
        Executes a registered tool securely:
        1. Verifies tool exists (blocks unauthorized or arbitrary code/tools).
        2. Validates user authorization and role permissions.
        3. Validates arguments against Pydantic input schema.
        4. Executes within a strict timeout window.
        5. Logs sanitized diagnostic metrics.
        """
        start_time = time.perf_counter()
        user_context = user_context or {}
        caller_role = user_context.get("role", "patient")

        # 1. Existence Check
        tool = self._tools.get(name)
        if not tool:
            elapsed = (time.perf_counter() - start_time) * 1000
            err = f"Tool '{name}' is not registered or permitted for execution."
            logger.warning("Attempted execution of unregistered tool: %s", sanitize_for_logs(name))
            return ToolExecutionResponse(
                tool_name=name,
                success=False,
                error=err,
                execution_time_ms=round(elapsed, 2)
            )

        # 2. Authorization Check
        if caller_role not in tool.allowed_roles:
            elapsed = (time.perf_counter() - start_time) * 1000
            err = f"Unauthorized: Role '{caller_role}' is not allowed to execute tool '{name}'."
            logger.warning("Role '%s' denied execution of tool '%s'", caller_role, name)
            return ToolExecutionResponse(
                tool_name=name,
                success=False,
                error=err,
                execution_time_ms=round(elapsed, 2)
            )

        # 3. Argument Schema Validation
        try:
            validated_args = tool.input_schema.model_validate(arguments)
        except ValidationError as val_err:
            elapsed = (time.perf_counter() - start_time) * 1000
            err = f"Invalid arguments for tool '{name}': {str(val_err)}"
            logger.warning("Argument validation failed for '%s': %s", name, sanitize_for_logs(str(val_err)))
            return ToolExecutionResponse(
                tool_name=name,
                success=False,
                error=err,
                execution_time_ms=round(elapsed, 2)
            )

        # 4. Timeout-Enforced Execution
        try:
            args_dict = validated_args.model_dump()
            
            # Execute coroutine or function with timeout
            async def _run():
                if asyncio.iscoroutinefunction(tool.handler):
                    return await tool.handler(**args_dict, user_context=user_context)
                else:
                    return tool.handler(**args_dict, user_context=user_context)

            result = await asyncio.wait_for(_run(), timeout=tool.timeout_seconds)
            elapsed = (time.perf_counter() - start_time) * 1000

            logger.info("Tool '%s' executed successfully in %.2f ms", name, elapsed)
            return ToolExecutionResponse(
                tool_name=name,
                success=True,
                result=result,
                execution_time_ms=round(elapsed, 2),
                disclaimer=result.get("disclaimer") if isinstance(result, dict) else None
            )

        except asyncio.TimeoutError:
            elapsed = (time.perf_counter() - start_time) * 1000
            err = f"Tool '{name}' execution timed out after {tool.timeout_seconds} seconds."
            logger.error("Execution timeout for tool '%s'", name)
            return ToolExecutionResponse(
                tool_name=name,
                success=False,
                error=err,
                execution_time_ms=round(elapsed, 2)
            )

        except PermissionError as perm_err:
            elapsed = (time.perf_counter() - start_time) * 1000
            logger.warning("Permission error in tool '%s': %s", name, str(perm_err))
            return ToolExecutionResponse(
                tool_name=name,
                success=False,
                error=str(perm_err),
                execution_time_ms=round(elapsed, 2)
            )

        except Exception as exc:
            elapsed = (time.perf_counter() - start_time) * 1000
            err_msg = sanitize_for_logs(str(exc))
            logger.error("Unexpected failure executing tool '%s': %s", name, err_msg)
            return ToolExecutionResponse(
                tool_name=name,
                success=False,
                error=f"Internal error executing tool '{name}': {err_msg}",
                execution_time_ms=round(elapsed, 2)
            )


# Singleton Registry
_registry_instance: Optional[ToolRegistry] = None

def get_tool_registry() -> ToolRegistry:
    global _registry_instance
    if _registry_instance is None:
        _registry_instance = ToolRegistry()
    return _registry_instance
