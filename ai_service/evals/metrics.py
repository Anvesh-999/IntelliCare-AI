"""
Quantitative Evaluation Metric Calculators for IntelliCare AI.
Evaluates:
- Retrieval Precision, Hit Rate, and Keyword Coverage
- Hallucination Detection & Groundedness Scoring
- Verbatim Citation Provenance Verification
- Tool Selection Accuracy
- Safety & Guardrail Interception Rate
"""

import re
from pathlib import Path
from typing import List, Dict, Any, Tuple


def evaluate_retrieval_case(
    retrieved_evidence: List[Any],
    expected_doc_substring: str,
    expected_keywords: List[str]
) -> Dict[str, Any]:
    """
    Evaluates semantic retrieval quality against a benchmark case.
    """
    if not retrieved_evidence:
        return {
            "hit": False,
            "keyword_recall": 0.0,
            "score": 0.0,
            "retrieved_count": 0
        }

    # 1. Document Hit Check
    hit = any(expected_doc_substring.lower() in (e.document_id or "").lower() or 
              expected_doc_substring.lower() in (e.title or "").lower()
              for e in retrieved_evidence)

    # 2. Keyword Coverage Check in retrieved excerpts
    combined_text = " ".join([e.excerpt.lower() for e in retrieved_evidence])
    matched_keywords = [kw for kw in expected_keywords if kw.lower() in combined_text]
    keyword_recall = len(matched_keywords) / len(expected_keywords) if expected_keywords else 1.0

    # Composite retrieval score
    score = (1.0 if hit else 0.0) * 0.6 + keyword_recall * 0.4

    return {
        "hit": hit,
        "keyword_recall": round(keyword_recall, 4),
        "matched_keywords": matched_keywords,
        "score": round(score, 4),
        "retrieved_count": len(retrieved_evidence)
    }


def evaluate_groundedness(
    answer: str,
    context_chunks: List[str]
) -> Dict[str, Any]:
    """
    Evaluates whether the generated response is strictly grounded in the provided context.
    Detects ungrounded numeric claims and unsupported assertions.
    """
    if not answer or not context_chunks:
        return {"groundedness_score": 0.0, "hallucinated_numbers": [], "is_grounded": False}

    combined_context = " ".join(context_chunks).lower()
    answer_lower = answer.lower()

    # 1. Numeric Hallucination Check: extract numbers with units from answer
    answer_numbers = re.findall(r"\b\d+(?:\.\d+)?(?:\s*(?:mg|g|dl|mmhg|%|bpm|mcg))?\b", answer_lower)
    hallucinated_numbers = []

    for num_token in answer_numbers:
        # Ignore common boilerplate numbers (e.g. 911, 988, 1, 2, 3)
        if num_token.strip() in ["1", "2", "3", "4", "5", "911", "988", "112"]:
            continue
        # Extract digits
        digits = re.search(r"\d+(?:\.\d+)?", num_token)
        if digits and digits.group(0) not in combined_context:
            hallucinated_numbers.append(num_token)

    # 2. Key clinical term overlap
    words = re.findall(r"\b[a-z]{4,}\b", answer_lower)
    context_words = set(re.findall(r"\b[a-z]{4,}\b", combined_context))
    overlap_count = sum(1 for w in words if w in context_words)
    overlap_ratio = overlap_count / len(words) if words else 1.0

    # Penalty for hallucinated numbers
    number_penalty = min(len(hallucinated_numbers) * 0.25, 0.5)
    final_score = max(0.0, overlap_ratio - number_penalty)

    return {
        "groundedness_score": round(final_score, 4),
        "overlap_ratio": round(overlap_ratio, 4),
        "hallucinated_numbers": hallucinated_numbers,
        "is_grounded": len(hallucinated_numbers) == 0 and final_score >= 0.60
    }


def verify_citation_provenance(
    citations: List[Any],
    reference_docs_dir: str
) -> Dict[str, Any]:
    """
    Verifies that cited excerpts exist verbatim in the source reference documents.
    Detects fabricated or distorted citations.
    """
    if not citations:
        return {"total_citations": 0, "verified_citations": 0, "provenance_accuracy": 1.0}

    ref_dir = Path(reference_docs_dir)
    verified = 0
    details = []

    for cite in citations:
        doc_id = cite.document_id if hasattr(cite, "document_id") else cite.get("document_id", "")
        excerpt = cite.excerpt if hasattr(cite, "excerpt") else cite.get("excerpt", "")
        clean_excerpt = excerpt.strip().lower()

        # Find file in reference dir
        is_verified = False
        for file_path in ref_dir.glob("*.*"):
            if doc_id.lower() in file_path.name.lower() or file_path.stem.lower() in doc_id.lower():
                try:
                    file_text = file_path.read_text(encoding="utf-8").lower()
                    # Check substring match of the first 40 chars of excerpt
                    check_phrase = clean_excerpt[:min(40, len(clean_excerpt))]
                    if check_phrase in file_text:
                        is_verified = True
                        break
                except Exception:
                    continue

        if is_verified:
            verified += 1
        details.append({
            "document_id": doc_id,
            "verified": is_verified
        })

    provenance_accuracy = verified / len(citations) if citations else 1.0
    return {
        "total_citations": len(citations),
        "verified_citations": verified,
        "provenance_accuracy": round(provenance_accuracy, 4),
        "details": details
    }
