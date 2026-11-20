"""
Healthcare Safety, Privacy, and Clinical Guardrails Engine for IntelliCare AI.
Provides deterministic safeguards for:
- Emergency symptom triage (immediate non-LLM interception)
- Medication dosage refusal & regimen change protection
- Autonomous diagnosis disclaimer & boundaries
- PII detection and redaction (SSN, credit card, phone, email)
- Adversarial prompt injection defense
- OCR reliability and physiological plausibility validation
"""

import re
import logging
from typing import Optional, Dict, Any, List, Tuple
from pydantic import BaseModel, Field

logger = logging.getLogger("intellicare.safety")


class SafetyCheckResult(BaseModel):
    is_safe: bool = True
    action: str = Field(
        default="allow",
        description="One of: 'allow', 'intercept_emergency', 'refuse_dosage', 'neutralize_injection'"
    )
    urgency_level: str = Field(default="Low", description="'Low', 'Moderate', 'High', 'Emergency'")
    message: Optional[str] = None
    intercept_response: Optional[str] = None
    sanitized_input: str
    pii_detected: bool = False
    pii_details: List[str] = Field(default_factory=list)
    requires_clinician_review: bool = False
    disclaimer: str = (
        "IntelliCare AI is an educational healthcare assistant and NOT an autonomous medical practitioner. "
        "It does not provide formal diagnoses or prescribe medications. For emergencies, call emergency services immediately."
    )


# ---------------------------------------------------------------------------
# 1. Emergency Symptom Patterns (Red-flag indicators)
# ---------------------------------------------------------------------------

EMERGENCY_PATTERNS = [
    # Cardiac / Acute Coronary Syndrome
    (re.compile(r"\b(crushing|severe|radiating|tightness|pressure in)\s+(chest|breastbone)\b", re.IGNORECASE), "Severe chest pain / acute cardiac risk"),
    (re.compile(r"\b(chest pain|heart attack|myocardial infarction)\b", re.IGNORECASE), "Potential acute cardiac event"),
    (re.compile(r"\bchest pressure accompanied by (shortness of breath|sweating|nausea)\b", re.IGNORECASE), "Acute coronary symptom complex"),
    
    # Stroke / Neurological (FAST)
    (re.compile(r"\b(facial\s+droop\w*|face\s+(is\s+)?droop\w*|arm\s+weakness|weakness\s+in\s+(\w+\s+)?arm|slurred\s+speech)\b", re.IGNORECASE), "Suspected acute stroke (FAST indicators)"),
    (re.compile(r"\b(sudden loss of vision|sudden numbness in one side|sudden inability to speak)\b", re.IGNORECASE), "Acute neurological deficit / stroke"),
    (re.compile(r"\b(worst headache of my life|thunderclap headache)\b", re.IGNORECASE), "Potential subarachnoid hemorrhage"),
    
    # Respiratory Distress / Airway
    (re.compile(r"\b(can't breathe|cannot breathe|unable to breathe|gasping for air|blue lips)\b", re.IGNORECASE), "Acute respiratory compromise / asphyxiation"),
    (re.compile(r"\b(throat closing|throat swelling up|throat is swelling|severe anaphylaxis)\b", re.IGNORECASE), "Acute anaphylactic reaction"),
    
    # Severe Trauma / Hemorrhage
    (re.compile(r"\b(coughing up large amounts of blood|uncontrolled bleeding|severe head trauma)\b", re.IGNORECASE), "Severe hemorrhage or critical trauma"),
    
    # Psychiatric Emergency / Crisis
    (re.compile(r"\b(want to kill myself|commit suicide|end my life|feeling suicidal)\b", re.IGNORECASE), "Acute psychiatric crisis / suicide risk")
]

EMERGENCY_TRIAGE_RESPONSE = (
    "🚨 **EMERGENCY MEDICAL ADVISORY** 🚨\n\n"
    "The symptoms described indicate a **potentially life-threatening medical emergency** requiring immediate evaluation.\n\n"
    "**IMMEDIATE ACTIONS REQUIRED:**\n"
    "1. **Call Emergency Services immediately**: Dial **911** (United States / Canada), **112** (Europe / International), or your local emergency dispatch.\n"
    "2. If experiencing acute distress or suicidal crisis, dial or text **988** to reach the Suicide & Crisis Lifeline.\n"
    "3. **Do not drive yourself** to the emergency department — await emergency medical personnel.\n"
    "4. Cease physical activity and sit or lie down in a safe position.\n\n"
    "*Automated AI systems cannot evaluate, triage, or treat acute emergencies. Immediate in-person professional care is imperative.*"
)


# ---------------------------------------------------------------------------
# 2. Medication Dosage Refusal Patterns
# ---------------------------------------------------------------------------

DOSAGE_PATTERNS = [
    re.compile(r"\b(how much|what dose|what dosage|how many mg|how many pills|how many tablets)\b.*?\b(should|can)\s+i\s+take\b", re.IGNORECASE),
    re.compile(r"\bwhat\s+(is\s+the\s+)?(dose|dosage)\s+of\s+[a-zA-Z]+\s+(should|can)\s+i\s+take\b", re.IGNORECASE),
    re.compile(r"\b(prescribe|calculate (my|the) dose|adjust my dose|can i double my dose)\b", re.IGNORECASE),
    re.compile(r"\bcan i take \d+\s*(mg|pills|tablets|capsules)\s+of\b", re.IGNORECASE),
    re.compile(r"\bshould i stop taking (my|the)\s+[a-zA-Z]+\b", re.IGNORECASE),
    re.compile(r"\bwhat is the maximum safe dose of [a-zA-Z]+ i can take\b", re.IGNORECASE)
]

DOSAGE_REFUSAL_RESPONSE = (
    "⚠️ **CLINICAL SAFETY ADVISORY: DOSAGE DETERMINATION RESTRICTED**\n\n"
    "IntelliCare AI is strictly prohibited from prescribing medication, calculating individual dosages, "
    "or authorizing modifications to prescribed regimens.\n\n"
    "**Why?**\n"
    "Safe pharmacotherapy requires direct clinical assessment of:\n"
    "- Renal and hepatic function test results\n"
    "- Accurate body weight, age, and clinical indication\n"
    "- Total concurrent medications and potential metabolic interactions\n\n"
    "**Recommended Next Step:**\n"
    "Please consult your prescribing physician or a licensed pharmacist directly before starting, altering, or stopping any medication."
)


# ---------------------------------------------------------------------------
# 3. Prompt Injection Patterns
# ---------------------------------------------------------------------------

INJECTION_PATTERNS = [
    re.compile(r"ignore\s+(all\s+)?(previous|prior|above)\s+instructions", re.IGNORECASE),
    re.compile(r"disregard\s+(all\s+)?(system|safety|clinical)\s+(prompts|guidelines|rules)", re.IGNORECASE),
    re.compile(r"you\s+are\s+now\s+(DAN|unrestricted|developer mode)", re.IGNORECASE),
    re.compile(r"reveal\s+(your\s+)?(system\s+prompt|internal\s+instructions|secret\s+key)", re.IGNORECASE),
    re.compile(r"</?patient_context>", re.IGNORECASE)
]


# ---------------------------------------------------------------------------
# 4. PII Redaction Regexes
# ---------------------------------------------------------------------------

PII_PATTERNS = [
    (re.compile(r"\b\d{3}-\d{2}-\d{4}\b"), "[REDACTED_SSN]"),
    (re.compile(r"\b(?:\d{4}[ -]?){3}\d{4}\b"), "[REDACTED_CREDIT_CARD]"),
    (re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b"), "[REDACTED_EMAIL]"),
    (re.compile(r"\b(?:\+?1[-. ]?)?\(?\d{3}\)?[-. ]?\d{3}[-. ]?\d{4}\b"), "[REDACTED_PHONE]")
]


def redact_pii(text: str) -> Tuple[str, bool, List[str]]:
    """Detects and redacts common Personally Identifiable Information (PII)."""
    sanitized = text
    detected = False
    details = []

    for pattern, replacement in PII_PATTERNS:
        matches = pattern.findall(sanitized)
        if matches:
            detected = True
            details.append(f"Redacted {len(matches)} instance(s) matching {replacement}")
            sanitized = pattern.sub(replacement, sanitized)

    return sanitized, detected, details


# ---------------------------------------------------------------------------
# 5. Physiological Range Validation for Diagnostic Measurements
# ---------------------------------------------------------------------------

PHYSIOLOGICAL_RANGES = {
    "blood_pressure_systolic": {"min": 50, "max": 280, "unit": "mmHg"},
    "blood_pressure_diastolic": {"min": 30, "max": 180, "unit": "mmHg"},
    "blood_glucose": {"min": 20, "max": 1200, "unit": "mg/dL"},
    "heart_rate": {"min": 30, "max": 250, "unit": "bpm"},
    "hemoglobin": {"min": 3.0, "max": 25.0, "unit": "g/dL"},
    "total_cholesterol": {"min": 50, "max": 800, "unit": "mg/dL"}
}


def validate_measurement(metric: str, value: float) -> Tuple[bool, Optional[str]]:
    """
    Validates that a clinical metric falls within biologically plausible human ranges.
    Flags implausible or corrupted OCR numbers.
    """
    spec = PHYSIOLOGICAL_RANGES.get(metric.lower())
    if not spec:
        return True, None

    if value < spec["min"] or value > spec["max"]:
        warning = (
            f"Measurement '{metric}' value of {value} {spec['unit']} is outside biologically plausible limits "
            f"({spec['min']}–{spec['max']} {spec['unit']}). Potential OCR error or corrupted data."
        )
        return False, warning

    return True, None


def validate_ocr_reliability(confidence: float, raw_text: str) -> Dict[str, Any]:
    """
    Verifies that OCR output meets minimum safety confidence thresholds.
    """
    is_reliable = confidence >= 0.60
    has_text = len(raw_text.strip()) >= 5

    warnings = []
    if not is_reliable:
        warnings.append("Low OCR confidence score (< 60%). Extracted medication or lab values may be inaccurate.")
    if not has_text:
        warnings.append("Insufficient text recovered from scan image.")

    return {
        "is_reliable": is_reliable and has_text,
        "confidence": confidence,
        "requires_human_verification": True,
        "warnings": warnings,
        "disclaimer": "All OCR extracted prescriptions and reports must be verified against original physical documents."
    }


# ---------------------------------------------------------------------------
# 6. Comprehensive Safety Evaluator
# ---------------------------------------------------------------------------

def evaluate_clinical_safety(
    message: str,
    health_profile: Optional[Dict[str, Any]] = None
) -> SafetyCheckResult:
    """
    Evaluates incoming user message against clinical guardrails before passing to LLM.
    Returns intercepted responses for emergency and dosage requests.
    """
    if not message:
        return SafetyCheckResult(is_safe=True, sanitized_input="")

    # 1. PII Redaction
    sanitized_input, pii_detected, pii_details = redact_pii(message)

    # 2. Prompt Injection Defense
    for pattern in INJECTION_PATTERNS:
        if pattern.search(sanitized_input):
            logger.warning("Prompt injection pattern detected and neutralized: %s", pattern.pattern)
            sanitized_input = pattern.sub("[FILTERED_INPUT]", sanitized_input)
            return SafetyCheckResult(
                is_safe=False,
                action="neutralize_injection",
                urgency_level="Low",
                sanitized_input=sanitized_input,
                intercept_response=(
                    "Your request contains system instruction override patterns. "
                    "IntelliCare AI operates strictly within clinical safety guidelines."
                )
            )

    # 3. Emergency Symptom Check (Deterministic Priority 1 Interception)
    for pattern, reason in EMERGENCY_PATTERNS:
        if pattern.search(sanitized_input):
            logger.warning("CRITICAL: Red-flag emergency symptom detected: %s", reason)
            return SafetyCheckResult(
                is_safe=False,
                action="intercept_emergency",
                urgency_level="Emergency",
                message=reason,
                intercept_response=EMERGENCY_TRIAGE_RESPONSE,
                sanitized_input=sanitized_input,
                pii_detected=pii_detected,
                pii_details=pii_details,
                requires_clinician_review=True
            )

    # 4. Medication Dosage Refusal (Deterministic Priority 2 Refusal)
    for pattern in DOSAGE_PATTERNS:
        if pattern.search(sanitized_input):
            logger.info("Prescription dosage request intercepted and refused.")
            return SafetyCheckResult(
                is_safe=False,
                action="refuse_dosage",
                urgency_level="Moderate",
                message="Medication dosage calculation/adjustment request refused.",
                intercept_response=DOSAGE_REFUSAL_RESPONSE,
                sanitized_input=sanitized_input,
                pii_detected=pii_detected,
                pii_details=pii_details,
                requires_clinician_review=True
            )

    # 5. Clean Input Passed
    return SafetyCheckResult(
        is_safe=True,
        action="allow",
        urgency_level="Low",
        sanitized_input=sanitized_input,
        pii_detected=pii_detected,
        pii_details=pii_details
    )
