from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_summarize_report_endpoint():
    payload = {"report_text": "Lipid Panel: Cholesterol 240 mg/dL, HDL 35 mg/dL, LDL 155 mg/dL"}
    res = client.post("/ai/summarize", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert "summary" in data
    assert "findings" in data

def test_symptoms_endpoint():
    payload = {"symptoms": "chest pain and shortness of breath"}
    res = client.post("/ai/symptoms", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert "Emergency" in data["urgency"] or "High" in data["urgency"]

def test_interactions_endpoint():
    payload = {"medicines": ["aspirin", "warfarin"]}
    res = client.post("/ai/interactions", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["has_interactions"] is True

def test_timeline_endpoint():
    payload = {
        "events": [
            {"type": "prescription", "date": "2026-05-10", "title": "Lisinopril", "description": "10mg once daily"},
            {"type": "report", "date": "2026-06-10", "title": "Blood Test", "description": "Normal"}
        ]
    }
    res = client.post("/ai/timeline", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert len(data["timeline"]) == 2
    # Verify chronological ordering (newest first)
    assert data["timeline"][0]["title"] == "Blood Test"

def test_lifestyle_endpoint():
    payload = {
        "bmi": 24.0,
        "blood_pressure_systolic": 118,
        "blood_pressure_diastolic": 76,
        "blood_sugar": 90.0,
        "activity_level": "moderate"
    }
    res = client.post("/ai/lifestyle", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["status"]["Blood Pressure"] == "Normal"

def test_nutrition_endpoint():
    payload = {
        "diet_preference": "vegetarian",
        "conditions": ["diabetes"]
    }
    res = client.post("/ai/nutrition", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["preferences"]["low_sugar_required"] is True
