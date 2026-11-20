import time
import logging
from typing import List, Optional, Dict, Any
from pathlib import Path

from core.structured_schemas import RetrievedEvidence, KnowledgeRetrievalResponse
from rag.document_loader import DocumentLoader, DocumentChunk
from rag.embedding_service import BaseEmbeddingService, get_embedding_service
from rag.vector_store import VectorStore

logger = logging.getLogger("intellicare.retriever")

class ClinicalRetriever:
    """
    Orchestrates clinical document ingestion, query embedding, and semantic similarity search.
    Preserves document provenance, citations, and source references.
    """

    def __init__(
        self,
        loader: Optional[DocumentLoader] = None,
        embedding_service: Optional[BaseEmbeddingService] = None,
        vector_store: Optional[VectorStore] = None
    ):
        self.loader = loader or DocumentLoader(chunk_size=600, chunk_overlap=100)
        self.embedding_service = embedding_service or get_embedding_service()
        self.vector_store = vector_store or VectorStore()
        self._initialized = False

    async def ingest_directory(self, dir_path: str) -> int:
        """Ingests and indexes all approved clinical guidelines from directory."""
        chunks = self.loader.load_directory(dir_path)
        if not chunks:
            logger.warning("No documents found in directory: %s", dir_path)
            return 0

        logger.info("Generating embeddings for %d document chunks...", len(chunks))
        contents = [c.content for c in chunks]
        embeddings = await self.embedding_service.embed_batch(contents)
        
        indexed_count = self.vector_store.add_chunks(chunks, embeddings)
        self._initialized = True
        logger.info("Successfully indexed %d chunks in vector store.", indexed_count)
        return indexed_count

    async def search(
        self,
        query: str,
        top_k: int = 4,
        category_filter: Optional[str] = None,
        min_relevance: float = 0.40
    ) -> List[RetrievedEvidence]:
        """
        Retrieves top relevant evidence chunks for a query string.
        Filters out low-confidence results below min_relevance.
        """
        if not query or not query.strip():
            return []

        # Auto-ingest default reference docs if vector store is empty
        if self.vector_store.count() == 0:
            default_docs = Path(__file__).parent.parent / "data" / "reference_docs"
            if default_docs.exists():
                await self.ingest_directory(str(default_docs))

        # Generate query vector
        query_vector = await self.embedding_service.embed_text(query.strip())
        
        # Search vector store
        results = self.vector_store.search(
            query_embedding=query_vector,
            top_k=top_k,
            category_filter=category_filter
        )

        # Filter by threshold
        filtered = [r for r in results if r.relevance_score >= min_relevance]
        return filtered if filtered else results[:1]  # Return best match if all below threshold


# Global singleton instance
_retriever_instance: Optional[ClinicalRetriever] = None

def get_retriever() -> ClinicalRetriever:
    """Factory to retrieve global clinical retriever."""
    global _retriever_instance
    if _retriever_instance is None:
        _retriever_instance = ClinicalRetriever()
    return _retriever_instance
