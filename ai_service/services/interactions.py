INTERACTION_RULES = [
    {
        "drugs": {"aspirin", "warfarin"},
        "severity": "High (Severe Risk)",
        "explanation": "Combining Aspirin and Warfarin significantly increases the risk of bleeding. Both drugs affect blood clotting pathways.",
        "advice": "Consult a cardiologist or primary care doctor immediately to see if one should be suspended or adjusted. Do not stop prescribed medications without consulting your doctor."
    },
    {
        "drugs": {"ibuprofen", "aspirin"},
        "severity": "Moderate (Risk of Side Effects)",
        "explanation": "Taking Ibuprofen and Aspirin together can reduce the cardioprotective benefits of Aspirin and increase the risk of gastrointestinal ulcers and stomach bleeding.",
        "advice": "Avoid taking NSAIDs like Ibuprofen at the same time as daily low-dose Aspirin. Discuss safer pain relief options (like Acetaminophen) with your pharmacist."
    },
    {
        "drugs": {"lisinopril", "potassium"},
        "severity": "Moderate",
        "explanation": "Lisinopril (ACE inhibitor) can increase blood potassium levels. Taking it with potassium supplements can lead to hyperkalemia (abnormally high potassium), affecting heart rhythms.",
        "advice": "Monitor blood potassium levels. Avoid potassium supplements or salt substitutes containing potassium without direct medical supervision."
    },
    {
        "drugs": {"metformin", "contrast dye"},
        "severity": "Moderate",
        "explanation": "Iodinated contrast dyes used in scans can temporarily impair kidney function, which can lead to a buildup of metformin and increase the risk of lactic acidosis.",
        "advice": "Patients taking Metformin are typically advised to temporarily suspend the medication for 48 hours after receiving an IV contrast scan, subject to doctor review."
    },
    {
        "drugs": {"sildenafil", "nitroglycerin"},
        "severity": "High (Severe Risk)",
        "explanation": "Co-administration of Nitroglycerin and Sildenafil can cause a sudden and life-threatening drop in blood pressure.",
        "advice": "Never combine these medications. If chest pain occurs, notify emergency medical personnel of all medications taken."
    }
]

def check_drug_interactions(medicines: list) -> dict:
    """
    Checks a list of drug names for potential interaction risks.
    """
    meds_set = {m.strip().lower() for m in medicines}
    detected_interactions = []
    
    # Check all rules
    for rule in INTERACTION_RULES:
        # Check if the set of medications contains all drugs required by the rule
        if rule["drugs"].issubset(meds_set):
            detected_interactions.append({
                "drugs": [d.capitalize() for d in rule["drugs"]],
                "severity": rule["severity"],
                "explanation": rule["explanation"],
                "advice": rule["advice"]
            })
            
    has_interactions = len(detected_interactions) > 0
    summary = (
        f"Warning: {len(detected_interactions)} potential interaction(s) detected. Please consult your physician."
        if has_interactions else "No critical drug-drug interactions detected among the provided medicines."
    )
    
    return {
        "has_interactions": has_interactions,
        "summary": summary,
        "interactions": detected_interactions,
        "disclaimer": "The drug interaction checker provides educational information and is NOT a complete clinical tool. Consult a licensed pharmacist or physician before changing any medication regimen."
    }
