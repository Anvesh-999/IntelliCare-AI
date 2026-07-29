TRUSTED_RESOURCES = {
    "flu": "The seasonal flu is a contagious respiratory illness caused by influenza viruses. Symptoms include fever, chills, cough, sore throat, runny or stuffy nose, muscle aches, headache, and fatigue. Rest, hydration, and fever reducers are recommended. High-risk patients should consult a doctor for antiviral prescriptions.",
    "allergy": "Allergies occur when the immune system reacts to a foreign substance (allergen) like pollen, pet dander, or food. Common symptoms include sneezing, itching, runny nose, or rashes. Treatment includes avoiding allergens and taking antihistamines or nasal sprays.",
    "hypertension": "High blood pressure is a common condition where the long-term force of blood against artery walls is high enough to cause health problems. It is managed by reducing sodium, regular exercise, limiting alcohol, maintaining a healthy weight, and taking prescribed anti-hypertensive drugs.",
    "diabetes": "Diabetes is a chronic condition that affects how the body turns food into energy. Type 2 diabetes involves insulin resistance, managed with a balanced low-carb diet, exercise, weight loss, and medications like metformin. Type 1 diabetes is an autoimmune condition requiring insulin injections."
}

def generate_assistant_response(query: str, health_profile: dict = None) -> dict:
    """
    Simulates a secure, context-aware RAG AI assistant. It integrates the user's query,
    authorized health history, and matches questions against trusted educational medical content.
    """
    query_lower = query.lower()
    context = ""
    
    # 1. Integrate medical record context if authorized/provided
    if health_profile:
        name = health_profile.get("name", "Patient")
        conditions = health_profile.get("conditions", [])
        medications = health_profile.get("medications", [])
        allergies = health_profile.get("allergies", [])
        
        context_parts = []
        if conditions:
            context_parts.append(f"active diagnoses ({', '.join(conditions)})")
        if medications:
            context_parts.append(f"current medications ({', '.join(medications)})")
        if allergies:
            context_parts.append(f"known allergies ({', '.join(allergies)})")
            
        if context_parts:
            context = f"Based on your profile with {'; '.join(context_parts)}: "

    # 2. Match query against trusted medical resources
    matched_info = []
    for key, info in TRUSTED_RESOURCES.items():
        if key in query_lower:
            matched_info.append(info)
            
    if matched_info:
        knowledge_base_response = " ".join(matched_info)
    else:
        # Generic response structure
        knowledge_base_response = (
            "Regarding your question, standard clinical guidelines recommend focusing on "
            "adequate rest, proper hydration, and eating a well-balanced diet. Monitor "
            "your vital signs (like temperature and blood pressure) if you feel unwell."
        )

    # 3. Formulate the response
    if context:
        response_text = f"{context}\n\n{knowledge_base_response}"
        # Context-specific advice
        if "medications" in health_profile and len(health_profile["medications"]) > 0:
            response_text += "\n\nRemember to double-check that any new over-the-counter remedies do not interact with your current medications."
    else:
        response_text = knowledge_base_response

    # Add question specific tips
    if "fever" in query_lower or "flu" in query_lower:
        response_text += "\n\nTip: For fevers, staying hydrated with water and electrolyte solutions is critical. Seek medical care if a fever exceeds 103°F or lasts more than 3 days."
    elif "bp" in query_lower or "blood pressure" in query_lower:
        response_text += "\n\nTip: Consistent daily monitoring is best. Measure blood pressure at the same time daily, sitting quietly for 5 minutes beforehand."

    return {
        "query": query,
        "response": response_text,
        "disclaimer": "This assistant provides educational health information based on clinical guidelines. It does not replace professional medical evaluations."
    }
