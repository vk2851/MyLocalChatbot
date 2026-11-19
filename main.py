import json
import httpx
from fastapi.responses import StreamingResponse
from fastapi import FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
import requests
import sqlite3

app = FastAPI()

# Frontend configuration
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

# Database connection
DATABASE = "chatbot.db"


# Create database and table

def init_db():
    connection = sqlite3.connect(DATABASE)

    connection.execute("""
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            conversation_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            title TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Add title column to existing databases if it is missing
    columns = connection.execute(
        "PRAGMA table_info(messages)"
    ).fetchall()

    if "title" not in [column[1] for column in columns]:
        connection.execute(
            "ALTER TABLE messages ADD COLUMN title TEXT"
        )

    connection.commit()
    connection.close()


# Initialize database
init_db()


# Request format
class ChatRequest(BaseModel):
    message: str
    conversation_id: str


# Home page
@app.get("/")
def home(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="index.html"
    )


# Chat API with permanent memory

@app.post("/chat")
async def chat(request: ChatRequest):

    connection = sqlite3.connect(DATABASE)

    try:
        # Get previous conversation messages
        cursor = connection.execute(
            """
            SELECT role, content
            FROM messages
            WHERE conversation_id = ?
            ORDER BY id DESC
            LIMIT 20
            """,
            (request.conversation_id,)
        )

        previous_messages = cursor.fetchall()
        previous_messages.reverse()

        messages = [
            {"role": role, "content": content}
            for role, content in previous_messages
        ]

        # Add current question
        messages.append({
            "role": "user",
            "content": request.message
        })

        # Save user question
        connection.execute(
            """
            INSERT INTO messages (conversation_id, role, content)
            VALUES (?, ?, ?)
            """,
            (request.conversation_id, "user", request.message)
        )

        connection.commit()

    finally:
        connection.close()

    # Stream the answer from Ollama
    async def generate_answer():

        answer_parts = []

        try:
            async with httpx.AsyncClient(timeout=180.0) as client:

                async with client.stream(
                    "POST",
                    "http://localhost:11434/api/chat",
                    json={
                        "model": "qwen3:8b",
                        "messages": messages,
                        "stream": True
                    }
                ) as ollama_response:

                    ollama_response.raise_for_status()

                    async for line in ollama_response.aiter_lines():

                        if not line:
                            continue

                        chunk = json.loads(line)

                        token = chunk.get(
                            "message", {}
                        ).get("content", "")

                        if token:
                            answer_parts.append(token)
                            yield token

        except Exception as error:
            print("Ollama generation error:", error)
            yield "\n[Generation stopped or an error occurred]"

        finally:

            # Save the generated answer, including partial
            # output when generation is cancelled
            answer = "".join(answer_parts)

            if answer:
                connection = sqlite3.connect(DATABASE)

                connection.execute(
                    """
                    INSERT INTO messages
                    (conversation_id, role, content)
                    VALUES (?, ?, ?)
                    """,
                    (
                        request.conversation_id,
                        "assistant",
                        answer
                    )
                )

                connection.commit()
                connection.close()

    return StreamingResponse(
        generate_answer(),
        media_type="text/plain"
    )



# Get all saved conversations

@app.get("/conversations")
def get_conversations():

    connection = sqlite3.connect(DATABASE)
    connection.row_factory = sqlite3.Row

    cursor = connection.execute("""
        SELECT
            c.conversation_id,
            COALESCE(
                (
                    SELECT title
                    FROM messages m
                    WHERE m.conversation_id = c.conversation_id
                    AND title IS NOT NULL
                    AND title != ''
                    ORDER BY m.id ASC
                    LIMIT 1
                ),
                (
                    SELECT content
                    FROM messages m
                    WHERE m.conversation_id = c.conversation_id
                    AND m.role = 'user'
                    ORDER BY m.id ASC
                    LIMIT 1
                )
            ) AS title
        FROM (
            SELECT DISTINCT conversation_id
            FROM messages
        ) c
        ORDER BY (
            SELECT MAX(id)
            FROM messages m
            WHERE m.conversation_id = c.conversation_id
        ) DESC
    """)

    conversations = [dict(row) for row in cursor.fetchall()]

    connection.close()

    return conversations



# Get messages from one conversation
@app.get("/conversations/{conversation_id}")
def get_conversation(conversation_id: str):

    connection = sqlite3.connect(DATABASE)
    connection.row_factory = sqlite3.Row

    cursor = connection.execute("""
        SELECT role, content, created_at
        FROM messages
        WHERE conversation_id = ?
        ORDER BY id ASC
    """, (conversation_id,))

    messages = [dict(row) for row in cursor.fetchall()]

    connection.close()

    return {
        "conversation_id": conversation_id,
        "messages": messages
    }
@app.delete("/conversations/{conversation_id}")
def delete_conversation(conversation_id: str):

    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()

    cursor.execute(
        "DELETE FROM messages WHERE conversation_id = ?",
        (conversation_id,)
    )

    conn.commit()
    deleted_count = cursor.rowcount
    conn.close()

    if deleted_count == 0:
        return {"message": "Conversation not found"}

    return {"message": "Conversation deleted successfully"}


class RenameRequest(BaseModel):
    title: str


@app.put("/conversations/{conversation_id}/rename")
def rename_conversation(
    conversation_id: str,
    request: RenameRequest
):

    new_title = request.title.strip()

    if not new_title:
        return {"message": "Title cannot be empty"}

    connection = sqlite3.connect(DATABASE)

    cursor = connection.execute("""
        UPDATE messages
        SET title = ?
        WHERE conversation_id = ?
    """, (new_title, conversation_id))

    connection.commit()
    updated_count = cursor.rowcount
    connection.close()

    if updated_count == 0:
        return {"message": "Conversation not found"}

    return {"message": "Conversation renamed successfully"}


@app.get("/search-conversations")
def search_conversations(q: str):

    search_term = q.strip()

    if not search_term:
        return []

    connection = sqlite3.connect(DATABASE)
    connection.row_factory = sqlite3.Row

    cursor = connection.execute("""
        SELECT
            c.conversation_id,
            COALESCE(
                (
                    SELECT title
                    FROM messages m
                    WHERE m.conversation_id = c.conversation_id
                    AND title IS NOT NULL
                    AND title != ''
                    ORDER BY m.id ASC
                    LIMIT 1
                ),
                (
                    SELECT content
                    FROM messages m
                    WHERE m.conversation_id = c.conversation_id
                    AND m.role = 'user'
                    ORDER BY m.id ASC
                    LIMIT 1
                )
            ) AS title
        FROM (
            SELECT DISTINCT conversation_id
            FROM messages
            WHERE content LIKE ?
               OR title LIKE ?
        ) c
        ORDER BY (
            SELECT MAX(id)
            FROM messages m
            WHERE m.conversation_id = c.conversation_id
        ) DESC
    """, (f"%{search_term}%", f"%{search_term}%"))

    conversations = [dict(row) for row in cursor.fetchall()]

    connection.close()

    return conversations


@app.post("/conversations/{conversation_id}/regenerate")
async def regenerate_response(conversation_id: str):

    connection = sqlite3.connect(DATABASE)

    try:
        # Find the latest user question
        cursor = connection.execute("""
            SELECT id, content
            FROM messages
            WHERE conversation_id = ?
            AND role = 'user'
            ORDER BY id DESC
            LIMIT 1
        """, (conversation_id,))

        latest_user = cursor.fetchone()

        if not latest_user:
            raise HTTPException(
                status_code=404,
                detail="No user message found"
            )

        latest_user_id = latest_user[0]

        # Remove the previous AI answer
        connection.execute("""
            DELETE FROM messages
            WHERE conversation_id = ?
            AND role = 'assistant'
            AND id > ?
        """, (conversation_id, latest_user_id))

        # Get conversation history up to the latest question
        cursor = connection.execute("""
            SELECT role, content
            FROM messages
            WHERE conversation_id = ?
            AND id <= ?
            ORDER BY id DESC
            LIMIT 20
        """, (conversation_id, latest_user_id))

        previous_messages = cursor.fetchall()
        previous_messages.reverse()

        messages = [
            {"role": role, "content": content}
            for role, content in previous_messages
        ]

        connection.commit()

    finally:
        connection.close()

    # Generate a fresh AI response
    async def generate_answer():

        answer_parts = []

        try:
            async with httpx.AsyncClient(timeout=180.0) as client:

                async with client.stream(
                    "POST",
                    "http://localhost:11434/api/chat",
                    json={
                        "model": "qwen3:8b",
                        "messages": messages,
                        "stream": True
                    }
                ) as ollama_response:

                    ollama_response.raise_for_status()

                    async for line in ollama_response.aiter_lines():

                        if not line:
                            continue

                        chunk = json.loads(line)

                        token = chunk.get(
                            "message", {}
                        ).get("content", "")

                        if token:
                            answer_parts.append(token)
                            yield token

        except Exception as error:
            print("Regeneration error:", error)
            yield "\n[Generation stopped or an error occurred]"

        finally:

            answer = "".join(answer_parts)

            if answer:
                connection = sqlite3.connect(DATABASE)

                connection.execute("""
                    INSERT INTO messages
                    (conversation_id, role, content)
                    VALUES (?, ?, ?)
                """, (
                    conversation_id,
                    "assistant",
                    answer
                ))

                connection.commit()
                connection.close()

    return StreamingResponse(
        generate_answer(),
        media_type="text/plain"
    )
