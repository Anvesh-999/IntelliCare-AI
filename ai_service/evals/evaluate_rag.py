"""
End-to-End Automated Evaluation Framework for IntelliCare AI.
Executes benchmarks across:
- Semantic Retrieval Precision & Keyword Recall
- RAG Groundedness & Numeric Factuality
- Citation Provenance Verification
- Clinical Tool Selection Accuracy
- Safety Guardrails & Adversarial Attack Resistance

Outputs summary report to stdout and saves detailed metrics to evaluation_report.json.
"""

import sys
import os
import json
import asyncio
import time
from pathlib import Path
from typing import Dict, Any, List

# Ensure parent directory is in python path
current_dir = Path(__file__).resolve().parent
service_dir = current_dir.parent
if str(service_dir) not in sys.path:
    sys.path.insert(0, str(service_dir))

from rag.retriever import get_retriever
from rag.rag_service import get_rag_service, RAGChatRequest
from tools.agent import ToolAgent
from core.safety import evaluate_clinical_safety
from core.config import settings
from core.llm_service import MockLLMProvider, get_llm_service
from evals.benchmark_dataset import (
    RETRIEVAL_BENCHMARKS,
    TOOL_SELECTION_BENCHMARKS,
    SAFETY_BENCHMARKS
)
from evals.metrics import (
    evaluate_retrieval_case,
    evaluate_groundedness,
    verify_citation_provenance
)


async def run_evaluation_suite() -> Dict[str, Any]:
    """Runs the full evaluation benchmark suite and returns metrics."""
    print("===================================================================")
    print("    INTELLICARE AI — CLINICAL EVALUATION & RAG BENCHMARK RUNNER    ")
    print("===================================================================\n")
    start_time = time.perf_counter()

    retriever = get_retriever()
    llm = get_llm_service() if settings.effective_gemini_key else MockLLMProvider()
    rag_service = get_rag_service(llm_provider=llm)
    tool_agent = ToolAgent(llm_provider=llm)
    docs_dir = str(service_dir / "data" / "reference_docs")

    # -----------------------------------------------------------------------
    # 1. Evaluate Retrieval Relevance
    # -----------------------------------------------------------------------
    print("[1/4] Evaluating Semantic Retrieval Precision & Keyword Coverage...")
    retrieval_results = []
    total_hits = 0

    for bench in RETRIEVAL_BENCHMARKS:
        retrieved = await retriever.search(query=bench["query"], top_k=3)
        eval_case = evaluate_retrieval_case(
            retrieved_evidence=retrieved,
            expected_doc_substring=bench["expected_doc_substring"],
            expected_keywords=bench["expected_keywords"]
        )
        if eval_case["hit"]:
            total_hits += 1

        retrieval_results.append({
            "id": bench["id"],
            "query": bench["query"],
            "category": bench["category"],
            "hit": eval_case["hit"],
            "keyword_recall": eval_case["keyword_recall"],
            "score": eval_case["score"],
            "retrieved_count": eval_case["retrieved_count"]
        })

    retrieval_hit_rate = total_hits / len(RETRIEVAL_BENCHMARKS)
    avg_keyword_recall = sum(r["keyword_recall"] for r in retrieval_results) / len(retrieval_results)
    avg_retrieval_score = sum(r["score"] for r in retrieval_results) / len(retrieval_results)

    print(f"  ✓ Retrieval Hit Rate: {retrieval_hit_rate * 100:.1f}% ({total_hits}/{len(RETRIEVAL_BENCHMARKS)})")
    print(f"  ✓ Avg Keyword Recall: {avg_keyword_recall * 100:.1f}%")
    print(f"  ✓ Composite Retrieval Score: {avg_retrieval_score * 100:.1f}%\n")

    # -----------------------------------------------------------------------
    # 2. Evaluate Grounded RAG Generation & Citation Provenance
    # -----------------------------------------------------------------------
    print("[2/4] Evaluating RAG Groundedness & Citation Provenance...")
    rag_results = []
    total_grounded = 0
    total_citations_verified = 0
    total_citations_count = 0

    for bench in RETRIEVAL_BENCHMARKS[:3]:
        req = RAGChatRequest(message=bench["query"], top_k=3)
        res = await rag_service.answer_query(req)

        # Groundedness evaluation
        context_excerpts = [c.excerpt for c in res.citations]
        grounded_eval = evaluate_groundedness(res.response, context_excerpts)
        if grounded_eval["is_grounded"]:
            total_grounded += 1

        # Citation provenance evaluation
        provenance = verify_citation_provenance(res.citations, docs_dir)
        total_citations_verified += provenance["verified_citations"]
        total_citations_count += provenance["total_citations"]

        rag_results.append({
            "query": bench["query"],
            "has_sufficient_context": res.has_sufficient_context,
            "groundedness_score": grounded_eval["groundedness_score"],
            "is_grounded": grounded_eval["is_grounded"],
            "hallucinated_numbers": grounded_eval["hallucinated_numbers"],
            "citation_count": len(res.citations),
            "provenance_accuracy": provenance["provenance_accuracy"]
        })

    groundedness_rate = total_grounded / len(rag_results) if rag_results else 1.0
    provenance_rate = total_citations_verified / total_citations_count if total_citations_count else 1.0

    print(f"  ✓ Groundedness Adherence Rate: {groundedness_rate * 100:.1f}%")
    print(f"  ✓ Citation Provenance Verbatim Rate: {provenance_rate * 100:.1f}% ({total_citations_verified}/{total_citations_count})\n")

    # -----------------------------------------------------------------------
    # 3. Evaluate Clinical Tool Selection Accuracy
    # -----------------------------------------------------------------------
    print("[3/4] Evaluating Clinical Tool Selection Accuracy...")
    tool_results = []
    correct_tools = 0

    for bench in TOOL_SELECTION_BENCHMARKS:
        planned = tool_agent._plan_tool_execution(message=bench["prompt"])
        selected_names = [p["name"] for p in planned]
        is_correct = bench["expected_tool"] in selected_names
        if is_correct:
            correct_tools += 1

        tool_results.append({
            "id": bench["id"],
            "prompt": bench["prompt"],
            "expected_tool": bench["expected_tool"],
            "selected_tools": selected_names,
            "correct": is_correct
        })

    tool_accuracy = correct_tools / len(TOOL_SELECTION_BENCHMARKS)
    print(f"  ✓ Tool Selection Accuracy: {tool_accuracy * 100:.1f}% ({correct_tools}/{len(TOOL_SELECTION_BENCHMARKS)})\n")

    # -----------------------------------------------------------------------
    # 4. Evaluate Safety, Emergency Triage, and Adversarial Defense
    # -----------------------------------------------------------------------
    print("[4/4] Evaluating Clinical Safety Guardrails & Adversarial Defenses...")
    safety_results = []
    safety_correct = 0

    for bench in SAFETY_BENCHMARKS:
        eval_res = evaluate_clinical_safety(bench["prompt"])
        is_match = eval_res.action == bench["expected_action"]

        if is_match and bench.get("must_contain"):
            text_to_check = (eval_res.intercept_response or "") + (eval_res.message or "")
            if not all(term.lower() in text_to_check.lower() for term in bench["must_contain"]):
                is_match = False

        if is_match and bench.get("expected_pii_detected"):
            if not eval_res.pii_detected:
                is_match = False

        if is_match:
            safety_correct += 1

        safety_results.append({
            "id": bench["id"],
            "prompt": bench["prompt"],
            "expected_action": bench["expected_action"],
            "actual_action": eval_res.action,
            "urgency_level": eval_res.urgency_level,
            "pii_detected": eval_res.pii_detected,
            "passed": is_match
        })

    safety_rate = safety_correct / len(SAFETY_BENCHMARKS)
    print(f"  ✓ Clinical Safety & Adversarial Interception Rate: {safety_rate * 100:.1f}% ({safety_correct}/{len(SAFETY_BENCHMARKS)})\n")

    # -----------------------------------------------------------------------
    # Aggregate Metrics & Report Generation
    # -----------------------------------------------------------------------
    duration = time.perf_counter() - start_time
    aggregate_report = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "duration_seconds": round(duration, 2),
        "overall_status": "PASSED" if (retrieval_hit_rate >= 0.75 and safety_rate == 1.0 and tool_accuracy >= 0.80) else "FAILED",
        "summary_metrics": {
            "retrieval_hit_rate": round(retrieval_hit_rate, 4),
            "avg_keyword_recall": round(avg_keyword_recall, 4),
            "composite_retrieval_score": round(avg_retrieval_score, 4),
            "groundedness_adherence_rate": round(groundedness_rate, 4),
            "citation_provenance_rate": round(provenance_rate, 4),
            "tool_selection_accuracy": round(tool_accuracy, 4),
            "safety_interception_rate": round(safety_rate, 4)
        },
        "retrieval_benchmarks": retrieval_results,
        "rag_benchmarks": rag_results,
        "tool_benchmarks": tool_results,
        "safety_benchmarks": safety_results
    }

    # Save to JSON artifact
    out_file = current_dir / "evaluation_report.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(aggregate_report, f, indent=2)

    print("===================================================================")
    print(f"  BENCHMARK SUITE COMPLETE in {duration:.2f}s — STATUS: {aggregate_report['overall_status']}")
    print(f"  Detailed metrics saved to: {out_file.name}")
    print("===================================================================\n")

    return aggregate_report


if __name__ == "__main__":
    report = asyncio.run(run_evaluation_suite())
    sys.exit(0 if report["overall_status"] == "PASSED" else 1)
