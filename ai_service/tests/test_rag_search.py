import pytest
import numpy as np
from pathlib import Path
from fastapi.testclient import TestClient

from main import app
from rag.document_loader import DocumentLoader, DocumentChunk
from rag.embedding_service import LocalSemanticEmbeddingService
from rag.vector_store import VectorStore
from rag.retriever import ClinicalRetriever

client = TestClient(app)

# 1. Test DocumentLoader
def test_document_loader_chunking():
    loader = DocumentLoader(chunk_size=150, chunk_overlap=30)
    sample_text = (
        "Hypertension is a chronic medical condition where arterial pressure is elevated.\n\n"
        "Stage 1 hypertension is defined as systolic BP between 130 and 139 mm Hg.\n\n"
        "Stage 2 hypertension is systolic 140 mm Hg or higher, requiring multi-drug therapy."
    )
    chunks = loader.chunk_text(
        text=sample_text,
        document_id="doc_test_1",
        title="Hypertension Summary",
        category="cardiology"
    )
    assert len(chunks) >= 2
    for c in chunks:
        assert c.document_id == "doc_test_1"
        assert c.category == "cardiology"
        assert len(c.content) <= 300

def test_document_loader_cleaning():
    loader = DocumentLoader()
    dirty_text = "Clinical   Data\r\n\r\n\r\nPatient\u00a0has\t\t elevated sugar."
    cleaned = loader.clean_text(dirty_text)
    assert "\u00a0" not in cleaned
    assert "\r" not in cleaned
    assert "   " not in cleaned
    assert "Patient has elevated sugar." in cleaned

# 2. Test Local Semantic Embedding Service
@pytest.mark.asyncio
async def test_local_embedding_service_unit_norm():
    embedder = LocalSemanticEmbeddingService(dim=384)
    v1 = await embedder.embed_text("Blood pressure reading 140/90")
    assert len(v1) == 384
    norm = np.linalg.norm(np.array(v1))
    assert abs(norm - 1.0) < 1e-4

@pytest.mark.asyncio
async def test_local_embedding_similarity():
    embedder = LocalSemanticEmbeddingService(dim=384)
    v_hp1 = np.array(await embedder.embed_text("hypertension high blood pressure systolic"))
    v_hp2 = np.array(await embedder.embed_text("elevated blood pressure readings arterial"))
    v_ortho = np.array(await embedder.embed_text("fractured tibia bone cast orthopedic"))

    sim_related = float(np.dot(v_hp1, v_hp2))
    sim_unrelated = float(np.dot(v_hp1, v_ortho))
    assert sim_related > sim_unrelated

# 3. Test Vector Store CRUD and Search
def test_vector_store_add_search_delete(tmp_path):
    store = VectorStore(persist_directory=str(tmp_path / "test_chroma"), collection_name="test_col")
    
    chunk1 = DocumentChunk(
        chunk_id="chunk_1",
        document_id="doc_cardio",
        title="Hypertension Reference",
        content="Stage 1 hypertension is defined as systolic BP 130-139 mmHg.",
        category="cardiology"
    )
    chunk2 = DocumentChunk(
        chunk_id="chunk_2",
        document_id="doc_endo",
        title="Diabetes Reference",
        content="Type 2 diabetes diagnostic threshold is HbA1c 6.5% or higher.",
        category="endocrinology"
    )

    vec1 = [1.0] + [0.0] * 383
    vec2 = [0.0, 1.0] + [0.0] * 382

    store.add_chunks([chunk1, chunk2], [vec1, vec2])
    assert store.count() == 2

    # Search for vector close to vec1
    query_vec = [0.9] + [0.1] * 383
    results = store.search(query_vec, top_k=1)
    assert len(results) == 1
    assert results[0].document_id == "doc_cardio"

    # Delete doc_cardio
    deleted = store.delete_document("doc_cardio")
    assert deleted == 1
    assert store.count() == 1

# 4. Test Clinical Retriever with Approved Medical Knowledge
@pytest.mark.asyncio
async def test_retriever_multi_query_search():
    retriever = ClinicalRetriever(
        embedding_service=LocalSemanticEmbeddingService(dim=384)
    )
    docs_dir = Path(__file__).parent.parent / "data" / "reference_docs"
    count = await retriever.ingest_directory(str(docs_dir))
    assert count > 0

    # Test Query 1: Hypertension staging
    q1_results = await retriever.search("What is Stage 1 hypertension blood pressure range?")
    assert len(q1_results) > 0
    assert any("hypertension" in r.excerpt.lower() for r in q1_results)
    assert q1_results[0].relevance_score > 0.40

    # Test Query 2: Diabetes HbA1c
    q2_results = await retriever.search("What is the HbA1c cutoff for diagnosing diabetes?")
    assert len(q2_results) > 0
    assert any("hba1c" in r.excerpt.lower() or "glucose" in r.excerpt.lower() for r in q2_results)

    # Test Query 3: Cholesterol lipid targets
    q3_results = await retriever.search("What are normal LDL and HDL cholesterol targets?")
    assert len(q3_results) > 0
    assert any("cholesterol" in r.excerpt.lower() or "ldl" in r.excerpt.lower() for r in q3_results)

    # Test Query 4: Emergency chest pain
    q4_results = await retriever.search("Crushing chest pain radiating to arm symptoms")
    assert len(q4_results) > 0
    assert any("emergency" in r.excerpt.lower() or "chest" in r.excerpt.lower() for r in q4_results)

# 5. Test API Endpoint /ai/search
def test_api_search_endpoint():
    payload = {
        "query": "What are blood pressure ranges for Stage 1 hypertension?",
        "top_k": 3
    }
    response = client.post("/ai/search", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["total_results"] > 0
    assert data["has_sufficient_context"] is True
    assert "execution_time_ms" in data
    assert len(data["results"]) <= 3
    assert "document_id" in data["results"][0]
    assert "excerpt" in data["results"][0]

def test_api_search_rejects_empty():
    response = client.post("/ai/search", json={"query": "   "})
    assert response.status_code == 422
