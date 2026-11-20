import logging
from typing import List, Optional, Literal
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Import core modules
from core.config import settings, sanitize_for_logs
from core.schemas import ChatRequest, ChatResponse
from core.structured_schemas import (
    ClinicalGeneralResponse,
    ReportExplanationResponse,
    PrescriptionExtractionResponse,
    KnowledgeRetrievalResponse,
    ToolExecutionResult,
    LabFinding,
    RetrievedEvidence
)
from core.prompt_service import format_user_prompt, build_system_instruction, trim_conversation_history
from core.safety import evaluate_clinical_safety, validate_measurement, validate_ocr_reliability
from core.llm_service import (
    get_llm_service,
    LLMAuthenticationError,
    LLMTimeoutError,
    LLMRateLimitError,
    LLMSchemaValidationError,
    LLMProviderError
)

# Import legacy/existing services
from services.ocr_engine import process_prescription_image
from services.summarizer import summarize_medical_report
from services.timeline import generate_medical_timeline
from services.symptoms import analyze_symptoms
from services.interactions import check_drug_interactions
from services.coaches import generate_lifestyle_advice, generate_meal_plan

logger = logging.getLogger("intellicare.api")

app = FastAPI(
    title="IntelliCare AI - AI Engine",
    version="2.0",
    description="IntelliCare AI Clinical Assistant & Hospital Management Machine Learning Microservice"
)

# Enable CORS for communication with backend and frontend
origins = [o.strip() for o in settings.ALLOWED_ORIGINS.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models for legacy/rule-based request validation
class StructuredChatRequest(BaseModel):
    message: str
    response_type: Literal["general", "report", "prescription"] = "general"
    conversation_id: Optional[str] = None
    health_profile: Optional[dict] = None
    model: Optional[str] = None
    temperature: Optional[float] = None

class SearchRequest(BaseModel):
    query: str
    top_k: int = 4
    category: Optional[str] = None
    min_relevance: float = 0.40

class SearchResponse(BaseModel):
    success: bool = True
    query: str
    results: List[RetrievedEvidence]
    total_results: int
    has_sufficient_context: bool
    execution_time_ms: float

class ReportSummaryRequest(BaseModel):
    report_text: str

class TimelineRequest(BaseModel):
    events: List[dict]

class SymptomRequest(BaseModel):
    symptoms: str

class InteractionRequest(BaseModel):
    medicines: List[str]

class LifestyleRequest(BaseModel):
    bmi: float
    blood_pressure_systolic: int
    blood_pressure_diastolic: int
    blood_sugar: float
    activity_level: str

class NutritionRequest(BaseModel):
    diet_preference: str
    conditions: List[str]

@app.get("/")
def read_root():
    return {
        "status": "IntelliCare AI Service is running successfully",
        "version": "2.0",
        "provider": settings.LLM_PROVIDER,
        "model": settings.GEMINI_MODEL
    }

@app.get("/health")
def health_check():
    from rag.retriever import get_retriever
    from tools.registry import get_tool_registry
    
    indexed_count = 0
    tools_count = 0
    try:
        retriever = get_retriever()
        indexed_count = retriever.vector_store.count()
    except Exception:
        pass

    try:
        registry = get_tool_registry()
        tools_count = len(registry.list_tools())
    except Exception:
        pass

    return {
        "status": "healthy",
        "service": "intellicare-ai-engine",
        "version": "2.0.0",
        "llm_provider": settings.LLM_PROVIDER,
        "active_model": settings.GEMINI_MODEL,
        "has_gemini_key": bool(settings.effective_gemini_key),
        "vector_store": {
            "indexed_chunks": indexed_count
        },
        "tool_registry": {
            "registered_tools_count": tools_count
        }
    }

@app.post("/ai/ocr")
async def perform_ocr(file: UploadFile = File(...)):
    """
    OCR endpoint that processes uploaded prescription images and extracts medicine instructions.
    """
    try:
        contents = await file.read()
        extracted_data = process_prescription_image(image_path=file.filename, raw_bytes=contents)
        return {"success": True, "medicines": extracted_data}
    except Exception as e:
        logger.error("OCR error: %s", sanitize_for_logs(str(e)))
        raise HTTPException(status_code=500, detail=f"OCR Processing failed: {str(e)}")

@app.post("/ai/summarize", response_model=ReportExplanationResponse)
async def summarize_report(req: ReportSummaryRequest):
    """
    Translates complex lab terms in blood/scan reports into structured, plain language summaries.
    Uses LLM structured generation when available, falling back to verified clinical rule engine.
    Never silently invents missing medical measurements.
    """
    if not req.report_text or not req.report_text.strip():
        raise HTTPException(status_code=422, detail="Report text cannot be empty.")
    
    llm = get_llm_service()
    if settings.effective_gemini_key or settings.LLM_PROVIDER == "mock":
        try:
            prompt = (
                f"Analyze the following patient laboratory or diagnostic report:\n\n{req.report_text}\n\n"
                f"Extract all panels, metrics, measured values with units, reference ranges, and clinical status. "
                f"Delineate facts from general explanations. Do NOT invent missing values."
            )
            return await llm.generate_structured_response(
                prompt=prompt,
                schema_class=ReportExplanationResponse
            )
        except Exception as e:
            logger.warning("LLM structured summarization failed (%s), using rule-based parser fallback.", sanitize_for_logs(str(e)))
    
    # Verified rule-based engine fallback formatted into strict Pydantic model
    summary_data = summarize_medical_report(req.report_text)
    findings = [
        LabFinding(
            panel=f.get("panel", "General Health"),
            metric=f.get("metric", f.get("panel", "General Marker")),
            value=f.get("value"),
            reference_range=f.get("reference_range"),
            status="High" if f.get("status") == "High" else "Low" if f.get("status") == "Low" else "Needs Attention" if "Attention" in f.get("status", "") else "Normal",
            explanation=f.get("explanation", "")
        )
        for f in summary_data.get("findings", [])
    ]
    return ReportExplanationResponse(
        summary=summary_data.get("summary", ""),
        anomalies=summary_data.get("anomalies", []),
        findings=findings,
        recommendations=summary_data.get("recommendations", []),
        disclaimer=summary_data.get("disclaimer", "")
    )

@app.post("/ai/timeline")
def build_timeline(req: TimelineRequest):
    """
    Orders medical events (diagnoses, appointments, prescriptions) chronologically.
    """
    try:
        timeline_data = generate_medical_timeline(req.events)
        return {"success": True, "timeline": timeline_data}
    except Exception as e:
        logger.error("Timeline error: %s", sanitize_for_logs(str(e)))
        raise HTTPException(status_code=500, detail=f"Timeline generation failed: {str(e)}")

@app.post("/ai/symptoms")
def check_symptoms(req: SymptomRequest):
    """
    Checks symptoms and provides self-care guidance and triage advice.
    """
    try:
        symptom_data = analyze_symptoms(req.symptoms)
        return {"success": True, **symptom_data}
    except Exception as e:
        logger.error("Symptoms error: %s", sanitize_for_logs(str(e)))
        raise HTTPException(status_code=500, detail=f"Symptom checker failed: {str(e)}")

@app.post("/ai/interactions")
def check_interactions(req: InteractionRequest):
    """
    Checks list of active medications for potential drug interactions.
    """
    try:
        interaction_data = check_drug_interactions(req.medicines)
        return {"success": True, **interaction_data}
    except Exception as e:
        logger.error("Interactions error: %s", sanitize_for_logs(str(e)))
        raise HTTPException(status_code=500, detail=f"Interaction checker failed: {str(e)}")

@app.post("/ai/lifestyle")
def lifestyle_coach(req: LifestyleRequest):
    """
    Provides wellness suggestions based on physical metrics (BMI, BP, sugar).
    """
    try:
        metrics = {
            "bmi": req.bmi,
            "blood_pressure_systolic": req.blood_pressure_systolic,
            "blood_pressure_diastolic": req.blood_pressure_diastolic,
            "blood_sugar": req.blood_sugar,
            "activity_level": req.activity_level
        }
        coach_data = generate_lifestyle_advice(metrics)
        return {"success": True, **coach_data}
    except Exception as e:
        logger.error("Lifestyle error: %s", sanitize_for_logs(str(e)))
        raise HTTPException(status_code=500, detail=f"Lifestyle advice failed: {str(e)}")

@app.post("/ai/nutrition")
def nutrition_assistant(req: NutritionRequest):
    """
    Suggests diet plans based on user preferences and physical concerns.
    """
    try:
        preferences = {"diet_preference": req.diet_preference}
        health_info = {"conditions": req.conditions}
        meal_data = generate_meal_plan(preferences, health_info)
        return {"success": True, **meal_data}
    except Exception as e:
        logger.error("Nutrition error: %s", sanitize_for_logs(str(e)))
        raise HTTPException(status_code=500, detail=f"Nutrition assistance failed: {str(e)}")

@app.post("/ai/chat", response_model=ChatResponse)
async def ai_assistant(req: ChatRequest):
    """
    Production LLM Chat Assistant endpoint.
    Processes user query and authorized medical profile through real LLM provider (Google Gemini)
    with prompt injection defenses, input sanitization, and structured validation.
    """
    user_query = req.message or req.query
    if not user_query or not user_query.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Chat message content cannot be empty."
        )

    try:
        # 1. Clinical Safety Evaluation Check (Emergency triage & Dosage refusal interception)
        safety_eval = evaluate_clinical_safety(user_query, req.health_profile)
        if not safety_eval.is_safe and safety_eval.intercept_response:
            return ChatResponse(
                success=True,
                response=safety_eval.intercept_response,
                message=safety_eval.intercept_response,
                conversation_id=req.conversation_id,
                provider="safety_guardrail",
                model="clinical_safety_interceptor",
                disclaimer=safety_eval.disclaimer,
                metadata={
                    "safety_action": safety_eval.action,
                    "urgency_level": safety_eval.urgency_level,
                    "requires_clinician_review": safety_eval.requires_clinician_review,
                    "pii_detected": safety_eval.pii_detected
                }
            )

        # 2. Trim history with context window management (sliding window)
        trimmed_history = trim_conversation_history(req.history)

        # 3. Format hardened prompt incorporating patient context if consent granted
        formatted_prompt = format_user_prompt(
            message=safety_eval.sanitized_input,
            health_profile=req.health_profile,
            consent_given=req.consent_given
        )

        # 4. Get LLM provider
        llm = get_llm_service()

        # 5. Call LLM with bounded retries and timeouts
        result = await llm.generate_response(
            prompt=formatted_prompt,
            system_instruction=build_system_instruction(),
            history=trimmed_history,
            model=req.model,
            temperature=req.temperature
        )

        return ChatResponse(
            success=True,
            response=result["text"],
            message=result["text"],
            conversation_id=req.conversation_id,
            provider=result.get("provider", settings.LLM_PROVIDER),
            model=result.get("model", settings.GEMINI_MODEL),
            metadata={"attempts": result.get("attempts", 1)}
        )

    except LLMAuthenticationError as auth_err:
        logger.error("Authentication error in /ai/chat: %s", sanitize_for_logs(str(auth_err)))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"LLM Authentication Failed: {str(auth_err)}"
        )
    except LLMTimeoutError as time_err:
        logger.error("Timeout in /ai/chat: %s", sanitize_for_logs(str(time_err)))
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail=f"LLM Provider Timeout: {str(time_err)}"
        )
    except LLMRateLimitError as rate_err:
        logger.error("Rate limit in /ai/chat: %s", sanitize_for_logs(str(rate_err)))
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"LLM Rate Limit Exceeded: {str(rate_err)}"
        )
    except Exception as e:
        err_msg = sanitize_for_logs(str(e))
        logger.error("Unhandled error in /ai/chat: %s", err_msg)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI Chat Service Error: {err_msg}"
        )

@app.post("/ai/chat/structured")
async def ai_assistant_structured(req: StructuredChatRequest):
    """
    Structured LLM Chat Assistant endpoint returning validated Pydantic JSON.
    Guarantees strict separation of factual findings from explanations and prevents
    hallucination of missing clinical values.
    """
    if not req.message or not req.message.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Chat message content cannot be empty."
        )

    # Resolve schema based on response_type
    schema_map = {
        "general": ClinicalGeneralResponse,
        "report": ReportExplanationResponse,
        "prescription": PrescriptionExtractionResponse
    }
    schema_class = schema_map.get(req.response_type.lower(), ClinicalGeneralResponse)

    try:
        formatted_prompt = format_user_prompt(
            message=req.message,
            health_profile=req.health_profile
        )
        llm = get_llm_service()
        structured_result = await llm.generate_structured_response(
            prompt=formatted_prompt,
            schema_class=schema_class,
            system_instruction=build_system_instruction(),
            model=req.model,
            temperature=req.temperature
        )
        return structured_result

    except LLMAuthenticationError as auth_err:
        logger.error("Auth error in /ai/chat/structured: %s", sanitize_for_logs(str(auth_err)))
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(auth_err))
    except LLMSchemaValidationError as val_err:
        logger.error("Schema validation error in /ai/chat/structured: %s", sanitize_for_logs(str(val_err)))
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"LLM Structured Validation Error: {str(val_err)}")
    except LLMTimeoutError as time_err:
        raise HTTPException(status_code=status.HTTP_504_GATEWAY_TIMEOUT, detail=str(time_err))
    except LLMRateLimitError as rate_err:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=str(rate_err))
    except Exception as e:
        err_msg = sanitize_for_logs(str(e))
        logger.error("Unhandled error in /ai/chat/structured: %s", err_msg)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Structured AI Error: {err_msg}")

@app.post("/ai/search", response_model=SearchResponse)
async def semantic_search(req: SearchRequest):
    """
    Semantic vector retrieval endpoint.
    Retrieves peer-reviewed clinical reference chunks based on cosine similarity embeddings.
    Preserves document identifiers and source provenance.
    """
    if not req.query or not req.query.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Search query cannot be empty."
        )

    import time
    from rag.retriever import get_retriever

    start_time = time.time()
    try:
        retriever = get_retriever()
        results = await retriever.search(
            query=req.query,
            top_k=req.top_k,
            category_filter=req.category,
            min_relevance=req.min_relevance
        )
        duration_ms = round((time.time() - start_time) * 1000, 2)

        return SearchResponse(
            success=True,
            query=req.query,
            results=results,
            total_results=len(results),
            has_sufficient_context=len(results) > 0,
            execution_time_ms=duration_ms
        )
    except Exception as e:
        err_msg = sanitize_for_logs(str(e))
        logger.error("Search error in /ai/search: %s", err_msg)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Semantic Search Error: {err_msg}"
        )

@app.post("/ai/rag/chat")
async def ai_rag_chat(req_data: dict):
    """
    Retrieval-Augmented Generation (RAG) Chat Endpoint.
    Retrieves approved clinical guidelines, grounds LLM responses, and returns verifiable source citations.
    """
    from rag.rag_service import get_rag_service, RAGChatRequest
    try:
        req = RAGChatRequest(**req_data)

        # Safety Evaluation Check
        safety_eval = evaluate_clinical_safety(req.message)
        if not safety_eval.is_safe and safety_eval.intercept_response:
            return {
                "success": True,
                "response": safety_eval.intercept_response,
                "message": safety_eval.intercept_response,
                "conversation_id": req.conversation_id,
                "citations": [],
                "has_sufficient_context": False,
                "urgency_level": safety_eval.urgency_level,
                "requires_clinician_review": safety_eval.requires_clinician_review,
                "disclaimer": safety_eval.disclaimer
            }

        rag_service = get_rag_service()
        result = await rag_service.answer_query(req)
        return result.model_dump()
    except ValueError as val_err:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(val_err))
    except LLMAuthenticationError as auth_err:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(auth_err))
    except LLMTimeoutError as time_err:
        raise HTTPException(status_code=status.HTTP_504_GATEWAY_TIMEOUT, detail=str(time_err))
    except LLMRateLimitError as rate_err:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=str(rate_err))
    except Exception as e:
        err_msg = sanitize_for_logs(str(e))
        logger.error("RAG chat error in /ai/rag/chat: %s", err_msg)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"RAG Service Error: {err_msg}"
        )

# ---------------------------------------------------------------------------
# Tool Calling Endpoints (Phase 5)
# ---------------------------------------------------------------------------

@app.get("/ai/tools")
async def list_available_tools():
    """
    List all registered clinical tools, parameter schemas, allowed roles, and timeouts.
    """
    from tools.registry import get_tool_registry
    registry = get_tool_registry()
    return {
        "success": True,
        "tools": registry.list_tools()
    }

@app.post("/ai/tools/execute")
async def execute_tool_endpoint(req_data: dict):
    """
    Securely executes a registered tool with argument validation and authorization bounds.
    """
    from tools.registry import get_tool_registry
    from tools.schemas import ToolExecutionRequest
    try:
        request_obj = ToolExecutionRequest(**req_data)
        registry = get_tool_registry()
        result = await registry.execute_tool(
            name=request_obj.tool_name,
            arguments=request_obj.arguments,
            user_context=request_obj.user_context
        )
        return result.model_dump()
    except ValueError as val_err:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(val_err))
    except Exception as e:
        err_msg = sanitize_for_logs(str(e))
        logger.error("Error executing tool in /ai/tools/execute: %s", err_msg)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Tool Execution Error: {err_msg}"
        )

@app.post("/ai/tools/chat")
async def ai_tools_chat(req_data: dict):
    """
    Agentic Tool Calling Chatbot Endpoint.
    Analyzes intent, executes verified tools within bounded iteration loop,
    and returns a synthesized, grounded clinical response.
    """
    from tools.schemas import ToolChatRequest
    from tools.agent import ToolAgent
    try:
        chat_req = ToolChatRequest(**req_data)

        # Safety Check: Intercept acute emergencies before running tool loop
        safety_eval = evaluate_clinical_safety(chat_req.message)
        if not safety_eval.is_safe and safety_eval.action == "intercept_emergency":
            return {
                "response": safety_eval.intercept_response,
                "conversation_id": chat_req.conversation_id,
                "tools_called": [],
                "iteration_count": 1,
                "requires_clinician_review": True,
                "disclaimer": safety_eval.disclaimer
            }

        agent = ToolAgent()
        result = await agent.run(chat_req)
        return result.model_dump()
    except ValueError as val_err:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(val_err))
    except LLMAuthenticationError as auth_err:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(auth_err))
    except LLMTimeoutError as time_err:
        raise HTTPException(status_code=status.HTTP_504_GATEWAY_TIMEOUT, detail=str(time_err))
    except LLMRateLimitError as rate_err:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=str(rate_err))
    except Exception as e:
        err_msg = sanitize_for_logs(str(e))
        logger.error("Error in /ai/tools/chat: %s", err_msg)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Tool Agent Error: {err_msg}"
        )

@app.on_event("startup")
async def startup_event():
    """Pre-index clinical guidelines at service startup."""
    try:
        from pathlib import Path
        from rag.retriever import get_retriever
        docs_dir = Path(__file__).parent / "data" / "reference_docs"
        if docs_dir.exists():
            retriever = get_retriever()
            indexed = await retriever.ingest_directory(str(docs_dir))
            logger.info("Pre-indexed %d clinical reference chunks on startup.", indexed)
    except Exception as e:
        logger.warning("RAG startup pre-indexing warning: %s", sanitize_for_logs(str(e)))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=settings.HOST, port=settings.PORT, reload=True)
