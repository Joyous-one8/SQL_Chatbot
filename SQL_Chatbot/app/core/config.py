from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

class Settings(BaseSettings):
    """
    App configuration schema.
    Loads variables from local environment or .env file automatically.
    """
    # Database Configurations
    DB_SERVER: str = Field(default="localhost", description="MS SQL Server Host")
    DB_NAME: str = Field(default="AdventureWorks2022", description="Target Database")
    DB_DRIVER: str = Field(default="ODBC Driver 17 for SQL Server", description="Native ODBC Driver")
    
    # LLM Security
    GEMINI_API_KEY: str = Field(..., description="Google Gemini API Key - Required")
    GEMINI_MODEL: str = Field(default="gemini-3.5-flash", description="Cost-efficient production LLM")

    @property
    def database_url(self) -> str:
        """Dynamically builds the SQLAlchemy connection string for MS SQL."""
        import urllib
        # Using a quoted string makes instance paths like KANISHKA\SQLEXPRESS completely safe for pyodbc
        params = urllib.parse.quote_plus(
            f"DRIVER={self.DB_DRIVER};"
            f"SERVER={self.DB_SERVER};"
            f"DATABASE={self.DB_NAME};"
            f"Trusted_Connection=yes;"
        )
        return f"mssql+pyodbc:///?odbc_connect={params}"

    # Read .env file if it exists
    model_config = SettingsConfigDict(
        env_file=".env", 
        env_file_encoding="utf-8", 
        extra="ignore"
    )

# Global configuration instance (Singleton pattern)
settings = Settings()