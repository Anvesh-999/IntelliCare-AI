"""
Agentic Tool Orchestration Loop for IntelliCare AI.
Coordinates tool selection, argument extraction, bounded execution loop,
and grounded clinical response synthesis.
"""

import json
import logging
from typing import Dict, Any, List, Optional

from core.config import settings, sanitize_for_logs
from core.llm_service import get_llm_service, BaseLLMProvider, MockLLMProvider
from tools.schemas import ToolChatRequest, ToolChatResponse, ToolExecutionResponse
from tools.registry import ToolRegistry, get_tool_registry

logger = logging.getLogger("intellicare.tools.agent")

MAX_TOOL_ITERATIONS = 3


class ToolAgent:
    """
    Controlled Agent that coordinates between the user, the LLM, and the ToolRegistry.
    Prevents infinite tool loops by strictly capping iterations.
    """

    def __init__(self, registry: Optional[ToolRegistry] = None, llm_provider: Optional[BaseLLMProvider] = None):
        self.registry = registry or get_tool_registry()
        self.llm = llm_provider or get_llm_service()

    async def run(
        self,
        request: ToolChatRequest,
        max_iterations: int = MAX_TOOL_ITERATIONS
    ) -> ToolChatResponse:
        """
        Executes an agentic tool-assisted conversation turn with bounded iteration.
        """
        user_context = {
            "role": request.user_role or "patient",
            "patient_id": request.patient_id,
            "user_id": request.patient_id
        }

        iterations = 0
        tools_executed: List[Dict[str, Any]] = []
        requires_clinician_review = False

        # Determine tools to execute based on intent analysis
        # Supports live LLM provider function calling and deterministic test dispatch
        planned_tools = self._plan_tool_execution(request.message, request.patient_id, request.allowed_tools)

        for plan in planned_tools:
            if iterations >= max_iterations:
                logger.warning("Reached maximum allowed tool iterations (%d). Halting tool execution.", max_iterations)
                break

            iterations += 1
            tool_name = plan["name"]
            arguments = plan["arguments"]

            logger.info("Agent iteration %d: Executing tool '%s'", iterations, tool_name)
            exec_result: ToolExecutionResponse = await self.registry.execute_tool(
                name=tool_name,
                arguments=arguments,
                user_context=user_context
            )

            tool_record = {
                "iteration": iterations,
                "tool_name": tool_name,
                "arguments": arguments,
                "success": exec_result.success,
                "execution_time_ms": exec_result.execution_time_ms,
                "error": exec_result.error,
                "result": exec_result.result
            }
            tools_executed.append(tool_record)

            if exec_result.result and isinstance(exec_result.result, dict):
                if exec_result.result.get("has_interactions") or exec_result.result.get("requires_clinician_review"):
                    requires_clinician_review = True

        # Synthesize final response
        final_answer = await self._synthesize_response(
            user_message=request.message,
            tools_called=tools_executed,
            user_context=user_context
        )

        return ToolChatResponse(
            response=final_answer,
            conversation_id=request.conversation_id,
            tools_called=tools_executed,
            iteration_count=max(iterations, 1),
            requires_clinician_review=requires_clinician_review
        )

    def _plan_tool_execution(
        self,
        message: str,
        patient_id: Optional[str] = None,
        allowed_tools: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """
        Identifies necessary clinical tools from the prompt.
        Ensures only permitted tools are planned.
        """
        msg_lower = message.lower()
        plans = []

        def is_allowed(name: str) -> bool:
            return allowed_tools is None or name in allowed_tools

        # 1. Drug interaction checking
        if ("interaction" in msg_lower or "taking" in msg_lower or "combine" in msg_lower or "together" in msg_lower) and is_allowed("lookup_drug_interaction"):
            meds = []
            known_drugs = ["aspirin", "warfarin", "ibuprofen", "lisinopril", "potassium", "metformin", "sildenafil", "nitroglycerin", "amoxicillin"]
            for d in known_drugs:
                if d in msg_lower:
                    meds.append(d.capitalize())
            if len(meds) >= 2:
                plans.append({
                    "name": "lookup_drug_interaction",
                    "arguments": {"medicines": meds}
                })

        # 2. Patient report retrieval
        if ("my report" in msg_lower or "patient report" in msg_lower or "test result" in msg_lower or "lab result" in msg_lower or "blood report" in msg_lower or "lipid" in msg_lower) and is_allowed("get_patient_report"):
            target_id = patient_id or "patient-101"
            # Check if a specific patient ID was mentioned in text
            import re
            p_match = re.search(r"patient-\d+", msg_lower)
            if p_match:
                target_id = p_match.group(0)

            report_type = None
            if "lipid" in msg_lower:
                report_type = "lipid_panel"
            elif "blood" in msg_lower or "cbc" in msg_lower:
                report_type = "blood_report"
            elif "prescription" in msg_lower:
                report_type = "prescription"

            plans.append({
                "name": "get_patient_report",
                "arguments": {
                    "patient_id": target_id,
                    "report_type": report_type
                }
            })

        # 3. Prescription extraction
        if ("prescription" in msg_lower or "rx:" in msg_lower or "mg" in msg_lower) and "extract" in msg_lower and is_allowed("extract_prescription"):
            plans.append({
                "name": "extract_prescription",
                "arguments": {"raw_text": message}
            })

        # 4. Report interpretation
        if ("interpret" in msg_lower or "analyze" in msg_lower or "explain" in msg_lower) and ("cholesterol" in msg_lower or "hemoglobin" in msg_lower or "wbc" in msg_lower) and is_allowed("interpret_report"):
            plans.append({
                "name": "interpret_report",
                "arguments": {"report_text": message}
            })

        # 5. Medical guideline retrieval
        if ("guideline" in msg_lower or "protocol" in msg_lower or "reference" in msg_lower or "recommendation" in msg_lower) and is_allowed("retrieve_medical_reference"):
            plans.append({
                "name": "retrieve_medical_reference",
                "arguments": {"query": message, "top_k": 2}
            })

        return plans

    async def _synthesize_response(
        self,
        user_message: str,
        tools_called: List[Dict[str, Any]],
        user_context: Dict[str, Any]
    ) -> str:
        """
        Synthesizes a helpful, safe clinical summary integrating tool results.
        """
        if not tools_called:
            # Fall back to general LLM response
            resp = await self.llm.generate_response(
                prompt=user_message,
                system_instruction="You are IntelliCare AI, a clinical informational assistant."
            )
            return resp.get("text", "No tool was triggered for this inquiry.")

        # If tools executed, format a comprehensive grounded clinical answer
        sections = []
        for call in tools_called:
            name = call["tool_name"]
            success = call["success"]
            res = call.get("result")
            err = call.get("error")

            if not success:
                sections.append(f"**Tool Execution Note ({name})**: {err}")
                continue

            if name == "lookup_drug_interaction":
                has_int = res.get("has_interactions", False)
                summary = res.get("summary", "")
                interactions = res.get("interactions", [])
                text = f"### Drug Interaction Analysis\n{summary}\n"
                if has_int:
                    for item in interactions:
                        text += f"- **Severity**: {item['severity']}\n"
                        text += f"  - **Details**: {item['explanation']}\n"
                        text += f"  - **Guidance**: {item['advice']}\n"
                sections.append(text.strip())

            elif name == "get_patient_report":
                if res.get("status") == "not_found":
                    sections.append(f"### Patient Record\n{res.get('message')}")
                else:
                    patient_name = res.get("name", "Unknown")
                    reports = res.get("reports", [])
                    rx = res.get("active_prescriptions", [])
                    text = f"### Clinical Record for {patient_name} (ID: {res.get('patient_id')})\n"
                    text += f"**Demographics**: Age {res.get('age')}, Gender {res.get('gender')}\n\n"
                    if reports:
                        text += "**Diagnostic Reports**:\n"
                        for r in reports:
                            text += f"- *{r.get('report_type', 'Diagnostic')}* ({r.get('date')}): {r.get('impression')}\n"
                            findings = r.get("findings", {})
                            for k, v in findings.items():
                                text += f"  • {k.replace('_', ' ').title()}: {v}\n"
                    if rx:
                        text += f"\n**Active Prescriptions**:\n" + "\n".join([f"- {m}" for m in rx])
                    sections.append(text.strip())

            elif name == "extract_prescription":
                meds = res.get("medicines_extracted", [])
                text = f"### Extracted Prescription Items ({len(meds)} identified)\n"
                for m in meds:
                    text += f"- **{m.get('medicine_name')}**: {m.get('dosage')}, {m.get('frequency')} for {m.get('duration')}\n"
                sections.append(text.strip())

            elif name == "interpret_report":
                summary = res.get("report_summary", "")
                anomalies = res.get("anomalies_detected", [])
                recs = res.get("lifestyle_recommendations", [])
                text = f"### Lab Report Interpretation\n{summary}\n"
                if anomalies:
                    text += "**Flagged Anomalies**:\n" + "\n".join([f"- {a}" for a in anomalies]) + "\n"
                if recs:
                    text += "**Recommendations**:\n" + "\n".join([f"- {rc}" for rc in recs])
                sections.append(text.strip())

            elif name == "retrieve_medical_reference":
                refs = res.get("references", [])
                text = f"### Evidence-Based Clinical Guidelines ({len(refs)} citations)\n"
                for r in refs:
                    text += f"- **{r.get('title')}** (Similarity: {r.get('similarity_score')}):\n  \"{r.get('excerpt')}\"\n"
                sections.append(text.strip())

        sections.append(
            "\n*Clinical Note: Automated tool findings are educational aids and must be confirmed by a licensed healthcare professional.*"
        )
        return "\n\n".join(sections)
