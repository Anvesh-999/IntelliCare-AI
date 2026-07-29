from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional

# Import services
from services.ocr_engine import process_prescription_image
from services.summarizer import summarize_medical_report
from services.timeline import generate_medical_timeline
from services.symptoms import analyze_symptoms
from services.interactions import check_drug_interactions
from services.coaches import generate_lifestyle_advice, generate_meal_plan
from services.assistant import generate_assistant_response

app = FastAPI(title="IntelliCare AI - AI Engine", version="1.0")

# Enable CORS for communication with backend and frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models for request validation
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

class ChatRequest(BaseModel):
    query: str
    health_profile: Optional[dict] = None

@app.get("/")
def read_root():
    return {"status": "IntelliCare AI Service is running successfully"}

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
        raise HTTPException(status_code=500, detail=f"OCR Processing failed: {str(e)}")

@app.post("/ai/summarize")
def summarize_report(req: ReportSummaryRequest):
    """
    Translates complex lab terms in blood/scan reports into plain language summaries for patients.
    """
    try:
        summary_data = summarize_medical_report(req.report_text)
        return {"success": True, **summary_data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Summarization failed: {str(e)}")

@app.post("/ai/timeline")
def build_timeline(req: TimelineRequest):
    """
    Orders medical events (diagnoses, appointments, prescriptions) chronologically.
    """
    try:
        timeline_data = generate_medical_timeline(req.events)
        return {"success": True, "timeline": timeline_data}
    except Exception as e:
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
        raise HTTPException(status_code=500, detail=f"Nutrition assistance failed: {str(e)}")

@app.post("/ai/chat")
def ai_assistant(req: ChatRequest):
    """
    AI Chat Assistant returning contextual answers using medical knowledge and user records.
    """
    try:
        chat_data = generate_assistant_response(req.query, req.health_profile)
        return {"success": True, **chat_data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Assistant failed: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
