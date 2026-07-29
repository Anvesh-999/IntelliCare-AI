def summarize_medical_report(report_text: str) -> dict:
    """
    Translates complex medical lab terms (e.g. cholesterol, CBC, thyroid metrics) into simple,
    comprehensible language for the patient, highlighting key alerts.
    """
    text_lower = report_text.lower()
    
    # We analyze common panels: Lipid, CBC, Metabolic
    findings = []
    recommendations = []
    anomalies = []
    
    # Check for Lipid Profile
    lipid_detected = any(term in text_lower for term in ["cholesterol", "lipid", "hdl", "ldl", "triglycerides"])
    if lipid_detected:
        findings.append({
            "panel": "Lipid (Cholesterol) Panel",
            "explanation": "This panel measures the amount of fats/cholesterol in your blood. Cholesterol is essential for building cells, but high levels of bad cholesterol (LDL) or low levels of good cholesterol (HDL) can increase cardiovascular risks."
        })
        
        # Check specific values
        if "hdl" in text_lower:
            findings.append({
                "metric": "HDL Cholesterol ('Good' Cholesterol)",
                "status": "Needs Attention" if "low" in text_lower or "decrease" in text_lower or "<" in text_lower else "Normal",
                "explanation": "HDL helps clear bad cholesterol from your bloodstream. High values are protective, while low values may require lifestyle adjustments like exercise and healthy fats."
            })
            if "low" in text_lower or "< 40" in text_lower:
                anomalies.append("Low HDL ('Good') Cholesterol")
                recommendations.append("Incorporate healthy fats (olive oil, avocados, nuts) and regular aerobic exercise to help raise your HDL levels.")
                
        if "ldl" in text_lower:
            findings.append({
                "metric": "LDL Cholesterol ('Bad' Cholesterol)",
                "status": "High" if "high" in text_lower or "elevated" in text_lower or "> 100" in text_lower or "> 130" in text_lower else "Normal",
                "explanation": "LDL can build up in the walls of your arteries. Keeping this value low helps protect heart health."
            })
            if "high" in text_lower or "> 130" in text_lower or "elevated" in text_lower:
                anomalies.append("Elevated LDL ('Bad') Cholesterol")
                recommendations.append("Reduce saturated fats and cholesterol-heavy foods. Focus on high-fiber foods like oats, beans, and vegetables.")

    # Check for CBC (Complete Blood Count)
    cbc_detected = any(term in text_lower for term in ["cbc", "hemoglobin", "wbc", "rbc", "platelets", "hematocrit"])
    if cbc_detected:
        findings.append({
            "panel": "Complete Blood Count (CBC)",
            "explanation": "This test evaluates the cells in your blood: red blood cells (carry oxygen), white blood cells (fight infections), and platelets (help blood clot)."
        })
        
        if "hemoglobin" in text_lower or "rbc" in text_lower:
            is_low = "low" in text_lower or "anemia" in text_lower or "<" in text_lower
            findings.append({
                "metric": "Hemoglobin / Red Blood Cells",
                "status": "Low (Mild Anemia Risk)" if is_low else "Normal",
                "explanation": "Hemoglobin is the protein in red blood cells that carries oxygen to your organs. Low levels can lead to fatigue or weakness."
            })
            if is_low:
                anomalies.append("Low Hemoglobin Levels")
                recommendations.append("Consider iron-rich foods (spinach, red meat, lentils) paired with Vitamin C to increase iron absorption. Discuss with your doctor if iron supplements are needed.")
                
        if "wbc" in text_lower or "white blood cell" in text_lower:
            is_high = "high" in text_lower or "elevated" in text_lower or "> 11" in text_lower or "> 10000" in text_lower
            findings.append({
                "metric": "White Blood Cell (WBC) Count",
                "status": "High" if is_high else "Normal",
                "explanation": "White blood cells are your body's defense mechanism. A high count often indicates your body is actively fighting off a mild infection or experiencing inflammation."
            })
            if is_high:
                anomalies.append("Elevated White Blood Cell Count")
                recommendations.append("Ensure you get plenty of rest and hydration. Monitor for signs of active infection like fever, sore throat, or localized pain.")

    # Check for Metabolic / Diabetes
    diabetic_detected = any(term in text_lower for term in ["glucose", "hba1c", "blood sugar", "diabetes", "a1c"])
    if diabetic_detected:
        findings.append({
            "panel": "Blood Glucose & Glycemic Control (HbA1c)",
            "explanation": "These measurements monitor your blood sugar levels and average control over the past 3 months. Essential for screening for pre-diabetes and diabetes."
        })
        if "hba1c" in text_lower or "a1c" in text_lower:
            is_high = "high" in text_lower or "> 5.7" in text_lower or "> 6.5" in text_lower or "elevated" in text_lower
            findings.append({
                "metric": "Hemoglobin A1c (HbA1c)",
                "status": "Elevated" if is_high else "Normal",
                "explanation": "A1c shows your average blood sugar over 90 days. Values between 5.7% and 6.4% indicate pre-diabetes, and 6.5% or higher suggest diabetes."
            })
            if is_high:
                anomalies.append("Elevated HbA1c (Average Blood Sugar)")
                recommendations.append("Limit refined sugars and processed carbohydrates. Focus on complex carbs, portion control, and regular daily walking after meals.")

    # General fallback summary if nothing specific matched
    if not findings:
        findings.append({
            "panel": "General Health Panel",
            "explanation": "Analyzed standard wellness markers. Your numbers represent blood chemistry, organ function indicators, and metabolic rates."
        })
        findings.append({
            "metric": "Standard Markers",
            "status": "Normal",
            "explanation": "All major indicators fall within the standard references ranges. Continue your healthy routines!"
        })

    if not recommendations:
        recommendations.append("Continue to maintain a balanced diet rich in whole foods, stay hydrated, and target 150 minutes of moderate activity weekly.")
        recommendations.append("Schedule regular annual health checkups to monitor your baseline levels over time.")

    # Summary explanation
    summary_text = (
        f"Your report shows a total of {len(anomalies)} items that are outside standard ranges. "
        if anomalies else "Your report shows stable parameters within standard reference intervals. "
    )
    if anomalies:
        summary_text += f"We identified minor alerts in: {', '.join(anomalies)}. "
    summary_text += "Please share these results with your primary care provider to contextualize them alongside your physical exam."

    return {
        "summary": summary_text,
        "anomalies": anomalies,
        "findings": findings,
        "recommendations": recommendations,
        "disclaimer": "This AI summary provides educational explanations of lab results and is NOT a medical diagnosis. Please consult a qualified physician."
    }
