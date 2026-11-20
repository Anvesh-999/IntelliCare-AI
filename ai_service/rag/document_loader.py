import os
import re
from typing import List, Dict, Any, Optional
from pathlib import Path
from pydantic import BaseModel, Field

class DocumentChunk(BaseModel):
    """Represents a clean, semantically meaningful slice of a clinical reference document."""
    chunk_id: str = Field(description="Unique identifier for the chunk, e.g., 'doc_c1'")
    document_id: str = Field(description="Parent document identifier")
    title: str = Field(description="Document or section title")
    content: str = Field(description="Clean text content of the chunk")
    category: str = Field(default="general", description="Clinical specialty: cardiology, hematology, etc.")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Metadata including file path, chunk index")

class DocumentLoader:
    """
    Ingests, cleans, and semantically chunks approved clinical reference documents (.txt, .md, .pdf).
    """

    def __init__(self, chunk_size: int = 600, chunk_overlap: int = 100):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

    def extract_text_from_file(self, file_path: str) -> str:
        """Extracts text from txt, md, or pdf files."""
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"Document file not found at: {file_path}")

        ext = path.suffix.lower()
        if ext in [".txt", ".md"]:
            with open(path, "r", encoding="utf-8", errors="ignore") as f:
                return f.read()
        elif ext == ".pdf":
            try:
                import pypdf
                reader = pypdf.PdfReader(str(path))
                text_parts = []
                for i, page in enumerate(reader.pages):
                    extracted = page.extract_text()
                    if extracted:
                        text_parts.append(extracted)
                return "\n".join(text_parts)
            except Exception as e:
                raise RuntimeError(f"Error reading PDF file {file_path}: {str(e)}")
        else:
            raise ValueError(f"Unsupported file format '{ext}'. Supported: .txt, .md, .pdf")

    def clean_text(self, text: str) -> str:
        """Normalizes whitespace and removes page artifact noise."""
        if not text:
            return ""
        # Replace non-breaking spaces
        text = text.replace("\u00a0", " ")
        # Standardize newlines
        text = text.replace("\r\n", "\n").replace("\r", "\n")
        # Collapse multi-newlines beyond 2
        text = re.sub(r'\n{3,}', '\n\n', text)
        # Collapse multiple spaces
        text = re.sub(r'[ \t]+', ' ', text)
        return text.strip()

    def chunk_text(
        self,
        text: str,
        document_id: str,
        title: str,
        category: str = "general",
        extra_metadata: Optional[Dict[str, Any]] = None
    ) -> List[DocumentChunk]:
        """
        Splits clean text into chunks, respecting natural paragraph and sentence boundaries.
        """
        cleaned = self.clean_text(text)
        if not cleaned:
            return []

        # Split initially by paragraph double-newlines
        paragraphs = [p.strip() for p in cleaned.split("\n\n") if p.strip()]
        chunks: List[DocumentChunk] = []
        current_chunk_text = ""
        chunk_idx = 0

        for p in paragraphs:
            # If paragraph itself is larger than chunk_size, split by sentences
            if len(p) > self.chunk_size:
                sentences = re.split(r'(?<=[.?!])\s+', p)
                for s in sentences:
                    if len(current_chunk_text) + len(s) + 1 <= self.chunk_size:
                        current_chunk_text = f"{current_chunk_text} {s}".strip() if current_chunk_text else s
                    else:
                        if current_chunk_text:
                            chunk_id = f"{document_id}_c{chunk_idx}"
                            meta = {"chunk_index": chunk_idx, **(extra_metadata or {})}
                            chunks.append(DocumentChunk(
                                chunk_id=chunk_id,
                                document_id=document_id,
                                title=title,
                                content=current_chunk_text,
                                category=category,
                                metadata=meta
                            ))
                            chunk_idx += 1
                        current_chunk_text = s
            else:
                if len(current_chunk_text) + len(p) + 2 <= self.chunk_size:
                    current_chunk_text = f"{current_chunk_text}\n\n{p}".strip() if current_chunk_text else p
                else:
                    if current_chunk_text:
                        chunk_id = f"{document_id}_c{chunk_idx}"
                        meta = {"chunk_index": chunk_idx, **(extra_metadata or {})}
                        chunks.append(DocumentChunk(
                            chunk_id=chunk_id,
                            document_id=document_id,
                            title=title,
                            content=current_chunk_text,
                            category=category,
                            metadata=meta
                        ))
                        chunk_idx += 1
                    current_chunk_text = p

        # Append trailing chunk
        if current_chunk_text:
            chunk_id = f"{document_id}_c{chunk_idx}"
            meta = {"chunk_index": chunk_idx, **(extra_metadata or {})}
            chunks.append(DocumentChunk(
                chunk_id=chunk_id,
                document_id=document_id,
                title=title,
                content=current_chunk_text,
                category=category,
                metadata=meta
            ))

        return chunks

    def load_directory(self, dir_path: str) -> List[DocumentChunk]:
        """Loads and chunks all approved reference documents from a directory."""
        directory = Path(dir_path)
        if not directory.exists() or not directory.is_dir():
            return []

        all_chunks: List[DocumentChunk] = []
        for file_path in directory.iterdir():
            if file_path.suffix.lower() in [".txt", ".md", ".pdf"]:
                try:
                    text = self.extract_text_from_file(str(file_path))
                    doc_id = file_path.stem
                    
                    # Extract title and category if specified in header
                    category = "general"
                    title = doc_id.replace("_", " ").title()
                    lines = text.splitlines()
                    for line in lines[:5]:
                        if line.startswith("Category:"):
                            category = line.split("Category:")[1].strip()
                        elif line.startswith("CLINICAL REFERENCE:"):
                            title = line.split("CLINICAL REFERENCE:")[1].strip()

                    chunks = self.chunk_text(
                        text=text,
                        document_id=doc_id,
                        title=title,
                        category=category,
                        extra_metadata={"source_file": file_path.name}
                    )
                    all_chunks.extend(chunks)
                except Exception as e:
                    print(f"[DocumentLoader] Error loading {file_path}: {e}")

        return all_chunks
