# Implementation Plan: AI Data Statistics Generator

## Ringkasan Proyek

Aplikasi berbasis AI yang memungkinkan user melakukan query data statistik melalui natural language prompt. AI akan menginterpretasi permintaan, menghasilkan SQL query berdasarkan Prisma schema yang ada, mengeksekusi query ke PostgreSQL, lalu menyajikan hasil dalam format Excel, Word, PDF, atau chart interaktif.

---

## Tech Stack

### Frontend

| Komponen       | Teknologi                    | Alasan                                    |
| -------------- | ---------------------------- | ----------------------------------------- |
| Framework      | **Next.js 14+ (App Router)** | SSR, API routes, React Server Components  |
| UI Library     | **shadcn/ui + Tailwind CSS** | Komponen siap pakai, styling cepat        |
| Chat Interface | **Vercel AI SDK**            | Streaming response, chat state management |
| Chart          | **Recharts / Chart.js**      | Visualisasi data interaktif di browser    |
| State          | **Zustand**                  | Lightweight state management              |

### Backend

| Komponen         | Teknologi                              | Alasan                                       |
| ---------------- | -------------------------------------- | -------------------------------------------- |
| Runtime          | **Node.js 20+ / Bun**                  | Kompatibel ecosystem                         |
| Framework        | **NestJS** atau **Next.js API Routes** | Struktur modular, middleware, guards         |
| ORM              | **Prisma**                             | Schema as source of truth, type safety       |
| Database         | **PostgreSQL 15+**                     | Relational, mendukung JSON, window functions |
| Queue (opsional) | **BullMQ + Redis**                     | Untuk proses export besar yang async         |

### AI Gateway

| Komponen       | Teknologi                  | Alasan                                |
| -------------- | -------------------------- | ------------------------------------- |
| LLM Gateway    | **LiteLLM Proxy**          | Unified API ke 100+ LLM providers     |
| Primary Model  | **GPT-4o / Claude Sonnet** | Kemampuan code generation & reasoning |
| Fallback Model | **Ollama (local)**         | Offline / development tanpa biaya API |

### Export Engine

| Format        | Library                       |
| ------------- | ----------------------------- |
| Excel (.xlsx) | **ExcelJS**                   |
| Word (.docx)  | **docx** (docx-js)            |
| PDF           | **PDFKit** atau **Puppeteer** |
| CSV           | Native Node.js stream         |

---

## Arsitektur Sistem

```
┌──────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Frontend   │────▶│   Backend API    │────▶│  LiteLLM Proxy  │
│  (Next.js)   │◀────│   (NestJS)       │◀────│  (Docker)       │
│  Chat UI     │     │  Orchestrator    │     │  Gateway        │
└──────────────┘     └────────┬─────────┘     └────────┬────────┘
                              │                        │
                              │                   ┌────▼────────┐
                              │                   │ LLM Provider │
                              │                   │ GPT / Claude │
                              │                   │ / Ollama     │
                              │                   └─────────────┘
                              │
                    ┌─────────▼──────────┐
                    │  Query Validator   │
                    │  Sanitize + Guard  │
                    └─────────┬──────────┘
                              │
                    ┌─────────▼──────────┐
                    │    PostgreSQL      │
                    │  (via Prisma)      │
                    └─────────┬──────────┘
                              │
                    ┌─────────▼──────────┐
                    │   Export Engine    │
                    │ xlsx / docx / pdf  │
                    └────────────────────┘
```

---

## Detail Flow Aplikasi

### Flow 1: Natural Language → SQL Query

**Step 1 — User mengirim prompt**
User menulis pertanyaan dalam bahasa natural di chat UI, contoh: "Tampilkan total penjualan per bulan di tahun 2025 untuk semua cabang".

**Step 2 — Context Builder menyiapkan payload**
Backend mengambil Prisma schema dan menyusun system prompt untuk LLM:

```typescript
// Contoh context builder
const systemPrompt = `
Kamu adalah SQL query generator untuk PostgreSQL.
Berikut adalah database schema (Prisma format):

${prismaSchemaString}

Rules:
- Generate ONLY SELECT queries (read-only)
- NEVER use DELETE, UPDATE, INSERT, DROP, ALTER, TRUNCATE
- Use proper table/column names sesuai schema
- Gunakan alias yang readable untuk column output
- Batasi result dengan LIMIT jika user tidak spesifik
- Return response dalam format JSON:
  {
    "sql": "SELECT ...",
    "explanation": "Penjelasan query",
    "columns": ["col1", "col2"],
    "chartType": "bar|line|pie|table"
  }
`;
```

**Step 3 — Request ke LiteLLM**
Backend mengirim request ke LiteLLM Proxy yang kemudian di-route ke LLM provider yang dikonfigurasi:

```typescript
// LiteLLM compatible dengan OpenAI SDK
const response = await openai.chat.completions.create({
  model: "gpt-4o", // LiteLLM routes ini ke provider yang tepat
  messages: [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ],
  temperature: 0,
  response_format: { type: "json_object" },
});
```

**Step 4 — Query Validation & Sanitization**
Sebelum dieksekusi, SQL yang dihasilkan AI harus divalidasi:

```typescript
class QueryValidator {
  validate(sql: string): ValidationResult {
    // 1. Parse SQL AST
    // 2. Reject non-SELECT statements
    // 3. Reject subqueries dengan DML
    // 4. Whitelist hanya tabel yang ada di schema
    // 5. Enforce LIMIT (max 10000 rows)
    // 6. Block dangerous functions (pg_sleep, etc)
    // 7. Timeout protection (max 30 detik)
  }
}
```

**Step 5 — Execute Query**
Menggunakan Prisma `$queryRawUnsafe()` dengan read-only transaction:

```typescript
const result = await prisma.$transaction(async (tx) => {
  // Set statement timeout
  await tx.$executeRawUnsafe("SET LOCAL statement_timeout = 30000");
  // Set read-only
  await tx.$executeRawUnsafe("SET LOCAL default_transaction_read_only = ON");
  // Execute the AI-generated query
  return await tx.$queryRawUnsafe(validatedSql);
});
```

**Step 6 — AI Summarization (opsional)**
Kirim hasil query kembali ke LLM untuk narrative summary:

```typescript
const summary = await openai.chat.completions.create({
  model: "gpt-4o",
  messages: [
    {
      role: "system",
      content: "Buat ringkasan dari data ini dalam Bahasa Indonesia...",
    },
    { role: "user", content: JSON.stringify(queryResult.slice(0, 100)) },
  ],
});
```

**Step 7 — Export ke format yang diminta**
Generate file sesuai permintaan user (Excel, Word, PDF).

---

### Flow 2: Export Engine

```
Query Results (JSON)
      │
      ├──▶ Excel: ExcelJS → worksheet + styling + charts
      ├──▶ Word:  docx-js → formatted report dengan tabel
      ├──▶ PDF:   PDFKit → tabel + chart gambar
      └──▶ Chart: Recharts (frontend) / Chart.js (server-side)
```

---

## LiteLLM Configuration

### Docker Compose Setup

```yaml
# docker-compose.yml
version: "3.9"
services:
  litellm:
    image: ghcr.io/berriai/litellm:main-stable
    ports:
      - "4000:4000"
    volumes:
      - ./litellm-config.yaml:/app/config.yaml
    environment:
      - LITELLM_MASTER_KEY=sk-your-master-key
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
    command: --config /app/config.yaml --detailed_debug

  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: myapp
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  app:
    build: .
    ports:
      - "3000:3000"
    depends_on:
      - litellm
      - postgres
      - redis
    environment:
      - DATABASE_URL=postgresql://postgres:${DB_PASSWORD}@postgres:5432/myapp
      - LITELLM_URL=http://litellm:4000
      - LITELLM_API_KEY=sk-your-master-key

volumes:
  pgdata:
```

### LiteLLM Config

```yaml
# litellm-config.yaml
model_list:
  - model_name: gpt-4o
    litellm_params:
      model: openai/gpt-4o
      api_key: os.environ/OPENAI_API_KEY

  - model_name: claude-sonnet
    litellm_params:
      model: anthropic/claude-sonnet-4-20250514
      api_key: os.environ/ANTHROPIC_API_KEY

  - model_name: local-llama
    litellm_params:
      model: ollama/llama3.1
      api_base: http://host.docker.internal:11434

router_settings:
  routing_strategy: "latency-based-routing"
  num_retries: 2
  fallbacks:
    - gpt-4o: [claude-sonnet, local-llama]

general_settings:
  master_key: sk-your-master-key
  database_url: postgresql://postgres:password@postgres:5432/litellm
```

---

## Prisma Schema Extraction

Untuk memberikan context ke LLM, kita perlu mengekstrak schema Prisma secara otomatis:

```typescript
// src/services/schema-extractor.ts
import fs from "fs";
import path from "path";

export class SchemaExtractor {
  private schemaPath: string;

  constructor() {
    this.schemaPath = path.join(process.cwd(), "prisma/schema.prisma");
  }

  // Ekstrak schema mentah
  getRawSchema(): string {
    return fs.readFileSync(this.schemaPath, "utf-8");
  }

  // Ekstrak hanya model definitions (tanpa datasource/generator)
  getModelsOnly(): string {
    const schema = this.getRawSchema();
    const modelRegex = /model\s+\w+\s*\{[^}]+\}/g;
    const enumRegex = /enum\s+\w+\s*\{[^}]+\}/g;
    const models = schema.match(modelRegex) || [];
    const enums = schema.match(enumRegex) || [];
    return [...enums, ...models].join("\n\n");
  }

  // Buat versi ringkas untuk LLM context
  getCompactSchema(): string {
    // Parse models menjadi format sederhana:
    // TABLE users: id(INT PK), email(VARCHAR UNIQUE), name(VARCHAR), created_at(TIMESTAMP)
    // Ini mengurangi token usage
  }
}
```

---

## Security Considerations

### 1. SQL Injection Prevention

- AI-generated SQL divalidasi melalui AST parser (gunakan `pgsql-ast-parser` atau `node-sql-parser`)
- Hanya SELECT statement yang diizinkan
- Whitelist tabel dan kolom berdasarkan Prisma schema
- Block semua system tables (`pg_*`, `information_schema`)

### 2. Query Resource Protection

- `statement_timeout` di PostgreSQL (30 detik max)
- `LIMIT` enforcement (max 10.000 rows)
- Read-only transaction mode
- Dedicated read-only database user/role

### 3. Rate Limiting

- Per-user rate limit di API level
- LiteLLM built-in rate limiting per virtual key
- Redis-based sliding window

### 4. Data Access Control

- Row-Level Security (RLS) di PostgreSQL per tenant/user
- Schema filter berdasarkan user role (tidak semua tabel diekspos ke semua user)

### 5. LLM Prompt Injection Prevention

- Sanitize user input sebelum masuk ke prompt
- System prompt yang rigid dengan clear boundaries
- Output validation (JSON schema validation)

---

## Database Setup

### Read-Only Role untuk AI Queries

```sql
-- Buat role khusus untuk AI query execution
CREATE ROLE ai_readonly WITH LOGIN PASSWORD 'secure_password';

-- Grant read-only ke semua tabel
GRANT CONNECT ON DATABASE myapp TO ai_readonly;
GRANT USAGE ON SCHEMA public TO ai_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO ai_readonly;

-- Auto-grant untuk tabel baru
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO ai_readonly;

-- Set resource limits
ALTER ROLE ai_readonly SET statement_timeout = '30s';
ALTER ROLE ai_readonly SET lock_timeout = '10s';
```

---

## Folder Structure

```
project/
├── docker-compose.yml
├── litellm-config.yaml
├── prisma/
│   └── schema.prisma
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── page.tsx                  # Chat UI
│   │   ├── api/
│   │   │   ├── chat/route.ts         # Chat endpoint (streaming)
│   │   │   ├── export/route.ts       # File export endpoint
│   │   │   └── schema/route.ts       # Schema info endpoint
│   │   └── layout.tsx
│   ├── components/
│   │   ├── ChatInterface.tsx
│   │   ├── MessageBubble.tsx
│   │   ├── DataTable.tsx
│   │   ├── ChartPreview.tsx
│   │   └── ExportButtons.tsx
│   ├── services/
│   │   ├── llm.service.ts            # LiteLLM communication
│   │   ├── schema-extractor.ts       # Prisma schema parser
│   │   ├── query-validator.ts        # SQL validation & sanitization
│   │   ├── query-executor.ts         # PostgreSQL execution
│   │   ├── export/
│   │   │   ├── excel.service.ts      # ExcelJS export
│   │   │   ├── word.service.ts       # docx-js export
│   │   │   ├── pdf.service.ts        # PDFKit export
│   │   │   └── chart.service.ts      # Server-side chart generation
│   │   └── prompt-builder.ts         # System prompt construction
│   ├── guards/
│   │   ├── rate-limit.guard.ts
│   │   └── auth.guard.ts
│   └── types/
│       ├── query.types.ts
│       └── export.types.ts
├── package.json
└── tsconfig.json
```

---

## Implementation Phases

### Phase 1 — Foundation (Minggu 1–2)

- Setup project Next.js + Prisma + PostgreSQL
- Deploy LiteLLM Proxy via Docker
- Buat schema extractor
- Buat basic chat UI
- Implementasi prompt builder dengan schema injection
- Test basic SQL generation dari natural language

### Phase 2 — Core Query Pipeline (Minggu 3–4)

- Implementasi query validator (AST-based)
- Setup read-only database role
- Buat query executor dengan timeout protection
- Implementasi streaming response di chat UI
- Tampilkan hasil query dalam tabel interaktif
- Error handling dan retry logic

### Phase 3 — Export Engine (Minggu 5–6)

- Excel export dengan ExcelJS (tabel + basic styling)
- Word export dengan docx-js (report format + tabel)
- PDF export dengan PDFKit
- Chart generation (bar, line, pie) berdasarkan data
- Download endpoint dengan signed URL

### Phase 4 — AI Enhancement (Minggu 7–8)

- AI summarization dari query results
- Smart chart type suggestion
- Multi-turn conversation (follow-up queries)
- Query history dan favorites
- Caching frequent queries (Redis)

### Phase 5 — Production Hardening (Minggu 9–10)

- Rate limiting dan authentication
- Row-Level Security per user/tenant
- Monitoring dan logging (LiteLLM built-in)
- Cost tracking per user
- Load testing dan performance tuning
- Documentation dan deployment guide

---

## Estimasi Biaya Bulanan

| Komponen                    | Estimasi             | Catatan                        |
| --------------------------- | -------------------- | ------------------------------ |
| LiteLLM Proxy               | Gratis (self-hosted) | Open source                    |
| OpenAI GPT-4o               | ~$50–200/bulan       | Tergantung volume              |
| Anthropic Claude (fallback) | ~$30–100/bulan       | Opsional                       |
| PostgreSQL                  | ~$15–50/bulan        | Managed DB (Supabase/Neon)     |
| VPS / Cloud                 | ~$20–80/bulan        | Docker host                    |
| Redis                       | ~$10–15/bulan        | Managed atau self-hosted       |
| **Total**                   | **~$125–445/bulan**  | Bisa lebih hemat dengan Ollama |

---

## Contoh Penggunaan

**User:** "Berapa total revenue per kategori produk bulan Januari 2025?"

**AI Response:**

```json
{
  "sql": "SELECT p.category, SUM(o.total_amount) as total_revenue FROM orders o JOIN products p ON o.product_id = p.id WHERE o.created_at >= '2025-01-01' AND o.created_at < '2025-02-01' GROUP BY p.category ORDER BY total_revenue DESC",
  "explanation": "Query menghitung total revenue per kategori produk di bulan Januari 2025",
  "columns": ["category", "total_revenue"],
  "chartType": "bar"
}
```

**Output di chat:**

1. Tabel interaktif dengan data
2. Bar chart visualisasi
3. Tombol export: Download Excel | Download PDF | Download Word

---

## Next Steps

Setelah rancangan ini disetujui:

1. Siapkan repository dan boilerplate project
2. Setup Docker Compose dengan LiteLLM + PostgreSQL
3. Implementasi Phase 1 (foundation)
4. Iterasi berdasarkan feedback

   Setup database auth:

   # Buat database baru

   createdb ai_query_builder_auth

   # Run migration

   npx prisma migrate dev --schema=prisma/schema-auth.prisma --name init 2. Setup Google OAuth:
   - Buka Google Cloud Console
   - Buat project atau pilih yang ada
   - Enable Google+ API
   - Buat OAuth 2.0 credentials (Web application)
   - Authorized redirect URI: http://localhost:3000/api/auth/callback/google
   3. Generate secret:
      openssl rand -base64 32
   4. Test login flow:
   - Jalankan npm run dev
   - Akses http://localhost:3000
   - Verifikasi redirect ke /login
   - Klik "Login dengan Google"
   - Complete Google OAuth flow
   - Verifikasi redirect kembali ke /
   - Verifikasi session aktif
   5. Test logout:
   - Klik tombol logout
   - Verifikasi redirect ke /login
