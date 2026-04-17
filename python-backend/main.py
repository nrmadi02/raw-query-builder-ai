import os
import json
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Dict, Any
from dotenv import load_dotenv
from openai import OpenAI

# Muat environment dari .env di root project
_ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(dotenv_path=os.path.join(_ROOT_DIR, ".env"))

# Zhipu AI configuration
ZHIPU_API_KEY = os.getenv("ZHIPU_API_KEY")
ZHIPU_BASE_URL = os.getenv("ZHIPU_BASE_URL", "https://api.z.ai/api/coding/paas/v4")
ZHIPU_MODEL = os.getenv("ZHIPU_MODEL", "glm-5-turbo")

client = OpenAI(api_key=ZHIPU_API_KEY, base_url=ZHIPU_BASE_URL)

app = FastAPI(title="AI Query Builder Backend (Python)")

# Log status API key saat startup
print("=" * 50)
print("🔑 STATUS API KEYS:")
key_status = (
    "✅ Loaded"
    if ZHIPU_API_KEY and "your-" not in ZHIPU_API_KEY
    else "❌ Missing/Placeholder"
)
print(f"   {key_status}  ZHIPU_API_KEY")
print(f"   Base URL: {ZHIPU_BASE_URL}")
print(f"   Model: {ZHIPU_MODEL}")
print("=" * 50)

# CORS (Izinkan panggilan dari Next.js frontend)
_allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _allowed_origins],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class Message(BaseModel):
    role: str
    content: str


class GenerateRequest(BaseModel):
    messages: List[Message]


class TableSelectionRequest(BaseModel):
    messages: List[Message]


class QueryResultSummary(BaseModel):
    title: str
    rows: List[Dict[str, Any]]


class InsightRequest(BaseModel):
    user_question: str
    query_results: List[QueryResultSummary]
    conversation_context: str | None = None


from validator import validate_and_format_sql, SQLValidationError


def normalize_response(structured_data: dict) -> dict:
    """
    Normalisasi response AI ke format multi-query.
    Mendukung format lama (sql, columns, chartType top-level)
    dan format baru (queries[]).
    """
    if "queries" in structured_data and isinstance(structured_data["queries"], list):
        return structured_data

    sql = structured_data.get("sql", "")
    columns = structured_data.get("columns", [])
    chart_type = structured_data.get("chartType", "table")
    explanation = structured_data.get("explanation", "")

    return {
        "explanation": explanation,
        "insight": structured_data.get("insight", ""),
        "queries": [
            {
                "title": "Hasil Query",
                "sql": sql,
                "columns": columns,
                "chartType": chart_type,
            }
        ],
    }


@app.post("/api/select-tables")
async def select_tables(req: TableSelectionRequest):
    try:
        messages_dict = [
            {"role": msg.role, "content": msg.content} for msg in req.messages
        ]

        response = client.chat.completions.create(
            model=ZHIPU_MODEL,
            messages=messages_dict,
            response_format={"type": "json_object"},
            timeout=30,
        )

        content = response.choices[0].message.content

        try:
            result = json.loads(content)
        except Exception:
            cleaned = content.replace("```json\n", "").replace("```", "").strip()
            result = json.loads(cleaned)

        tables = result.get("tables", [])
        print(f"[Select Tables] Selected: {tables}")

        return {"tables": tables}

    except Exception as e:
        print(f"[Select Tables] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/generate")
async def generate_sql(req: GenerateRequest):
    try:
        messages_dict = [
            {"role": msg.role, "content": msg.content} for msg in req.messages
        ]

        response = client.chat.completions.create(
            model=ZHIPU_MODEL,
            messages=messages_dict,
            response_format={"type": "json_object"},
        )

        content = response.choices[0].message.content

        try:
            structured_data = json.loads(content)
        except Exception:
            cleaned = content.replace("```json\n", "").replace("```", "").strip()
            structured_data = json.loads(cleaned)

        normalized = normalize_response(structured_data)

        validated_queries = []
        for query in normalized.get("queries", []):
            raw_sql = query.get("sql", "")
            if raw_sql:
                try:
                    safe_sql = validate_and_format_sql(raw_sql)
                    query["sql"] = safe_sql
                except SQLValidationError as sve:
                    print(
                        f"SQL Validation Error pada query '{query.get('title', '')}': {sve}"
                    )
                    query["sql"] = ""
                    query["validationError"] = str(sve)
            validated_queries.append(query)

        normalized["queries"] = validated_queries

        return normalized

    except SQLValidationError as sve:
        print(f"SQL Validation Error: {sve}")
        raise HTTPException(status_code=400, detail=str(sve))
    except Exception as e:
        print(f"Error AI Generation: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/generate-stream")
def generate_sql_stream(req: GenerateRequest):
    def stream_generator():
        try:
            messages_dict = [
                {"role": msg.role, "content": msg.content} for msg in req.messages
            ]

            response = client.chat.completions.create(
                model=ZHIPU_MODEL,
                messages=messages_dict,
                response_format={"type": "json_object"},
                stream=True,
            )

            accumulated = ""
            for chunk in response:
                if chunk.choices and len(chunk.choices) > 0:
                    delta = chunk.choices[0].delta
                    if delta and delta.content:
                        accumulated += delta.content
                        yield f"data: {json.dumps({'content': delta.content})}\n\n"

            parsed = json.loads(accumulated)
            normalized = normalize_response(parsed)

            validated_queries = []
            for query in normalized.get("queries", []):
                raw_sql = query.get("sql", "")
                if raw_sql:
                    try:
                        safe_sql = validate_and_format_sql(raw_sql)
                        validated_queries.append({**query, "sql": safe_sql})
                    except SQLValidationError as sve:
                        print(f"SQL Validation Error: {sve}")
                        validated_queries.append({
                            **query, "sql": "", "validationError": str(sve)
                        })
                else:
                    validated_queries.append(query)

            normalized["queries"] = validated_queries
            yield f"data: {json.dumps({'status': 'complete', 'result': normalized})}\n\n"
            yield "data: [DONE]\n\n"

        except json.JSONDecodeError as e:
            print(f"JSON Parse Error: {e}")
            yield f"data: {json.dumps({'error': f'Gagal parse response AI: {e}'})}\n\n"
            yield "data: [DONE]\n\n"
        except SQLValidationError as sve:
            print(f"SQL Validation Error: {sve}")
            yield f"data: {json.dumps({'error': str(sve)})}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            print(f"Error generate-stream: {e}")
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        stream_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/api/insight")
async def generate_insight(req: InsightRequest):
    try:
        data_summary_parts = []
        for qr in req.query_results:
            if qr.rows:
                sample = qr.rows[:20]
                data_summary_parts.append(
                    f"=== {qr.title} ===\n"
                    + json.dumps(sample, ensure_ascii=False, indent=2)
                )
            else:
                data_summary_parts.append(f"=== {qr.title} ===\n(tidak ada data)")

        data_text = "\n\n".join(data_summary_parts)

        context_prefix = (
            f"{req.conversation_context}\n\n" if req.conversation_context else ""
        )

        prompt = (
            f'{context_prefix}Pertanyaan user: "{req.user_question}"\n\n'
            f"Berikut adalah data NYATA hasil query dari database:\n\n"
            f"{data_text}\n\n"
            f"Tugas kamu: Tulis SATU paragraf kesimpulan analitik dalam Bahasa Indonesia "
            f"yang menjawab langsung pertanyaan user berdasarkan angka/nilai nyata di atas. "
            f"Sebutkan nama spesifik, angka, dan perbandingan yang relevan. "
            f"Jangan generic. Langsung ke poin utama. Maks 3 kalimat."
        )

        response = client.chat.completions.create(
            model=ZHIPU_MODEL,
            messages=[{"role": "user", "content": prompt}],
        )

        insight_text = response.choices[0].message.content.strip()
        return {"insight": insight_text}

    except Exception as e:
        print(f"Error generating insight: {e}")
        return {"insight": None}


@app.post("/api/insight-stream")
async def generate_insight_stream(req: InsightRequest):
    def stream_generator():
        try:
            data_summary_parts = []
            for qr in req.query_results:
                if qr.rows:
                    sample = qr.rows[:20]
                    data_summary_parts.append(
                        f"=== {qr.title} ===\n"
                        + json.dumps(sample, ensure_ascii=False, indent=2)
                    )
                else:
                    data_summary_parts.append(f"=== {qr.title} ===\n(tidak ada data)")

            data_text = "\n\n".join(data_summary_parts)

            context_prefix = (
                f"{req.conversation_context}\n\n" if req.conversation_context else ""
            )

            prompt = (
                f'{context_prefix}Pertanyaan user: "{req.user_question}"\n\n'
                f"Berikut adalah data hasil query dari database:\n\n"
                f"{data_text}\n\n"
                f"Tugas kamu:\n"
                f"1. JAWAB langsung pertanyaan user di atas menggunakan data yang diberikan\n"
                f"2. Sebutkan NAMA atau NILAI SPESIFIK dari data (jangan generic)\n"
                f"3. Jika user bertanya 'tampilkan X', sebutkan item-item yang ditemukan\n"
                f"4. Jika user bertanya 'berapa total/berapa banyak', berikan angka pasti\n"
                f"5. Tulis dalam 2-3 kalimat dalam Bahasa Indonesia yang singkat dan padat\n"
                f"6. JANGAN menjelaskan apa itu query atau metrik, LANGSUNG jawab pertanyaannya"
            )

            print(f"[Insight Stream] Starting stream for: '{req.user_question}'")
            yield f"data: {json.dumps({'status': 'starting'})}\n\n"

            response = client.chat.completions.create(
                model=ZHIPU_MODEL,
                messages=[{"role": "user", "content": prompt}],
                stream=True,
            )

            chunk_count = 0
            for chunk in response:
                chunk_count += 1
                if chunk.choices and len(chunk.choices) > 0:
                    delta = chunk.choices[0].delta
                    if delta and delta.content:
                        content = delta.content
                        print(
                            f"[Insight Stream] Chunk {chunk_count}: {content[:30]}..."
                        )
                        yield f"data: {json.dumps({'content': content})}\n\n"

            print(f"[Insight Stream] Completed with {chunk_count} chunks")
            yield "data: [DONE]\n\n"

        except Exception as e:
            print(f"[Insight Stream] Error: {e}")
            import traceback

            traceback.print_exc()
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        stream_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/health")
def health_check():
    return {"status": "ok", "message": "Python Backend Aktif (FastAPI + OpenAI SDK + Zhipu AI)"}


@app.get("/test-stream")
def test_stream():
    """Test endpoint untuk memastikan SSE streaming bekerja"""

    def generate():
        import time

        words = ["Halo", " ini", " test", " streaming", " dari", " Python", " backend!"]
        for i, word in enumerate(words):
            print(f"[Test Stream] Sending chunk {i + 1}: {word}")
            yield f"data: {json.dumps({'content': word})}\n\n"
            time.sleep(0.3)
        yield "data: [DONE]\n\n"
        print("[Test Stream] Completed")

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
