import logging
import time
from typing import Dict, Any, List

from sqlalchemy import text

from langchain_core.prompts import PromptTemplate
from langchain_classic.chains import create_sql_query_chain
from langchain_core.output_parsers import StrOutputParser

from app.core.database import db_manager, DatabaseManager
from app.core.engine import ai_engine, LLMEngine

logger = logging.getLogger("app.core.pipeline")

# Rows at or below this count get a full natural-language answer with data inlined.
# Above this, the LLM only writes a short summary; the raw rows are returned
# separately so the frontend can render them as a table.
SMALL_RESULT_THRESHOLD = 15

FORBIDDEN_SQL_KEYWORDS = (
    "insert", "update", "delete", "drop", "alter",
    "truncate", "exec", "execute", "merge", "grant", "revoke",
)


class SQLChatPipeline:
    """
    OOP orchestrator that translates natural language questions into executable
    Microsoft SQL Server T-SQL, runs the query securely, and formats a human response.
    """

    def __init__(self, db_sys: DatabaseManager, ai_sys: LLMEngine):
        self.db = db_sys.get_db()
        self.llm = ai_sys.get_llm()
        self._build_pipeline()
        logger.info("SQL Chat Pipeline successfully constructed.")

    # ------------------------------------------------------------------ #
    # Pipeline construction
    # ------------------------------------------------------------------ #
    def _build_pipeline(self):
        """Assembles internal chains. Each stage is invoked explicitly in `ask()`
        rather than chained end-to-end, so we generate SQL exactly once per request
        and can inspect/validate intermediate results."""

        # 1. Custom prompt with relationship rules & few-shot examples
        custom_sql_prompt = PromptTemplate.from_template(
            """You are an expert T-SQL developer mapping natural language questions to database queries.
            Given an input question, create a syntactically correct {dialect} query to run.

            Core Relational Rules (CRITICAL):
            - When the user asks for "employees", "people", "staff", or "managers", you MUST join [HumanResources].[Employee] with [Person].[Person] on BusinessEntityID to retrieve FirstName and LastName.
            - Always select FirstName, LastName, and JobTitle for employee questions unless the user asks for something more specific. Never return only ID/NationalIDNumber columns.
            - To include Email Addresses, join [Person].[EmailAddress] on BusinessEntityID.
            - To include Departments, join [HumanResources].[EmployeeDepartmentHistory] (filter EndDate IS NULL for current department) and [HumanResources].[Department] on DepartmentID.
            - Calculate age dynamically using: DATEDIFF(year, BirthDate, GETDATE()) AS Age.
            - For "birthday next week" / "birthday this month" style questions, compare month/day only (ignore year) — do NOT use DATEDIFF(year, ...) for these, since that computes age, not the birthday's calendar position.
            - Do NOT wrap your output in markdown code blocks (e.g., do not use ```sql or ```).
            - Do NOT limit the number of rows unless the user explicitly asks for a limit (e.g., do NOT append TOP {top_k}). Ignore the default restriction.
            - Only ever write a single SELECT statement. Never write INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, EXEC, or MERGE.

            Few-Shot Examples for Path Mapping:

            Question: "List all employees older than 40"
            SQLQuery:
            SELECT
                p.FirstName,
                p.LastName,
                e.JobTitle,
                DATEDIFF(year, e.BirthDate, GETDATE()) AS Age,
                ea.EmailAddress
            FROM HumanResources.Employee e
            INNER JOIN Person.Person p ON e.BusinessEntityID = p.BusinessEntityID
            LEFT JOIN Person.EmailAddress ea ON e.BusinessEntityID = ea.BusinessEntityID
            WHERE DATEDIFF(year, e.BirthDate, GETDATE()) > 40;

            Question: "Who works in the Marketing department?"
            SQLQuery:
            SELECT
                p.FirstName,
                p.LastName,
                d.Name AS Department
            FROM HumanResources.Employee e
            INNER JOIN Person.Person p ON e.BusinessEntityID = p.BusinessEntityID
            INNER JOIN HumanResources.EmployeeDepartmentHistory edh ON e.BusinessEntityID = edh.BusinessEntityID AND edh.EndDate IS NULL
            INNER JOIN HumanResources.Department d ON edh.DepartmentID = d.DepartmentID
            WHERE d.Name = 'Marketing';

            Question: "Which employees have a birthday next week?"
            SQLQuery:
            SELECT
                p.FirstName,
                p.LastName,
                e.BirthDate
            FROM HumanResources.Employee e
            INNER JOIN Person.Person p ON e.BusinessEntityID = p.BusinessEntityID
            WHERE DATEPART(dayofyear, DATEADD(year, DATEDIFF(year, e.BirthDate, GETDATE()), e.BirthDate))
                BETWEEN DATEPART(dayofyear, GETDATE()) + 1 AND DATEPART(dayofyear, GETDATE()) + 7;

            Question: "How long has each employee been with the company?"
            SQLQuery:
            SELECT
                p.FirstName,
                p.LastName,
                e.HireDate,
                DATEDIFF(year, e.HireDate, GETDATE()) AS YearsOfService
            FROM HumanResources.Employee e
            INNER JOIN Person.Person p ON e.BusinessEntityID = p.BusinessEntityID
            ORDER BY YearsOfService DESC;

            Table Information:
            {table_info}

            Question: {input}
            SQLQuery:"""
                    )

        # 2. Translate natural language into T-SQL. temperature=0 for determinism.
        sql_llm = self.llm.bind(temperature=0)
        raw_sql_chain = create_sql_query_chain(sql_llm, self.db, prompt=custom_sql_prompt)

        def clean_sql_output(sql_string: str) -> str:
            cleaned = sql_string.replace("```sql", "").replace("```", "")
            return cleaned.strip()

        def validate_select_only(sql_string: str) -> str:
            lowered = sql_string.lower()
            if any(kw in lowered for kw in FORBIDDEN_SQL_KEYWORDS):
                raise ValueError(
                    f"Generated SQL failed safety validation (forbidden keyword detected): {sql_string}"
                )
            if not lowered.strip().startswith("select") and not lowered.strip().startswith("with"):
                raise ValueError(f"Generated SQL is not a SELECT statement: {sql_string}")
            return sql_string

        self.write_query_chain = raw_sql_chain | clean_sql_output | validate_select_only

        # 3. Answer synthesis prompt. Used differently depending on result size (see ask()).
        self.answer_prompt = PromptTemplate.from_template(
                """You are a professional database assistant for human resources.
            Given an input user question, the generated T-SQL query, and the SQL results,
            write ONE short, natural paragraph (2-4 sentences) answering the question directly.

            Do NOT format your answer as a bullet list of individual records with sub-fields
            (e.g. do not write "Name — Job Title — Email" per person). The underlying data will
            already be displayed separately as a table — your job is to summarize, not repeat it
            field-by-field. Mention the total count, and if useful, one or two standout details
            (e.g. oldest/youngest, most common job title, notable name) in plain sentence form.

            If the question used a subjective or domain-ambiguous term (e.g. "best", "important",
            "underperforming"), state what you interpreted it as, in the same natural paragraph —
            even if the result set is empty.

            Question: {question}
            SQL Query: {query}
            SQL Result: {result}
            Answer:"""
        )
        self.answer_chain = self.answer_prompt | self.llm | StrOutputParser()
    # ------------------------------------------------------------------ #
    # Conversational context helper
    # ------------------------------------------------------------------ #
    def _build_contextual_question(self, user_question: str, history: List[Dict[str, str]]) -> str:
        """Builds the string fed to the SQL-generation chain. If there is a previous
        turn, prepend a short context block (previous question + previous SQL) so the
        model can resolve references like "their", "that list", "narrow it down".
        Only the single most recent turn is used deliberately — this is scoped,
        per-turn context, not open-ended conversational memory. Keeping it to one
        turn avoids ambiguity compounding across a longer chat history, which matters
        for a tool whose whole job is producing one correct, auditable SQL statement."""
        if not history:
            return user_question
 
        last_turn = history[-1]
        context_block = (
            f'Conversation context:\n'
            f'Previous question: "{last_turn.get("question", "")}"\n'
            f'Previous SQL query: {last_turn.get("sql", "")}\n\n'
            f'Current question: {user_question}'
        )
        return context_block
    # ------------------------------------------------------------------ #
    # Execution helpers
    # ------------------------------------------------------------------ #
    def _run_query_as_dicts(self, sql: str) -> List[Dict[str, Any]]:
        """Executes SQL directly via SQLAlchemy so every row comes back labeled
        with its column name, instead of the unlabeled tuples that
        QuerySQLDataBaseTool's string output produces."""
        engine = self.db._engine
        with engine.connect() as conn:
            result = conn.execute(text(sql))
            columns = list(result.keys())
            rows = [dict(zip(columns, row)) for row in result.fetchall()]
        return rows

    def _format_answer(self, question: str, query: str, rows: List[Dict[str, Any]]) -> Dict[str, Any]:
        count = len(rows)

        if count == 0:
            return {
                "mode": "text",
                "summary": "No matching records were found for that question.",
                "row_count": 0,
                "data": [],
            }

        if count <= SMALL_RESULT_THRESHOLD:
            # Small enough to let the LLM write a full natural-language answer
            # referencing the actual rows.
            summary = self.answer_chain.invoke(
                {"question": question, "query": query, "result": rows}
            )
            return {
                "mode": "text",
                "summary": summary,
                "row_count": count,
                "data": rows,
            }

        # Large result set: don't make the LLM narrate every row (slow, and it
        # tends to drop/garble fields at scale). Give it only a small sample
        # for context, and return the full structured data separately so the
        # frontend can render it as a table/grid.
        sample = rows[:5]
        summary = self.answer_chain.invoke(
            {
                "question": question,
                "query": query,
                "result": f"{count} total rows returned. First {len(sample)} shown as a sample: {sample}",
            }
        )
        return {
            "mode": "table",
            "summary": summary,
            "row_count": count,
            "data": rows,
        }

    # Public entrypoint
    def ask(self, user_question: str, history: List[Dict[str, str]] = None) -> Dict[str, Any]:
        """
        Executes the text-to-SQL run while capturing metrics such as response time.
 
        Args:
            user_question: the current natural-language question.
            history: optional list of prior turns in this session, each shaped like
                {"question": ..., "sql": ...}. Only the most recent turn is used, to
                let follow-ups ("their emails too", "narrow that down") resolve
                references without accumulating open-ended conversational memory.
                The caller (API layer) is responsible for storing/passing this
                per-session — the pipeline itself is stateless between calls.
 
        Returns:
            Dict containing execution status, final answer, structured data,
            raw query run, and speed metrics.
        """
        start_time = time.perf_counter()
        history = history or []
        logger.info(f"Received query processing request: '{user_question}'")
 
        try:
            # Generate SQL exactly once. If there's a previous turn, fold it into the
            # prompt as context so references like "their" or "that list" can resolve.
            contextual_question = self._build_contextual_question(user_question, history)
            generated_sql = self.write_query_chain.invoke(
                {"question": contextual_question}
            )
            logger.debug(f"Generated SQL: {generated_sql}")
 
            # Execute it once, getting back labeled dict rows.
            rows = self._run_query_as_dicts(generated_sql)
            logger.debug(f"Row count returned: {len(rows)}")
 
            # Format the response based on row count.
            formatted = self._format_answer(user_question, generated_sql, rows)
 
            execution_time = time.perf_counter() - start_time
 
            return {
                "status": "success",
                "answer": formatted["summary"],
                "mode": formatted["mode"],
                "row_count": formatted["row_count"],
                "data": formatted["data"],
                "generated_sql": generated_sql.strip(),
                # Caller should append {"question": user_question, "sql": generated_sql}
                # to this session's history list before the next ask() call.
                "turn": {"question": user_question, "sql": generated_sql.strip()},
                "metrics": {
                    "execution_time_seconds": round(execution_time, 4)
                },
            }
 
        except Exception as e:
            execution_time = time.perf_counter() - start_time
            logger.error(f"Error during chain execution: {str(e)}", exc_info=True)
            return {
                "status": "error",
                "error_message": "An error occurred while compiling your request or running the database transaction.",
                "details": str(e),
                "metrics": {
                    "execution_time_seconds": round(execution_time, 4)
                },
            }
 
 
# Initialize the pipeline singleton using our established DB and LLM instances
pipeline = SQLChatPipeline(db_manager, ai_engine)