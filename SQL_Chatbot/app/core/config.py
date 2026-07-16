from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field
from sqlalchemy.engine import URL


class Settings(BaseSettings):
    """
    App configuration schema.
    Loads variables from local environment or .env file automatically.
    """
    # Database Server Configurations
    # IMPORTANT: DB_SERVER must be ONLY the hostname — no port, no "tcp:" prefix,
    # e.g. "sql-chatbot.database.windows.net". Port is handled separately below.
    DB_SERVER: str = Field(..., description="Azure SQL Server Host (e.g., your-server.database.windows.net)")
    DB_PORT: int = Field(default=1433, description="Azure SQL Server port (default 1433)")
    DB_NAME: str = Field(default="AdventureWorks", description="Target Database")

    # Database Security (Azure SQL Authentication)
    DB_USERNAME: str = Field(..., description="Azure SQL Server Admin/User Username")
    DB_PASSWORD: str = Field(..., description="Azure SQL Server User Password")

    # LLM Security
    GEMINI_API_KEY: str = Field(..., description="Google Gemini API Key - Required")
    GEMINI_MODEL: str = Field(default="gemini-3.5-flash", description="Cost-efficient production LLM")

    @property
    def database_url(self) -> str:
        """
        Builds the SQLAlchemy connection URL for Azure SQL Server using pymssql
        (bundles FreeTDS — no ODBC driver installation required).

        Uses SQLAlchemy's URL.create() rather than manual string formatting, so
        special characters in the username/password (e.g. '@', ':', '/') are
        encoded correctly and can never produce a malformed authority section —
        this is what was causing the "invalid literal for int()" parsing error.
        """
        url = URL.create(
            drivername="mssql+pymssql",
            username=self.DB_USERNAME,
            password=self.DB_PASSWORD,  # URL.create() encodes this internally; do not pre-encode it yourself
            host=self.DB_SERVER,
            port=self.DB_PORT,
            database=self.DB_NAME,
        )
        return str(url)

    # Read .env file if it exists
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


# Global configuration instance (Singleton pattern)
settings = Settings()