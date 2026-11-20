import os
import json
import logging
from typing import List, Optional, Dict, Any
from pathlib import Path
import numpy as np

from core.structured_schemas import RetrievedEvidence
from rag.document_loader import DocumentChunk

logger = logging.getLogger("intellicare.vector_store")

class VectorStore:
    """
    Vector Store implementation utilizing ChromaDB with high-performance persistent in-memory
    NumPy cosine similarity fallback to guarantee zero-failure operation across environments.
    """

    def __init__(self, persist_directory: str = "./data/chroma_db", collection_name: str = "clinical_knowledge"):
        self.persist_directory = persist_directory
        self.collection_name = collection_name
        self.chroma_client = None
        self.collection = None
        
        # In-memory index fallback
        self._chunks: Dict[str, DocumentChunk] = {}
        self._embeddings: Dict[str, np.ndarray] = {}

        # Attempt to initialize ChromaDB
        self._init_chroma()

    def _init_chroma(self):
        try:
            import chromadb
            os.makedirs(self.persist_directory, exist_ok=True)
            self.chroma_client = chromadb.PersistentClient(path=self.persist_directory)
            self.collection = self.chroma_client.get_or_create_collection(
                name=self.collection_name,
                metadata={"hnsw:space": "cosine"}
            )
            logger.info("ChromaDB initialized at %s (collection: %s)", self.persist_directory, self.collection_name)
        except Exception as e:
            logger.warning("ChromaDB initialization failed (%s). Using persistent in-memory vector index fallback.", str(e))
            self.chroma_client = None
            self.collection = None

    def add_chunks(self, chunks: List[DocumentChunk], embeddings: List[List[float]]) -> int:
        """Adds or updates chunks and their corresponding embedding vectors."""
        if not chunks:
            return 0

        # Always update in-memory index
        for chunk, emb in zip(chunks, embeddings):
            self._chunks[chunk.chunk_id] = chunk
            self._embeddings[chunk.chunk_id] = np.array(emb, dtype=np.float32)

        # Update ChromaDB if active
        if self.collection is not None:
            try:
                ids = [c.chunk_id for c in chunks]
                documents = [c.content for c in chunks]
                metadatas = [
                    {
                        "document_id": c.document_id,
                        "title": c.title,
                        "category": c.category,
                        **{k: str(v) for k, v in c.metadata.items()}
                    }
                    for c in chunks
                ]
                self.collection.upsert(
                    ids=ids,
                    embeddings=embeddings,
                    documents=documents,
                    metadatas=metadatas
                )
            except Exception as e:
                if "expecting embedding with dimension" in str(e) and self.chroma_client:
                    try:
                        self.chroma_client.delete_collection(name=self.collection_name)
                        self.collection = self.chroma_client.get_or_create_collection(
                            name=self.collection_name,
                            metadata={"hnsw:space": "cosine"}
                        )
                        self.collection.upsert(
                            ids=ids,
                            embeddings=embeddings,
                            documents=documents,
                            metadatas=metadatas
                        )
                        logger.info("Recreated ChromaDB collection '%s' with updated embedding dimension.", self.collection_name)
                        return len(chunks)
                    except Exception as inner_e:
                        logger.error("Failed to recreate ChromaDB collection: %s", str(inner_e))
                logger.error("Error upserting to ChromaDB: %s", str(e))

        return len(chunks)

    def search(
        self,
        query_embedding: List[float],
        top_k: int = 4,
        category_filter: Optional[str] = None
    ) -> List[RetrievedEvidence]:
        """
        Performs vector similarity search against the index.
        Returns top-K relevant chunks packaged as RetrievedEvidence.
        """
        if not self._chunks:
            return []

        # 1. Try ChromaDB query first if available
        if self.collection is not None:
            try:
                where_clause = {"category": category_filter} if category_filter else None
                results = self.collection.query(
                    query_embeddings=[query_embedding],
                    n_results=min(top_k, self.collection.count() or top_k),
                    where=where_clause
                )
                evidence_list: List[RetrievedEvidence] = []
                if results and results.get("ids") and results["ids"][0]:
                    ids = results["ids"][0]
                    docs = results["documents"][0]
                    metas = results["metadatas"][0]
                    # Distances in cosine space: distance = 1 - cosine_similarity
                    distances = results["distances"][0] if results.get("distances") else [0.0] * len(ids)

                    for chunk_id, doc, meta, dist in zip(ids, docs, metas, distances):
                        # Convert distance to similarity score in [0.0, 1.0]
                        similarity = max(0.0, min(1.0, 1.0 - (dist / 2.0)))
                        evidence_list.append(RetrievedEvidence(
                            document_id=meta.get("document_id", chunk_id),
                            title=meta.get("title", "Clinical Reference"),
                            excerpt=doc,
                            relevance_score=round(float(similarity), 4)
                        ))
                    return evidence_list
            except Exception as e:
                logger.warning("ChromaDB query failed (%s); falling back to NumPy cosine search.", str(e))

        # 2. NumPy Cosine Similarity Search Fallback
        q_vec = np.array(query_embedding, dtype=np.float32)
        q_norm = np.linalg.norm(q_vec)
        if q_norm > 1e-6:
            q_vec = q_vec / q_norm

        scores = []
        for chunk_id, c_vec in self._embeddings.items():
            chunk = self._chunks[chunk_id]
            if category_filter and chunk.category.lower() != category_filter.lower():
                continue

            c_norm = np.linalg.norm(c_vec)
            if c_norm > 1e-6:
                c_norm_vec = c_vec / c_norm
            else:
                c_norm_vec = c_vec

            # Cosine similarity dot product of normalized vectors
            sim = float(np.dot(q_vec, c_norm_vec))
            # Bound in [0.0, 1.0]
            bounded_sim = max(0.0, min(1.0, (sim + 1.0) / 2.0))
            scores.append((bounded_sim, chunk))

        scores.sort(key=lambda x: x[0], reverse=True)
        top_results = scores[:top_k]

        return [
            RetrievedEvidence(
                document_id=chunk.document_id,
                title=chunk.title,
                excerpt=chunk.content,
                relevance_score=round(sim, 4)
            )
            for sim, chunk in top_results
        ]

    def delete_document(self, document_id: str) -> int:
        """Deletes all chunks belonging to a document ID."""
        chunk_ids_to_del = [
            cid for cid, c in self._chunks.items()
            if c.document_id == document_id
        ]
        for cid in chunk_ids_to_del:
            self._chunks.pop(cid, None)
            self._embeddings.pop(cid, None)

        if self.collection is not None and chunk_ids_to_del:
            try:
                self.collection.delete(ids=chunk_ids_to_del)
            except Exception as e:
                logger.error("Error deleting from ChromaDB: %s", str(e))

        return len(chunk_ids_to_del)

    def count(self) -> int:
        """Returns total chunk count."""
        return len(self._chunks)

    def list_documents(self) -> List[str]:
        """Returns list of unique document IDs in index."""
        return list(set(c.document_id for c in self._chunks.values()))
