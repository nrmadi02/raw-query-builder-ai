import os
import json
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Dict, Any, Optional, AsyncGenerator
from dotenv import load_dotenv

# Import litellm SDK
import litellm

# Muat environment dari .env di root project (path absolut agar aman)
_ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(dotenv_path=os.path.join(_ROOT_DIR, ".env"))

app = FastAPI(title="AI Query Builder Backend (Python)")

# Log status API keys saat startup
_KEYS_STATUS = {
    "GEMINI_API_KEY": "✅ Loaded"
    if os.getenv("GEMINI_API_KEY") and "xxxxx" not in os.getenv("GEMINI_API_KEY", "")
    else "❌ Missing/Placeholder",
    "GROQ_API_KEY": "✅ Loaded"
    if os.getenv("GROQ_API_KEY") and "xxxxx" not in os.getenv("GROQ_API_KEY", "")
    else "❌ Missing/Placeholder",
    "OPENAI_API_KEY": "✅ Loaded"
    if os.getenv("OPENAI_API_KEY") and "xxxxx" not in os.getenv("OPENAI_API_KEY", "")
    else "❌ Missing/Placeholder",
}
print("=" * 50)
print("🔑 STATUS API KEYS:")
for k, v in _KEYS_STATUS.items():
    print(f"   {v}  {k}")
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
    model: Optional[str] = "gemini/gemini-2.0-flash-exp"  # Default: free model


class QueryResultSummary(BaseModel):
    title: str
    rows: List[Dict[str, Any]]


class InsightRequest(BaseModel):
    user_question: str
    query_results: List[QueryResultSummary]
    model: Optional[str] = "gemini/gemini-2.0-flash"


from validator import validate_and_format_sql, SQLValidationError


def normalize_response(structured_data: dict) -> dict:
    """
    Normalisasi response AI ke format multi-query.
    Mendukung format lama (sql, columns, chartType top-level)
    dan format baru (queries[]).
    """
    # Jika AI mengembalikan format baru dengan queries[]
    if "queries" in structured_data and isinstance(structured_data["queries"], list):
        return structured_data

    # Fallback: format lama → konversi ke format baru
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


@app.post("/api/generate")
async def generate_sql(req: GenerateRequest):
    try:
        # Konversi Pydantic List[Message] ke list of dicts yang diharapkan oleh litellm
        messages_dict = [
            {"role": msg.role, "content": msg.content} for msg in req.messages
        ]

        # Fallback: jika model primer gagal (rate limit/model tidak tersedia)
        fallback_models = [
            "gemini/gemini-2.0-flash-exp",  # Free, Google AI Studio
            "gemini/gemini-1.5-flash-latest",  # Free, Google AI Studio (lebih stabil)
            "groq/llama-3.3-70b-versatile",  # Free, Groq
            "claude-3-5-sonnet-20240620",  # Paid, Anthropic
        ]
        # Hapus model primer dari fallback agar tidak duplikat
        fallback_models = [m for m in fallback_models if m != req.model]

        print(f"Mengirim request ke {req.model} (fallbacks: {fallback_models})...")

        # Eksekusi SDK
        response = litellm.completion(
            model=req.model,
            messages=messages_dict,
            fallbacks=fallback_models,
            response_format={"type": "json_object"},  # Wajibkan output JSON murni
        )

        # Ambil kontens pesan
        content = response.choices[0].message.content

        # Parse output JSON string menjadi object dictionary
        try:
            structured_data = json.loads(content)
        except Exception:
            # Jika sewaktu-waktu model nge-bug dan mengembalikan Non-JSON atau Markdown
            cleaned = content.replace("```json\n", "").replace("```", "").strip()
            structured_data = json.loads(cleaned)

        # Normalisasi ke format multi-query
        normalized = normalize_response(structured_data)

        # VALIDASI AST UNTUK SETIAP QUERY
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


@app.post("/api/insight")
async def generate_insight(req: InsightRequest):
    """
    Generate insight berdasarkan data NYATA dari hasil query.
    Dipanggil setelah query dieksekusi dan rows tersedia.
    """
    try:
        # Buat ringkasan data untuk dikirim ke AI
        data_summary_parts = []
        for qr in req.query_results:
            if qr.rows:
                # Kirim maks 20 baris per tabel agar tidak melebihi token limit
                sample = qr.rows[:20]
                data_summary_parts.append(
                    f"=== {qr.title} ===\n"
                    + json.dumps(sample, ensure_ascii=False, indent=2)
                )
            else:
                data_summary_parts.append(f"=== {qr.title} ===\n(tidak ada data)")

        data_text = "\n\n".join(data_summary_parts)

        prompt = (
            f'Pertanyaan user: "{req.user_question}"\n\n'
            f"Berikut adalah data NYATA hasil query dari database:\n\n"
            f"{data_text}\n\n"
            f"Tugas kamu: Tulis SATU paragraf kesimpulan analitik dalam Bahasa Indonesia "
            f"yang menjawab langsung pertanyaan user berdasarkan angka/nilai nyata di atas. "
            f"Sebutkan nama spesifik, angka, dan perbandingan yang relevan. "
            f"Jangan generic. Langsung ke poin utama. Maks 3 kalimat."
        )

        fallback_models = [
            "gemini/gemini-2.0-flash-exp",
            "gemini/gemini-1.5-flash-latest",
            "groq/llama-3.3-70b-versatile",
        ]
        fallback_models = [m for m in fallback_models if m != req.model]

        print(f"[Insight] Generating insight untuk: '{req.user_question}'")

        response = litellm.completion(
            model=req.model,
            messages=[
                {
                    "role": "user",
                    "content": prompt,
                }
            ],
            fallbacks=fallback_models,
        )

        insight_text = response.choices[0].message.content.strip()
        return {"insight": insight_text}

    except Exception as e:
        print(f"Error generating insight: {e}")
        # Gagal generate insight tidak boleh crash seluruh response
        return {"insight": None}


@app.post("/api/insight-stream")
async def generate_insight_stream(req: InsightRequest):
    """
    Streaming insight berdasarkan data NYATA dari hasil query.
    Menggunakan Server-Sent Events (SSE) format.
    """

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

            prompt = (
                f'Pertanyaan user: "{req.user_question}"\n\n'
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

            fallback_models = [
                "gemini/gemini-2.0-flash-exp",
                "gemini/gemini-1.5-flash-latest",
                "groq/llama-3.3-70b-versatile",
            ]
            fallback_models = [m for m in fallback_models if m != req.model]

            print(f"[Insight Stream] Starting stream for: '{req.user_question}'")
            yield f"data: {json.dumps({'status': 'starting'})}\n\n"

            response = litellm.completion(
                model=req.model or "gemini/gemini-2.0-flash-exp",
                messages=[{"role": "user", "content": prompt}],
                fallbacks=fallback_models,
                stream=True,
            )

            chunk_count = 0
            for chunk in response:
                chunk_count += 1
                if chunk.choices and len(chunk.choices) > 0:
                    delta = chunk.choices[0].delta
                    if delta and hasattr(delta, "content") and delta.content:
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
    return {"status": "ok", "message": "Python Backend Aktif (FastAPI + LiteLLM SDK)"}


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
