SYMPTOM_GUIDE_DB = {
    "chest pain": {
        "urgency": "High (Emergency)",
        "explanation": "Chest pain can be an indicator of serious cardiac events (like a heart attack), pulmonary issues, or severe acid reflux.",
        "warnings": [
            "Pain radiating to the left arm, jaw, neck, or back",
            "Shortness of breath, dizziness, cold sweats, or nausea",
            "Sensation of heavy pressure or squeezing in the chest"
        ],
        "home_care": "Do not attempt home care. Keep calm, sit down, and avoid physical exertion.",
        "recommendation": "Call emergency services (e.g. 911 / emergency number) or proceed to the nearest Emergency Department immediately."
    },
    "shortness of breath": {
        "urgency": "High (Urgent Care)",
        "explanation": "Difficulty breathing or feeling like you cannot take a full breath can stem from asthma, allergies, pneumonia, or cardiac conditions.",
        "warnings": [
            "Inability to speak in full sentences",
            "Bluish lips or fingertips (cyanosis)",
            "Audible wheezing or whistling sounds when breathing"
        ],
        "home_care": "Sit upright. Loosen tight clothing. If you have a prescribed rescue inhaler, use it as directed.",
        "recommendation": "Seek immediate emergency attention if severe. For moderate symptoms, schedule an urgent appointment with a doctor."
    },
    "fever": {
        "urgency": "Low to Moderate",
        "explanation": "A fever is a natural immune response to infections from viruses or bacteria. It helps the body fight off invaders.",
        "warnings": [
            "Fever above 103°F (39.4°C) that does not respond to medication",
            "Stiff neck, severe headache, confusion, or sensitivity to light",
            "Fever lasting more than 3 consecutive days"
        ],
        "home_care": "Stay well hydrated. Rest. Take over-the-counter fever reducers like acetaminophen or ibuprofen as directed. Keep the room temperature comfortable.",
        "recommendation": "Consult a primary care doctor if the fever persists beyond 3 days or is accompanied by any warning signs."
    },
    "headache": {
        "urgency": "Low to Moderate",
        "explanation": "Headaches are common and are usually tension-type, migraines, or due to dehydration, stress, or eye strain.",
        "warnings": [
            "Sudden, extremely severe 'thunderclap' headache (worst headache of your life)",
            "Headache accompanied by numbness, weakness, speech difficulty, or vision changes",
            "Headache following a recent head injury"
        ],
        "home_care": "Rest in a quiet, dark room. Apply a cool compress to your forehead. Drink plenty of water.",
        "recommendation": "Seek emergency care for sudden/severe headaches or signs of stroke. Consult a physician for chronic or recurring headaches."
    },
    "cough": {
        "urgency": "Low",
        "explanation": "A cough is a reflex to clear the airways. It is commonly caused by common cold, flu, allergies, or mild bronchitis.",
        "warnings": [
            "Coughing up blood or thick rusty-colored mucus",
            "Cough accompanied by high fever or chest pain",
            "Persistent cough lasting longer than 3 weeks"
        ],
        "home_care": "Use a humidifier or inhale steam. Drink warm tea with honey. Stay hydrated. Rest.",
        "recommendation": "See a primary care doctor if the cough is persistent, severe, or is accompanied by blood or breathing difficulties."
    },
    "abdominal pain": {
        "urgency": "Moderate",
        "explanation": "Abdominal pain can arise from gas, indigestion, food poisoning, or more serious conditions like appendicitis or gallstones.",
        "warnings": [
            "Sudden, severe pain localized in the lower right abdomen",
            "Pain accompanied by high fever, persistent vomiting, or inability to keep fluids down",
            "Abdomen is rigid or tender to the touch"
        ],
        "home_care": "Sip water or clear broths. Avoid solid foods for a few hours. Rest in a comfortable position.",
        "recommendation": "Consult a physician for persistent, moderate pain. Go to urgent care or ER if the pain is sudden, severe, or localized."
    }
}

def analyze_symptoms(symptoms_text: str) -> dict:
    """
    Analyzes patient symptoms and provides educational guidance, warning signs, and care recommendation.
    """
    text_lower = symptoms_text.lower()
    matched_symptoms = []
    
    # Check match against symptom database keys
    for symptom, details in SYMPTOM_GUIDE_DB.items():
        # Search for symptom key or synonyms/partial matches
        if symptom in text_lower:
            matched_symptoms.append((symptom, details))
            
    if not matched_symptoms:
        # Fallback response for generic/unmatched symptoms
        return {
            "symptoms_entered": symptoms_text,
            "detected_issues": ["General / Unspecified Symptoms"],
            "urgency": "Low (Self-Care / Primary Consultation)",
            "explanation": "Your symptom entry does not match high-urgency conditions in our database. It may represent a mild transient issue, muscle strain, or early viral infection.",
            "warnings": [
                "Persistent high fever or chills",
                "Unexplained, sudden weakness or numbness",
                "Difficulty breathing or swallowing",
                "Pain that worsens over time rather than improving"
            ],
            "home_care": "Ensure adequate rest, eat a balanced diet, stay hydrated, and track any changes in your symptoms.",
            "recommendation": "If symptoms worsen, persist for more than 48-72 hours, or cause you discomfort, please schedule a visit with your primary care provider.",
            "disclaimer": "This guidance is for educational purposes only. It is NOT a substitute for professional medical advice, diagnosis, or treatment. If you believe you are experiencing a medical emergency, please contact emergency services immediately."
        }
        
    # If multiple matched, merge details or pick the highest urgency
    matched_symptoms.sort(key=lambda x: "emergency" in x[1]["urgency"].lower() or "high" in x[1]["urgency"].lower(), reverse=True)
    primary_symptom, primary_details = matched_symptoms[0]
    
    return {
        "symptoms_entered": symptoms_text,
        "detected_issues": [item[0].capitalize() for item in matched_symptoms],
        "urgency": primary_details["urgency"],
        "explanation": primary_details["explanation"],
        "warnings": primary_details["warnings"],
        "home_care": primary_details["home_care"],
        "recommendation": primary_details["recommendation"],
        "disclaimer": "This symptom guidance tool is for educational purposes only and does NOT constitute medical advice. Always consult a medical professional for health concerns."
    }
