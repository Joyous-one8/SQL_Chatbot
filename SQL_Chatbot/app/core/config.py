import urllib.parse
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

class Settings(BaseSettings):
    """
    App configuration schema.
    Loads variables from local environment or .env file automatically.
    """
    # Database Server Configurations
    DB_SERVER: str = Field(..., description="Azure SQL Server Host (e.g., your-server.database.windows.net)")
    DB_NAME: str = Field(default="AdventureWorks", description="Target Database")
    DB_DRIVER: str = Field(default="ODBC Driver 17 for SQL Server", description="Native ODBC Driver")
    
    # Database Security (Added for Azure Authentication)
    DB_USERNAME: str = Field(..., description="Azure SQL Server Admin/User Username")
    DB_PASSWORD: str = Field(..., description="Azure SQL Server User Password")
    
    # LLM Security
    GEMINI_API_KEY: str = Field(..., description="Google Gemini API Key - Required")
    GEMINI_MODEL: str = Field(default="gemini-3.5-flash", description="Cost-efficient production LLM")

    @property
    def database_url(self) -> str:
        """
        Dynamically builds the SQLAlchemy connection string for Azure SQL Server
        using SQL Server Authentication.
        """
        # Drop 'Trusted_Connection' and supply UID/PWD parameters for Azure authentication
        connection_string = (
            f"DRIVER={self.DB_DRIVER};"
            f"SERVER={self.DB_SERVER};"
            f"DATABASE={self.DB_NAME};"
            f"UID={self.DB_USERNAME};"
            f"PWD={self.DB_PASSWORD};"
            f"Encrypt=yes;"                  # Encrypt connection to protect transit data
            f"TrustServerCertificate=no;"    # Use default secure trust rules
            f"Connection Timeout=30;"
        )
        
        # Quote only the password to protect it if it has special characters (like '@' or '/')
        safe_password = urllib.parse.quote_plus(self.DB_PASSWORD)

        # Return the clean pymssql URL
        return f"mssql+pymssql://{self.DB_USERNAME}:{safe_password}@{self.DB_SERVER}/{self.DB_NAME}"

    # Read .env file if it exists
    model_config = SettingsConfigDict(
        env_file=".env", 
        env_file_encoding="utf-8", 
        extra="ignore"
    )

# Global configuration instance (Singleton pattern)
settings = Settings()