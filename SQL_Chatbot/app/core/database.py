import logging
from sqlalchemy import create_engine
from langchain_community.utilities import SQLDatabase
from app.core.config import settings

logger = logging.getLogger("app.core.database")

class DatabaseManager:
    """
    Handles pooling and secure connections to Microsoft SQL Server.
    Restricts context to target tables to reduce system prompt token consumption.
    """
    def __init__(self):
        self.connection_string = settings.database_url
        
        # Define target tables for high-efficiency prompt limits (under 10 tables)
        self.target_tables = [
            "Employee", 
            "Department", 
            "JobCandidate", 
            "EmployeePayHistory",
            "Shift",
            "EmployeeDepartmentHistory"
        ]
        
        try:
            logger.info("Initializing Microsoft SQL Server database pool...")
            # Thread-safe connection pool parameters
            self.engine = create_engine(
                self.connection_string,
                pool_size=5,          # Maintain up to 5 persistent connections
                max_overflow=10,      # Allow up to 10 burst connections under heavy load
                pool_timeout=30,      # Terminate thread waiting for a connection after 30s
                pool_recycle=1800     # Reset connections older than 30 mins to avoid staleness
            )
            
            # Map the database schemas to LangChain utilities
            self.db = SQLDatabase(
                self.engine, 
                schema="HumanResources",
                include_tables=self.target_tables,
                sample_rows_in_table_info=2  # Optimize token budget
            )
            logger.info("Database connection pool established successfully.")
            
        except Exception as e:
            logger.critical(f"Failed to initialize MS SQL connection pool: {str(e)}")
            raise e

    def get_db(self) -> SQLDatabase:
        """Returns the active LangChain SQLDatabase interface."""
        return self.db

# Global Database Singleton
db_manager = DatabaseManager()