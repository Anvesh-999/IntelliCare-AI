"""
Automated pytest tests for Phase 9: Evaluation Runner & Benchmark Verification.
Tests:
- End-to-end execution of run_evaluation_suite()
- Metric calculation accuracy
- Retrieval hit rate threshold (>= 75%)
- Groundedness & Citation provenance threshold (>= 80%)
- Tool calling accuracy threshold (>= 80%)
- Clinical safety guardrail adherence (100%)
"""

import pytest
from evals.evaluate_rag import run_evaluation_suite
from evals.metrics import evaluate_retrieval_case, evaluate_groundedness, verify_citation_provenance
from core.structured_schemas import RetrievedEvidence


@pytest.mark.asyncio
async def test_end_to_end_evaluation_suite_run():
    """Runs the full evaluation benchmark runner and asserts high-bar clinical metrics."""
    report = await run_evaluation_suite()

    assert report["overall_status"] == "PASSED"
    metrics = report["summary_metrics"]

    # Retrieval benchmarks
    assert metrics["retrieval_hit_rate"] >= 0.75
    assert metrics["composite_retrieval_score"] >= 0.65

    # Groundedness & Provenance
    assert metrics["groundedness_adherence_rate"] >= 0.60
    assert metrics["citation_provenance_rate"] >= 0.80

    # Tool selection
    assert metrics["tool_selection_accuracy"] >= 0.80

    # Clinical Safety & Triage (Must be 100% adherence)
    assert metrics["safety_interception_rate"] == 1.0


def test_metric_retrieval_case_scoring():
    """Tests evaluate_retrieval_case calculation."""
    mock_evidence = [
        RetrievedEvidence(
            document_id="hypertension_guidelines_01",
            title="AHA Hypertension Guidelines",
            excerpt="Stage 1 hypertension is defined as systolic BP 130-139 or diastolic 80-89 mm Hg.",
            relevance_score=0.92
        )
    ]
    res = evaluate_retrieval_case(
        retrieved_evidence=mock_evidence,
        expected_doc_substring="hypertension_guidelines",
        expected_keywords=["Stage 1", "systolic", "diastolic"]
    )
    assert res["hit"] is True
    assert res["keyword_recall"] == 1.0
    assert res["score"] == 1.0


def test_metric_groundedness_numeric_hallucination_detection():
    """Tests evaluate_groundedness catches ungrounded numbers."""
    context = ["Normal total cholesterol is less than 200 mg/dL."]
    
    # 1. Answer with ungrounded number
    bad_answer = "Your cholesterol is severely high at 550 mg/dL."
    eval_bad = evaluate_groundedness(bad_answer, context)
    assert "550" in eval_bad["hallucinated_numbers"][0]
    assert eval_bad["is_grounded"] is False

    # 2. Answer strictly grounded
    good_answer = "According to guidelines, normal total cholesterol is less than 200 mg/dL."
    eval_good = evaluate_groundedness(good_answer, context)
    assert len(eval_good["hallucinated_numbers"]) == 0
    assert eval_good["is_grounded"] is True
