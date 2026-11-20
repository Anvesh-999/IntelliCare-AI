"""
Concrete implementations of the controlled clinical tools in IntelliCare AI.
Every tool operates with bounded scope, explicit argument typing, and data safety boundaries.
"""

import logging
from typing import Dict, Any, List, Optional

from services.interactions import check_drug_interactions
from services.ocr_engine import extract_prescription_info
from rag.retriever import get_retriever

logger = logging.getLogger("intellicare.tools")

# Synthetic patient records for development, testing, and demonstration.
# Real patient data is never hardcoded.
SYNTHETIC_PATIENT_RECORDS = {
    "patient-101": {
        "patient_id": "patient-101",
        "name": "Sarah Jenkins",
        "age": 52,
        "gender": "Female",
        "reports": [
            {
                "report_id": "rep-101-a",
                "report_type": "lipid_panel",
                "date": "2026-10-15",
                "findings": {
                    "total_cholesterol": "240 mg/dL (High, ref < 200)",
                    "hdl_cholesterol": "35 mg/dL (Low, ref > 50)",
                    "ldl_cholesterol": "155 mg/dL (High, ref < 100)",
                    "triglycerides": "180 mg/dL (High, ref < 150)"
                },
                "impression": "Moderate hyperlipidemia with low HDL."
            }
        ],
        "active_prescriptions": ["Atorvastatin 20mg once daily at bedtime", "Aspirin 81mg once daily"]
    },
    "patient-102": {
        "patient_id": "patient-102",
        "name": "David Chen",
        "age": 44,
        "gender": "Male",
        "reports": [
            {
                "report_id": "rep-102-a",
                "report_type": "blood_report",
                "date": "2026-11-02",
                "findings": {
                    "hemoglobin": "10.8 g/dL (Low, ref 13.8 - 17.2)",
                    "wbc": "12.5 x10^3/uL (High, ref 4.5 - 11.0)",
                    "platelets": "240 x10^3/uL (Normal, ref 150 - 450)",
                    "rbc": "3.9 x10^6/uL (Low, ref 4.7 - 6.1)"
                },
                "impression": "Mild normocytic anemia with mild leukocytosis."
            }
        ],
        "active_prescriptions": ["Lisinopril 10mg once daily"]
    },
    "patient-103": {
        "patient_id": "patient-103",
        "name": "Maria Rodriguez",
        "age": 67,
        "gender": "Female",
        "reports": [
            {
                "report_id": "rep-103-a",
                "report_type": "prescription",
                "date": "2026-11-10",
                "findings": {
                    "rx_text": "Amoxicillin 500mg TID for 7 days; Ibuprofen 400mg Q6H PRN."
                },
                "impression": "Bacterial upper respiratory infection treatment regimen."
            }
        ],
        "active_prescriptions": ["Amoxicillin 500mg", "Ibuprofen 400mg", "Warfarin 5mg"]
    }
}


async def tool_lookup_drug_interaction(medicines: List[str], user_context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Checks for potential adverse interactions among a list of medications.
    """
    raw_result = check_drug_interactions(medicines)
    return {
        "status": "success",
        "medicines_checked": medicines,
        "has_interactions": raw_result.get("has_interactions", False),
        "summary": raw_result.get("summary", ""),
        "interactions": raw_result.get("interactions", []),
        "disclaimer": (
            "Educational tool check against curated high-risk medication pairs. "
            "Not an exhaustive clinical formulary. Always verify with a licensed pharmacist or physician."
        )
    }


async def tool_extract_prescription(raw_text: str, user_context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Parses unstructured prescription or medication text to extract dosage, frequency, and duration.
    """
    extracted = extract_prescription_info(raw_text)
    return {
        "status": "success",
        "input_length": len(raw_text),
        "medicines_extracted": extracted,
        "total_medicines_found": len(extracted),
        "disclaimer": "Automated OCR/regex extraction. All prescriptions must be verified by a pharmacist before dispensing."
    }


async def tool_interpret_report(
    report_text: str,
    patient_context: Optional[str] = None,
    user_context: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Interprets clinical laboratory findings and identifies abnormal flags.
    """
    from services.summarizer import summarize_medical_report
    summary = summarize_medical_report(report_text)
    return {
        "status": "success",
        "report_summary": summary.get("summary", ""),
        "anomalies_detected": summary.get("anomalies", []),
        "lifestyle_recommendations": summary.get("recommendations", []),
        "requires_clinician_review": len(summary.get("anomalies", [])) > 0,
        "disclaimer": "Diagnostic laboratory interpretation is educational only. Consult your ordering physician for definitive evaluation."
    }


async def tool_retrieve_medical_reference(
    query: str,
    top_k: int = 3,
    user_context: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Retrieves grounded evidence from verified medical guidelines.
    """
    retriever = get_retriever()
    results = await retriever.search(query=query, top_k=top_k)
    return {
        "status": "success",
        "query": query,
        "evidence_count": len(results),
        "references": [
            {
                "document_id": r.document_id,
                "title": r.title,
                "excerpt": r.excerpt,
                "similarity_score": round(r.relevance_score, 4)
            }
            for r in results
        ],
        "disclaimer": "Retrieved from local institutional reference guidelines."
    }


async def tool_get_patient_report(
    patient_id: str,
    report_type: Optional[str] = None,
    user_context: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Retrieves synthetic patient medical records.
    Strictly enforces authorization: a patient cannot access another patient's records.
    """
    # Authorization checks
    if user_context:
        role = user_context.get("role", "patient")
        caller_id = user_context.get("user_id") or user_context.get("patient_id")
        
        # Enforce cross-patient data access prevention
        if role == "patient" and caller_id and caller_id != patient_id:
            logger.warning(
                "SECURITY ALERT: Patient %s attempted unauthorized access to patient %s records",
                caller_id, patient_id
            )
            raise PermissionError(
                f"Access denied: You are logged in as {caller_id} and are strictly prohibited from viewing records of patient {patient_id}."
            )

    # Lookup patient in synthetic records
    record = SYNTHETIC_PATIENT_RECORDS.get(patient_id)
    if not record:
        return {
            "status": "not_found",
            "message": f"No records found for patient identifier '{patient_id}'.",
            "patient_id": patient_id
        }

    reports = record.get("reports", [])
    if report_type:
        reports = [r for r in reports if r.get("report_type") == report_type]

    return {
        "status": "success",
        "patient_id": patient_id,
        "name": record["name"],
        "age": record["age"],
        "gender": record["gender"],
        "reports": reports,
        "active_prescriptions": record.get("active_prescriptions", []),
        "disclaimer": "Confidential patient health record. Authorized clinical access only."
    }
