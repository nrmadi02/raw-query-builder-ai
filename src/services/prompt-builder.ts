import { schemaExtractor } from "./schema-extractor";
import { querySchemaExtractor } from "./query-schema-extractor";
import type { ConversationTurn } from "@/types";

export type DatabaseType = "local" | "remote";

const MAX_CONTEXT_TURNS = 6;

export function buildConversationContext(turns: ConversationTurn[]): string {
  if (turns.length === 0) return "";

  const recent = turns.slice(-MAX_CONTEXT_TURNS);
  const parts = recent.map((turn) => {
    if (turn.role === "user") {
      return `User: "${turn.content}"`;
    }
    const sqlPart = turn.sql?.length
      ? `\nSQL yang dihasilkan: ${turn.sql.join("; ")}`
      : "";
    const summaryPart = turn.resultSummary
      ? `\nRingkasan hasil: ${turn.resultSummary}`
      : "";
    return `Asisten: ${turn.content}${sqlPart}${summaryPart}`;
  });

  return `## RIWAYAT PERCAKAPAN (konteks sebelumnya)\n${parts.join("\n\n")}\n\nGunakan konteks ini jika user merujuk ke data/query sebelumnya. Jika pertanyaan user tidak terkait, abaikan konteks ini.`;
}

/**
 * Generate soft-delete rules — compact
 */
function generateSoftDeleteContext(): string {
  return `
## ATURAN SOFT DELETE

Tabel DENGAN deleted_at (wajib filter \`deleted_at IS NULL\`):
admins, cashiers, countries, districts, formulas, helper_units, insurances, management_units, regencies, subdistricts, tax_amnesties, vehicle_brands, vehicle_categories, vehicle_fuels, vehicle_functionalities, vehicle_license_colors, vehicle_models, vehicle_owner_occupations, vehicle_ownership_statuses, vehicle_taxes, users

Tabel TANPA deleted_at (JANGAN tambahkan filter ini):
tax_transactions, taxations, cashier_helper_units, user_helper_units, tax_amnesty_license_colors, permission_assignments, permissions, configs, provinces, activities, versions, public_holidays, third_party_logs, active_storage_attachments, active_storage_blobs, active_storage_variant_records, schema_migrations, ar_internal_metadata

PERHATIAN: Tabel \`vehicles\` TIDAK punya deleted_at. Gunakan \`blocked_at IS NULL\` untuk filter kendaraan aktif.
`;
}

/**
 * Generate compact domain context
 */
function generateDomainContext(): string {
  return `
## DOMAIN: SAMSAT Kalimantan Selatan (plat DA)

Sistem pajak kendaraan bermotor. Instansi: Polri (STNK), Bapenda (Pajak), PT Jasa Raharja (Asuransi).

Jenis pajak: PKB (tahunan), BBNKB (balik nama), SWDKLLJ (asuransi kecelakaan), OPSEN (operasional).

Status kendaraan (field \`status\`): Aktif, Blocked, Mutation.
Status transaksi (field \`status\`): pending, paid, verified, expired.
Channel pembayaran: loket, bank, online, mobile.
Warna plat: Putih=pribadi, Kuning=umum, Merah=dinas.

## KOMPONEN BIAYA (tax_transactions & taxations)
base=PKB pokok, penalty=denda PKB, insurance=SWDKLLJ, insurance_penalty=denda SWDKLLJ,
title_transfer=BBNKB, title_transfer_penalty=denda BBNKB,
opsen=OPSEN PKB, opsen_penalty=denda OPSEN, opsen_title_transfer=OPSEN BBNKB, opsen_title_transfer_penalty=denda OPSEN BBNKB,
total_amount=total keseluruhan.

## GEOGRAFI
Hierarki: provinces → regencies → districts → subdistricts.
vehicles terhubung via regency_id, district_id, subdistrict_id.
provinces TIDAK punya deleted_at. regencies, districts, subdistricts PUNYA deleted_at.

## CONTOH QUERY
-- Pendapatan per kabupaten
SELECT r.name as kabupaten, SUM(tt.total_amount) as total_pendapatan
FROM tax_transactions tt
JOIN vehicles v ON tt.vehicle_id = v.id
JOIN regencies r ON v.regency_id = r.id
WHERE tt.status = 'paid' AND v.blocked_at IS NULL AND r.deleted_at IS NULL
GROUP BY r.name ORDER BY total_pendapatan DESC;

-- Pendapatan per bulan
SELECT DATE_TRUNC('month', paid_at) as bulan, SUM(total_amount) as total, COUNT(*) as jumlah
FROM tax_transactions WHERE status = 'paid'
GROUP BY DATE_TRUNC('month', paid_at) ORDER BY bulan;
`;
}

/**
 * Build table selection prompt (Step 1) — kecil, hanya daftar tabel ringkas.
 * LLM mengembalikan JSON: {"tables": ["table1", "table2"]}
 */
export function buildTableSelectionPrompt(userQuestion: string): string {
  const tableSummaries = querySchemaExtractor.getTableSummaries();

  return `Kamu adalah asisten yang memilih tabel database yang relevan untuk menjawab pertanyaan user tentang data SAMSAT (pajak kendaraan bermotor).

Berikut daftar tabel yang tersedia:
${tableSummaries}

Pertanyaan: "${userQuestion}"

PILIH hanya tabel yang BENAR-BENAR dibutuhkan untuk menjawab pertanyaan.
Pertimbangkan tabel yang perlu di-JOIN untuk mendapatkan data yang diminta.
Minimal: 1 tabel. Maksimal: 8 tabel.

Respons JSON saja: {"tables": ["table1", "table2"]}`;
}

/**
 * Build system prompt — schema sebagai konteks utama, domain context sebagai pendukung
 */
export function buildSystemPrompt(
  userQuestion: string,
  database: DatabaseType = "local",
  selectedTables?: string[],
  conversationContext?: string,
): string {
  let schemaDescription: string;

  if (database === "remote") {
    if (selectedTables && selectedTables.length > 0) {
      const expandedTables = querySchemaExtractor.findRelatedTables(selectedTables);
      schemaDescription = querySchemaExtractor.getFilteredSchemaDescription(expandedTables);
    } else {
      schemaDescription = querySchemaExtractor.getSQLSchemaDescription();
    }
  } else {
    schemaDescription = schemaExtractor.getSQLSchemaDescription();
  }

  const domainContext =
    database === "remote"
      ? `${generateDomainContext()}\n${generateSoftDeleteContext()}`
      : "";

  return `
Kamu adalah generator SQL query untuk PostgreSQL 15+.
${database === "remote" ? "Sistem SAMSAT Kalimantan Selatan (pajak kendaraan bermotor, plat DA)." : ""}

## SCHEMA DATABASE (sumber kebenaran — gunakan nama tabel & kolom persis seperti di bawah):

${schemaDescription}

${domainContext}
${conversationContext || ""}
Pertanyaan User: "${userQuestion}"

## INSTRUKSI
1. Hanya SELECT. Jangan DML/DDL (INSERT, UPDATE, DELETE, DROP, ALTER).
2. Gunakan nama kolom snake_case persis seperti di schema. Jangan camelCase.
3. Buat 2-4 query yang saling berelasi dengan perspektif berbeda.
4. Gunakan alias yang mudah dibaca untuk aggregasi.
5. Nomor polisi kendaraan = field \`license_no\`.
${
  database === "remote"
    ? `6. SOFT DELETE: Gunakan \`deleted_at IS NULL\` HANYA pada tabel yang punya kolom tersebut. \`vehicles\`, \`tax_transactions\`, \`taxations\` TIDAK punya deleted_at — untuk vehicles gunakan \`blocked_at IS NULL\`.
7. Format tanggal: 'YYYY-MM-DD'. Gunakan DATE_TRUNC untuk grouping per periode.
8. Perhatikan relasi antar tabel via foreign key di schema.`
    : ""
}

## FORMAT RESPONS (JSON murni, tanpa markdown)
{"explanation": "Penjelasan analisis dalam Bahasa Indonesia", "insight": "Kesimpulan analitik berdasarkan struktur data", "queries": [{"title": "Judul (maks 5 kata)", "sql": "SELECT ...", "columns": ["col1", "col2"], "chartType": "bar|line|pie|table"}]}
  `.trim();
}
