import hashlib
import logging
import math
import re
from abc import ABC, abstractmethod
from typing import List, Optional
import numpy as np

from core.config import settings

logger = logging.getLogger("intellicare.embedding")

class BaseEmbeddingService(ABC):
    """Abstract interface for embedding generation."""
    
    @abstractmethod
    async def embed_text(self, text: str) -> List[float]:
        """Embed a single string."""
        pass

    @abstractmethod
    async def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """Embed multiple strings."""
        pass

    @property
    @abstractmethod
    def dimension(self) -> int:
        pass


class LocalSemanticEmbeddingService(BaseEmbeddingService):
    """
    Deterministic, hermetic semantic embedding service.
    Tokenizes clean alphanumeric terms and n-grams into a unit-normalized dense vector space.
    Runs locally in microseconds without requiring network requests or external API keys.
    """

    def __init__(self, dim: int = 384):
        self._dim = dim

    @property
    def dimension(self) -> int:
        return self._dim

    def _embed_string_sync(self, text: str) -> List[float]:
        cleaned = text.lower()
        # Clean tokenization stripping punctuation
        tokens = [t for t in re.findall(r'[a-zA-Z0-9]+', cleaned) if len(t) >= 2]
        vec = np.zeros(self._dim, dtype=np.float32)

        if not tokens:
            vec[0] = 1.0
            return vec.tolist()

        # Word-level term weighting and hashing
        for token in tokens:
            h = int(hashlib.md5(token.encode("utf-8")).hexdigest(), 16)
            idx = h % self._dim
            sign = 1.0 if (h >> 8) % 2 == 0 else -1.0
            weight = 2.0 + (len(token) / 5.0)
            vec[idx] += sign * weight

            # Character tri-grams for subword matching
            if len(token) >= 3:
                for i in range(len(token) - 2):
                    trigram = token[i:i+3]
                    h_tri = int(hashlib.sha256(trigram.encode("utf-8")).hexdigest(), 16)
                    idx_tri = h_tri % self._dim
                    vec[idx_tri] += 0.8 * (1.0 if (h_tri >> 4) % 2 == 0 else -1.0)

        # Normalize to unit length (L2 norm)
        norm = np.linalg.norm(vec)
        if norm > 1e-6:
            vec = vec / norm
        else:
            vec[0] = 1.0
        return vec.tolist()

    async def embed_text(self, text: str) -> List[float]:
        return self._embed_string_sync(text)

    async def embed_batch(self, texts: List[str]) -> List[List[float]]:
        return [self._embed_string_sync(t) for t in texts]


class GeminiEmbeddingService(BaseEmbeddingService):
    """
    Google Gemini Embedding service using official SDK.
    Includes automatic fallback to LocalSemanticEmbeddingService if remote endpoint is unavailable.
    """

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or settings.effective_gemini_key
        from google import genai
        self._client = genai.Client(api_key=self.api_key)
        self.model_name = "text-embedding-004"
        self._fallback = LocalSemanticEmbeddingService(dim=768)

    @property
    def dimension(self) -> int:
        return 768

    async def embed_text(self, text: str) -> List[float]:
        batch = await self.embed_batch([text])
        return batch[0]

    async def embed_batch(self, texts: List[str]) -> List[List[float]]:
        if not texts:
            return []
        try:
            response = await self._client.aio.models.embed_content(
                model=self.model_name,
                contents=texts
            )
            embeddings = []
            for item in response.embeddings:
                embeddings.append(item.values)
            return embeddings
        except Exception as e:
            logger.warning("Gemini remote embedding unavailable (%s); falling back to local semantic embedder.", str(e))
            return await self._fallback.embed_batch(texts)


def get_embedding_service() -> BaseEmbeddingService:
    """Factory to retrieve appropriate embedding service."""
    if settings.effective_gemini_key and settings.LLM_PROVIDER != "mock":
        try:
            return GeminiEmbeddingService()
        except Exception:
            return LocalSemanticEmbeddingService()
    return LocalSemanticEmbeddingService()
