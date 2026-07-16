# app/main.py
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.endpoints import router as chat_router

# Setup structured logging to display execution information on the server console
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger("app.main")

app = FastAPI(
    title="Enterprise Text-to-SQL HR Chatbot",
    description=(
        "A highly-optimized RAG engine that queries a Microsoft SQL Server database "
        "using Gemini 1.5 and LangChain."
    ),
    version="1.0.0"
)

# ==========================================
# CORS MIDDLEWARE SETUP
# ==========================================
# Allows your React, Vue, or vanilla frontend to communicate with this API smoothly
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust this to specific URLs (e.g., ["http://localhost:5173"]) in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================
# LIFECYCLE ROUTING
# ==========================================
# Include the chat router we wrote under /api
app.include_router(chat_router, prefix="/api/v1")

@app.get("/", tags=["Health Check"])
async def root_health_check():
    """Simple status check to verify the server is running."""
    return {
        "app": "Enterprise Text-to-SQL HR Chatbot API",
        "status": "healthy",
        "version": "1.0.0"
    }

if __name__ == "__main__":
    import uvicorn
    # Start the ASGI server locally
    logger.info("Launching FastAPI Development Server...")
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)