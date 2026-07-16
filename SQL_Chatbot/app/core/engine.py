# app/core/engine.py
import logging
from langchain_google_genai import ChatGoogleGenerativeAI
from app.core.config import settings

logger = logging.getLogger("app.core.engine")

class LLMEngine:
    """
    Manages LLM instances, configurations, and core parameters.
    Ensures strict determinism for code/SQL generation by defaulting temperature to 0.0.
    """
    def __init__(self):
        logger.info(f"Initializing Gemini Client using model: {settings.GEMINI_MODEL}")
        
        # We target temperature=0.0 to prevent creative hallucinations in SQL output
        self.llm = ChatGoogleGenerativeAI(
            model=settings.GEMINI_MODEL,
            google_api_key=settings.GEMINI_API_KEY,
            temperature=0.0
        )

    def get_llm(self) -> ChatGoogleGenerativeAI:
        """Returns the configured LangChain LLM instance."""
        return self.llm

# Global AI Engine Singleton
ai_engine = LLMEngine()