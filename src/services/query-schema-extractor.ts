import fs from "fs";
import path from "path";
import { queryPrisma } from "./query-db";

export interface ValidationResult {
  isValid: boolean;
  reason?: string;
  matchedTables?: string[];
  confidence?: "high" | "medium" | "low";
}

// Levenshtein distance untuk fuzzy matching typo
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

// Toleransi typo berdasarkan panjang kata
function maxTypoTolerance(word: string): number {
  if (word.length <= 4) return 0;
  if (word.length <= 7) return 1;
  return 2;
}

// Cek apakah token dalam question cocok (fuzzy) dengan keyword
function fuzzyMatch(question: string, keyword: string): boolean {
  if (question.includes(keyword)) return true;
  const tokens = question.split(/\s+/);
  const tolerance = maxTypoTolerance(keyword);
  if (tolerance === 0) return false;
  return tokens.some((token) => levenshtein(token, keyword) <= tolerance);
}

export class QuerySchemaExtractor {
  private schemaPath: string;
  private tableNames: string[] = [];
  private columnNames: string[] = [];
  private tableAliases: Record<string, string[]> = {};
  private rawSchemaCache: string | null = null;

  constructor() {
    this.schemaPath = path.join(process.cwd(), "prisma/schema-query.prisma");
    this.extractSchemaInfo();
  }

  // Ekstrak schema mentah (cached)
  getRawSchema(): string {
    if (!this.rawSchemaCache) {
      this.rawSchemaCache = fs.readFileSync(this.schemaPath, "utf-8");
    }
    return this.rawSchemaCache;
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
    const modelsOnly = this.getModelsOnly();
    return modelsOnly
      .replace(/\/\/.*$/gm, "")
      .replace(/\n\s*\n/g, "\n")
      .trim();
  }

  // Ekstrak informasi tabel dan kolom untuk validasi
  private extractSchemaInfo(): void {
    const schema = this.getRawSchema();

    // Ekstrak nama model/tabel
    const modelRegex = /model\s+(\w+)\s*\{/g;
    let match: RegExpExecArray | null = modelRegex.exec(schema);
    while (match !== null) {
      const tableName = match[1];
      this.tableNames.push(tableName);

      // Buat alias dalam berbagai format
      this.tableAliases[tableName] = [
        tableName.toLowerCase(),
        tableName.toLowerCase().replace(/_/g, " "),
        this.toSingular(tableName).toLowerCase(),
        this.toSingular(tableName).toLowerCase().replace(/_/g, " "),
      ];

      // Alias bahasa Indonesia untuk tabel pajak/kendaraan - Samsat Kalimantan Selatan
      const indonesianAliases: Record<string, string[]> = {
        // Core Transaction Models
        tax_transactions: ["transaksi pajak", "pembayaran pajak", "bayar pajak", "setoran pajak", "penerimaan pajak", "pembayaran"],
        taxations: ["penaksiran pajak", "perhitungan pajak", "penetapan pajak", "penagihan pajak", "penetapan"],

        // Vehicle Core Models
        vehicles: ["kendaraan", "motor", "mobil", "kendaraan bermotor", "kb", "vehicle"],
        vehicle_taxes: ["pajak kendaraan", "pajak motor", "pajak mobil", "pkb", "pajak kendaraan bermotor", "nilai jual kendaraan"],
        vehicle_brands: ["merk kendaraan", "merk", "merek", "jenis kendaraan", "brand"],
        vehicle_categories: ["kategori kendaraan", "jenis kendaraan", "tipe kendaraan", "golongan kendaraan", "kategori"],
        vehicle_models: ["model kendaraan", "tipe model", "varian", "model"],
        vehicle_fuels: ["bahan bakar", "bbm", "jenis bahan bakar", "fuel"],
        vehicle_license_colors: ["warna plat", "warna nomor polisi", "plat nomor", "jenis plat", "warna plat nomor"],
        vehicle_functionalities: ["fungsi kendaraan", "kegunaan", "peruntukan", "fungsi"],
        vehicle_owner_occupations: ["pekerjaan pemilik", "profesi pemilik", "jabatan pemilik", "pekerjaan"],
        vehicle_ownership_statuses: ["status kepemilikan", "status kendaraan", "kepemilikan"],

        // Geographic Models
        provinces: ["provinsi", "propinsi", "province"],
        regencies: ["kabupaten", "kota", "daerah", "regency"],
        districts: ["kecamatan", "distrik", "district"],
        subdistricts: ["kelurahan", "desa", "subdistrict"],
        countries: ["negara", "asal negara", "country"],

        // Organizational Models
        management_units: ["unit", "unit pengelola", "up", "kantor samsat", "samsat", "unit pengelola kendaraan"],
        helper_units: ["unit bantuan", "unit pembantu", "tempat pembayaran", "pos pembayaran", "lokasi pembayaran"],
        cashiers: ["kasir", "loket", "petugas kasir", "penerima pembayaran"],
        users: ["pengguna", "petugas", "pegawai", "staf", "user"],
        admins: ["admin", "administrator", "petugas admin", "pengelola sistem"],

        // Configuration & Reference Models
        configs: ["konfigurasi", "config", "pengaturan", "setting"],
        formulas: ["rumus pajak", "formula", "kalkulasi pajak", "tarif pajak"],
        insurances: ["asuransi", "jaminan", "swdkllj"],
        permissions: ["hak akses", "wewenang", "otorisasi", "permission"],
        permission_assignments: ["penugasan hak akses", "pemberian wewenang", "assignment"],

        // Tax Administration Models
        tax_amnesties: ["pengampunan pajak", "tax amnesty", "remisi pajak", "insentif pajak"],
        tax_amnesty_license_colors: ["warna plat pengampunan", "amnesty license color"],
        public_holidays: ["hari libur", "hari libur nasional", "libur", "holiday"],

        // Activity & Logging Models
        activities: ["aktivitas", "kegiatan", "log aktivitas", "activity"],
        versions: ["versi", "riwayat perubahan", "history"],
        third_party_logs: ["log pihak ketiga", "integrasi eksternal", "third party log"],

        // Storage Models (Rails ActiveStorage)
        active_storage_attachments: ["lampiran", "file terlampir", "attachment"],
        active_storage_blobs: ["blob storage", "data file", "file blob"],
        active_storage_variant_records: ["varian file", "variant record"],

        // Junction Tables
        cashier_helper_units: ["kasir unit bantuan", "penugasan kasir"],
        user_helper_units: ["pengguna unit bantuan", "penugasan pengguna"],

        // Additional models
        ar_internal_metadata: ["metadata internal"],
        schema_migrations: ["migrasi schema", "schema migration"],
      };

      if (indonesianAliases[tableName.toLowerCase()]) {
        this.tableAliases[tableName].push(...indonesianAliases[tableName.toLowerCase()]);
      }
      match = modelRegex.exec(schema);
    }

    // Ekstrak nama kolom dari setiap model
    const modelBlockRegex = /model\s+\w+\s*\{([^}]+)\}/g;
    match = modelBlockRegex.exec(schema);
    while (match !== null) {
      const modelContent = match[1];
      const fieldRegex = /^\s+(\w+)\s+\w+/gm;
      let fieldMatch: RegExpExecArray | null = fieldRegex.exec(modelContent);
      while (fieldMatch !== null) {
        const columnName = fieldMatch[1];
        if (!["id", "createdAt", "updatedAt", "created_at", "updated_at", "deleted_at"].includes(columnName)) {
          this.columnNames.push(columnName);
        }
        fieldMatch = fieldRegex.exec(modelContent);
      }
      match = modelBlockRegex.exec(schema);
    }

    // Tambahkan kolom umum untuk sistem pajak kendaraan - Samsat Kalimantan Selatan
    this.columnNames.push(
      // Vehicle identification
      "license", "plate", "nomor", "polisi", "plat",
      "registration", "registrasi", "no polisi", "nomor polisi", "nopol",
      "skeleton", "rangka", "no rangka", "nomor rangka", "chassis",
      "engine", "mesin", "no mesin", "nomor mesin",
      "certificate", "sertifikat", "fiskal", "fiskal_no",
      "invoice", "faktur", "invoice_no", "invoice_date",

      // Owner information
      "owner", "pemilik", "kepemilikan",
      "identifier", "nik", "ktp", "identitas", "owner_identifier",
      "address", "alamat", "domisili", "owner_address",
      "phone", "telepon", "hp", "whatsapp", "owner_phone_number",
      "email", "surat elektronik", "owner_email",
      "gender", "jenis kelamin", "owner_gender",
      "occupation", "pekerjaan", "owner_occupation",

      // Vehicle details
      "brand", "merk", "merek", "vehicle_brand",
      "model", "tipe", "varian", "vehicle_model",
      "category", "kategori", "jenis", "vehicle_category",
      "color", "warna",
      "year", "tahun", "tahun pembuatan", "year_created",
      "cylinder", "silinder", "cc", "cyclinder",
      "fuel", "bahan bakar", "bbm", "vehicle_fuel",
      "functionality", "fungsi", "kegunaan", "vehicle_functionality",

      // Tax components
      "tax", "pajak", "pkb",
      "base", "pokok", "dasar", "vehicle_tax_base",
      "penalty", "denda", "sanksi",
      "insurance", "asuransi", "swdkllj",
      "title_transfer", "bbnkb", "bea balik nama",
      "opsen", "operasional",
      "tax_year", "tahun pajak", "tax_year_applied",

      // Transaction fields
      "payment", "pembayaran", "bayar",
      "amount", "jumlah", "nilai", "total_amount",
      "total", "keseluruhan",
      "status", "transaction_status",
      "channel", "payment_channel", "metode", "payment_method",
      "paid", "lunas", "verified",
      "pending", "expired", "cancelled",
      "paid_at", "tanggal bayar",
      "verify_at", "tanggal verifikasi",
      "defined_at", "tanggal penetapan",
      "expired_at", "tanggal kadaluarsa",

      // Date fields
      "date", "tanggal", "waktu",
      "license_start", "license_start_date", "tanggal mulai",
      "license_end", "license_end_date", "jatuh tempo", "tanggal berakhir",
      "taxable_date", "due_date", "tanggal pajak",
      "registration_date", "tanggal registrasi",
      "created_at", "updated_at", "deleted_at",

      // Geographic fields
      "kecamatan", "district", "district_id",
      "kabupaten", "kota", "regency", "regency_id",
      "provinsi", "province", "province_id",
      "kelurahan", "desa", "subdistrict", "subdistrict_id",
      "wilayah", "daerah", "area",

      // Organization fields
      "unit", "samsat", "kantor",
      "kasir", "loket", "cashier",
      "petugas", "officer", "user", "pengguna",
      "admin", "administrator",
      "management_unit", "management_unit_id",
      "helper_unit", "helper_unit_id",
      "eri_code", "kode eri",
      "head_of_unit", "kepala unit",
      "treasurer", "bendahara",

      // Mutation fields
      "mutasi", "mutation",
      "mutation_owner_name", "mutation_owner_address",
      "mutation_destination", "mutation_internal", "mutation_external",
      "block", "blocked_at", "block_note",

      // Additional Samsat fields
      "serial_no", "sequence_no", "nomor seri",
      "external_id", "reference_id",
      "receiver", "penerima", "receiver_id",
      "tax_officer", "officer_id",
      "place_type", "counter_type",
    );
  }

  // Ubah plural ke singular (sederhana)
  private toSingular(plural: string): string {
    if (plural.endsWith("ies")) {
      return plural.slice(0, -3) + "y";
    }
    if (plural.endsWith("s")) {
      return plural.slice(0, -1);
    }
    return plural;
  }

  // Validasi apakah pertanyaan user berkaitan dengan database schema
  validateContext(userQuestion: string): ValidationResult {
    const question = userQuestion.toLowerCase();

    if (!question || question.trim().length < 3) {
      return {
        isValid: false,
        reason:
          "Pertanyaan terlalu pendek atau kosong. Silakan ajukan pertanyaan yang lebih spesifik tentang data.",
        confidence: "low",
      };
    }

    // Kata kunci yang tidak relevan
    const irrelevantKeywords = [
      "cuaca",
      "politik",
      "olahraga",
      "berita",
      "resep",
      "lagu",
      "film",
      "musik",
      "game",
      "travel",
      "health",
      "medical",
      "doctor",
      "hospital",
    ];

    for (const keyword of irrelevantKeywords) {
      if (fuzzyMatch(question, keyword)) {
        return {
          isValid: false,
          reason: `Pertanyaan Anda tentang "${keyword}" tidak dapat dijawab. Sistem ini hanya dapat menjawab pertanyaan terkait data pajak kendaraan.`,
          confidence: "high",
        };
      }
    }

    // Cek match dengan tabel
    const matchedTables: string[] = [];
    for (const tableName of this.tableNames) {
      const aliases = this.tableAliases[tableName] || [];
      const patterns = [
        tableName.toLowerCase(),
        ...aliases.map((a) => a.toLowerCase()),
      ];

      for (const pattern of patterns) {
        if (fuzzyMatch(question, pattern)) {
          if (!matchedTables.includes(tableName)) {
            matchedTables.push(tableName);
          }
          break;
        }
      }
    }

    // Cek match dengan kolom
    let matchedColumns = 0;
    for (const columnName of this.columnNames) {
      if (fuzzyMatch(question, columnName.toLowerCase())) {
        matchedColumns++;
      }
    }

    // Kata kunci bisnis untuk sistem pajak kendaraan - Samsat Kalimantan Selatan
    const businessKeywords = [
      // General query keywords
      "tampilkan", "show", "display", "list", "daftar", "lihat", "view",
      "semua", "all", "total", "jumlah", "rata", "average", "count",
      "terbanyak", "tertinggi", "terendah", "terakhir", "top", "best", "worst",
      "perbandingan", "comparison", "vs", "versus",
      "trend", "tren", "perkembangan", "pertumbuhan", "growth",
      "persen", "percentage", "persentase",
      "bulan", "minggu", "tahun", "hari", "tanggal", "waktu",

      // Vehicle-specific keywords
      "kendaraan", "vehicle", "motor", "mobil", "plat", "nomor polisi",
      "license", "plate", "registration", "registrasi", "pemilik", "owner",
      "merk", "brand", "tipe", "type", "model", "tahun", "year",
      "warna", "color", "mesin", "engine", "rangka", "chassis", "skeleton",
      "no rangka", "no mesin", "nomor rangka", "nomor mesin",
      "nomor polisi", "nopol", "plat nomor", "tnkb",
      "stnk", "bpkb", "sertifikat", "fiskal",

      // Tax-specific keywords - Samsat
      "pajak", "tax", "bayar", "payment", "pembayaran", "lunas",
      "pkb", "pajak kendaraan bermotor", "bbnkb", "bea balik nama",
      "swdkllj", "swdkllj", "asuransi", "insurance",
      "opsen", "operasional", "denda", "penalty", "sanksi",
      "pokok", "base", "bea balik nama", "title transfer",
      "pajak kendaraan", "pajak motor", "pajak mobil",
      "perpanjangan", "perpanjang", "renewal", "perpanjangan stnk",
      "jatuh tempo", "due date", "expired", "kedaluwarsa", "telat",
      "tunggakan", "arrears", "tunggak", "menunggak",

      // Payment keywords
      "kasir", "cashier", "loket", "counter", "channel",
      "setoran", "deposit", "transfer", "tunai", "cash",
      "verified", "terverifikasi", "confirmed", "konfirmasi",
      "pending", "diproses", "complete", "selesai",
      "payment method", "metode pembayaran", "payment channel",
      "bank", "online", "mobile", "atm", "tellering",

      // Geographic keywords - Kalimantan Selatan
      "kecamatan", "district", "kabupaten", "regency", "kota", "city",
      "provinsi", "province", "wilayah", "area", "daerah",
      "kelurahan", "desa", "subdistrict", "village",
      "kalimantan selatan", "kalsel", "banjarmasin", "banjarbaru",
      "da", "plat da", "kode plat da",

      // Organizational keywords
      "unit", "samsat", "kantor", "office", "branch",
      "petugas", "officer", "staf", "staff", "pegawai",
      "admin", "administrator", "user", "pengguna",
      "up", "unit pengelola", "unit bantuan", "helper unit",
      "eri", "electronic registration", "kode eri",

      // Status keywords
      "aktif", "active", "blocked", "terblokir", "status",
      "pending", "complete", "selesai", "diproses",
      "mutasi", "mutation", "transfer", "perpindahan",
      "dinas", "pribadi", "umum", "publik",

      // Analysis keywords
      "pendapatan", "revenue", "penerimaan", "income",
      "ranking", "peringkat", "rank", "sort", "urutkan",
      "group", "kelompokkan", "kategori", "category",
      "grafik", "chart", "diagram", "visualisasi",
      "laporan", "report", "rekap", "rekapitulasi",
      "performa", "kinerja", "performance", "produktivitas",

      // Question words
      "siapa", "apa", "berapa", "bagaimana", "kapan",
      "where", "what", "how", "how many", "how much",
      "cari", "find", "search", "filter", "sort",

      // Time-based queries
      "hari ini", "today", "kemarin", "yesterday",
      "minggu ini", "this week", "bulan ini", "this month",
      "tahun ini", "this year", "terbaru", "latest",
      "terlama", "oldest", "terakhir", "last",
      "triwulan", "quarter", "semester", "semester",

      // Vehicle document keywords
      "stnk", "surat tanda nomor kendaraan",
      "bpkb", "buku pemilik kendaraan bermotor",
      "faktur", "invoice", "kwitansi", "receipt",
      "skpd", "surat ketetapan pajak daerah",
    ];

    let matchedBusinessKeywords = 0;
    for (const keyword of businessKeywords) {
      if (fuzzyMatch(question, keyword)) {
        matchedBusinessKeywords++;
      }
    }

    if (matchedTables.length > 0) {
      return {
        isValid: true,
        matchedTables,
        confidence: "high",
      };
    }

    if (matchedColumns > 0 && matchedBusinessKeywords >= 1) {
      return {
        isValid: true,
        matchedTables: [],
        confidence: "medium",
      };
    }

    if (matchedBusinessKeywords >= 1) {
      return {
        isValid: true,
        matchedTables: [],
        confidence: "low",
      };
    }

    return {
      isValid: false,
      reason:
        "Pertanyaan Anda tidak terkait dengan data yang tersedia dalam database. Silakan ajukan pertanyaan tentang pajak kendaraan, pembayaran, kasir, atau data terkait.",
      matchedTables: [],
      confidence: "low",
    };
  }

  // Dapatkan daftar tabel yang tersedia
  getAvailableTables(): string[] {
    return [...this.tableNames];
  }

  // Deskripsi singkat setiap tabel untuk table selection prompt
  private tableDescriptions: Record<string, string> = {
    active_storage_attachments: "Lampiran/file terlampir",
    active_storage_blobs: "Blob storage data file",
    active_storage_variant_records: "Varian file",
    activities: "Log aktivitas sistem",
    admins: "Administrator sistem",
    ar_internal_metadata: "Metadata internal Rails",
    cashier_helper_units: "Penugasan kasir ke unit bantuan",
    cashiers: "Kasir/petugas penerima pembayaran",
    configs: "Konfigurasi sistem (tarif pajak, diskon, persentase)",
    countries: "Negara asal kendaraan",
    districts: "Kecamatan",
    formulas: "Rumus perhitungan pajak per warna plat",
    helper_units: "Unit bantuan/lokasi pembayaran (pos, counter)",
    insurances: "Perusahaan asuransi (SWDKLLJ)",
    management_units: "Unit pengelola/kantor SAMSAT",
    permission_assignments: "Penugasan hak akses",
    permissions: "Daftar hak akses/wewenang",
    provinces: "Provinsi",
    public_holidays: "Hari libur nasional",
    regencies: "Kabupaten/kota",
    schema_migrations: "Riwayat migrasi database",
    subdistricts: "Kelurahan/desa",
    tax_amnesties: "Program pengampunan pajak",
    tax_amnesty_license_colors: "Warna plat yang mendapat amnesty",
    tax_transactions: "Transaksi pembayaran pajak (PKB, BBNKB, SWDKLLJ, OPSEN)",
    taxations: "Penetapan/penaksiran pajak",
    third_party_logs: "Log integrasi pihak ketiga",
    user_helper_units: "Penugasan pengguna ke unit bantuan",
    users: "Pengguna/petugas sistem",
    vehicle_brands: "Merk kendaraan (Honda, Toyota, dll)",
    vehicle_categories: "Kategori jenis kendaraan (sedan, pickup, bus, dll)",
    vehicle_fuels: "Jenis bahan bakar (bensin, diesel, dll)",
    vehicle_functionalities: "Fungsi/kegunaan kendaraan",
    vehicle_license_colors: "Warna plat nomor (putih, kuning, merah)",
    vehicle_models: "Model kendaraan",
    vehicle_owner_occupations: "Pekerjaan/profesi pemilik kendaraan",
    vehicle_ownership_statuses: "Status kepemilikan kendaraan",
    vehicle_taxes: "Perhitungan pajak kendaraan (nilai jual, PKB per warna plat)",
    vehicles: "Data kendaraan bermotor (pemilik, nopol, rangka, mesin, dll)",
    versions: "Riwayat perubahan data (audit log)",
  };

  /**
   * Generate daftar ringkas semua tabel untuk table selection prompt.
   * Format: "nama_tabel — Deskripsi (kolom_penting, ...)"
   * Output ~800-1000 tokens untuk 42 tabel.
   */
  getTableSummaries(): string {
    const schema = this.getRawSchema();
    const modelRegex = /model\s+(\w+)\s*\{([^}]+)\}/g;
    const lines: string[] = [];
    let modelMatch: RegExpExecArray | null = modelRegex.exec(schema);

    while (modelMatch !== null) {
      const modelName = modelMatch[1];
      const modelContent = modelMatch[2];

      const mapTableMatch = modelContent.match(/@@map\("(\w+)"\)/);
      const tableName = mapTableMatch ? mapTableMatch[1] : modelName.toLowerCase();
      const description = this.tableDescriptions[tableName] || modelName;

      // Ekstrak kolom penting (max 6, skip id/timestamps/deleted_at/relation fields)
      const columns: string[] = [];
      const linesModel = modelContent.split("\n");
      for (const line of linesModel) {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine.startsWith("@@") || trimmedLine.startsWith("//")) continue;

        const fieldMatch = trimmedLine.match(/^(\w+)\s+(\w+)(.*)$/);
        if (!fieldMatch) continue;

        const fieldName = fieldMatch[1];
        const fieldType = fieldMatch[2];

        if (
          ["id", "createdAt", "updatedAt", "created_at", "updated_at", "deleted_at"].includes(fieldName) ||
          this.isRelationField(fieldType)
        ) {
          continue;
        }

        const mapMatch = fieldMatch[3].match(/@map\("(\w+)"\)/);
        const colName = mapMatch ? mapMatch[1] : fieldName;
        columns.push(colName);
        if (columns.length >= 6) break;
      }

      lines.push(`${tableName} — ${description} (${columns.join(", ")})`);
      modelMatch = modelRegex.exec(schema);
    }

    return lines.join("\n");
  }

  /**
   * Dari tabel terpilih, cari semua tabel yang terhubung via foreign key.
   * Menyertakan parent dan child tables (1 hop).
   */
  findRelatedTables(selectedTables: string[]): string[] {
    const schema = this.getRawSchema();
    const normalized = selectedTables.map((t) => t.toLowerCase());
    const related = new Set<string>(normalized);

    // Build map: modelName → tableName
    const modelToTable: Record<string, string> = {};
    const tableToModel: Record<string, string> = {};
    const modelRegex = /model\s+(\w+)\s*\{([^}]+)\}/g;
    let modelMatch: RegExpExecArray | null = modelRegex.exec(schema);
    while (modelMatch !== null) {
      const modelName = modelMatch[1];
      const modelContent = modelMatch[2];
      const mapMatch = modelContent.match(/@@map\("(\w+)"\)/);
      const tableName = mapMatch ? mapMatch[1] : modelName.toLowerCase();
      modelToTable[modelName] = tableName;
      tableToModel[tableName] = modelName;
      modelMatch = modelRegex.exec(schema);
    }

    // Parse all FK relations by finding lines with @relation + field type (model name)
    // Prisma format: "field_name  TargetModel?  @relation(fields: [field_name], references: [id], ...)"
    const relations: Array<{ fromModel: string; toModel: string }> = [];
    const relationModelRegex = /model\s+(\w+)\s*\{([^}]+)\}/g;
    modelMatch = relationModelRegex.exec(schema);
    while (modelMatch !== null) {
      const modelName = modelMatch[1];
      const modelContent = modelMatch[2];
      // Match field lines that have a relation: "fieldName  ModelName  @relation(...)"
      const fieldRelRegex = /^\s+(\w+)\s+(\w+)\??\s+@relation\(/gm;
      let fieldMatch: RegExpExecArray | null;
      while ((fieldMatch = fieldRelRegex.exec(modelContent)) !== null) {
        const fieldType = fieldMatch[2];
        // fieldType is the target model name (e.g. "vehicles", "cashiers")
        if (fieldType !== modelName && modelToTable[fieldType]) {
          relations.push({ fromModel: modelName, toModel: fieldType });
        }
      }
      modelMatch = relationModelRegex.exec(schema);
    }

    // For each selected table, find FK parents and children
    for (const tableName of normalized) {
      const modelName = tableToModel[tableName];
      if (!modelName) continue;

      for (const rel of relations) {
        // This table references another (parent)
        if (rel.fromModel === modelName) {
          const parentTable = modelToTable[rel.toModel];
          if (parentTable) related.add(parentTable);
        }
        // Another table references this one (child)
        if (rel.toModel === modelName) {
          const childTable = modelToTable[rel.fromModel];
          if (childTable) related.add(childTable);
        }
      }
    }

    return [...related];
  }

  /**
   * Generate schema description hanya untuk tabel yang dipilih.
   * Sama seperti getSQLSchemaDescription() tapi difilter.
   */
  getFilteredSchemaDescription(tableNames: string[]): string {
    const schema = this.getRawSchema();
    const normalizedTables = new Set(tableNames.map((t) => t.toLowerCase()));
    const tables: string[] = [];
    const relations: string[] = [];

    const modelRegex = /model\s+(\w+)\s*\{([^}]+)\}/g;
    let modelMatch: RegExpExecArray | null = modelRegex.exec(schema);

    while (modelMatch !== null) {
      const modelName = modelMatch[1];
      const modelContent = modelMatch[2];

      const mapTableMatch = modelContent.match(/@@map\("(\w+)"\)/);
      const tableName = mapTableMatch ? mapTableMatch[1] : modelName.toLowerCase();

      // Skip tables not in selection
      if (!normalizedTables.has(tableName)) {
        modelMatch = modelRegex.exec(schema);
        continue;
      }

      const fields: string[] = [];
      const lines = modelContent.split("\n");

      const fieldMappings: Record<string, { columnName: string; type: string; attrs: string }> = {};

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine.startsWith("@@") || trimmedLine.startsWith("//")) continue;

        const fieldMatch = trimmedLine.match(/^(\w+)\s+(\w+)(.*)$/);
        if (fieldMatch) {
          const fieldName = fieldMatch[1];
          const fieldType = fieldMatch[2];
          const attributes = fieldMatch[3];

          if (this.isRelationField(fieldType)) continue;

          const mapColumnMatch = attributes.match(/@map\("(\w+)"\)/);
          const columnName = mapColumnMatch ? mapColumnMatch[1] : fieldName;

          fieldMappings[fieldName] = { columnName, type: fieldType, attrs: attributes };
        }
      }

      for (const [fieldName, { columnName, type, attrs }] of Object.entries(fieldMappings)) {
        const sqlType = this.prismaTypeToSQL(type);

        let constraints = "";
        if (attrs.includes("@id")) constraints = " PRIMARY KEY";
        else if (attrs.includes("@unique")) constraints = " UNIQUE";

        let defaultValue = "";
        const defaultIndex = attrs.indexOf("@default(");
        if (defaultIndex !== -1) {
          const start = defaultIndex + 9;
          let depth = 1;
          let end = start;
          while (end < attrs.length && depth > 0) {
            if (attrs[end] === "(") depth++;
            else if (attrs[end] === ")") depth--;
            end++;
          }
          defaultValue = attrs.substring(start, end - 1);
          if (!defaultValue.includes("autoincrement()") && !defaultValue.includes("now()")) {
            defaultValue = defaultValue.replace(/"/g, "'");
            constraints += ` DEFAULT ${defaultValue}`;
          }
        }

        const relationDefMatch = modelContent.match(
          new RegExp(`(\\w+)\\s+(\\w+)\\s+@relation\\(fields:\\s*\\[${fieldName}\\],\\s*references:\\s*\\[(\\w+)\\]\\)`)
        );
        if (relationDefMatch) {
          const [, , refModelName, refField] = relationDefMatch;
          const refModelDefMatch = schema.match(new RegExp(`model\\s+${refModelName}\\s*\\{([^}]+)\\}`));
          if (refModelDefMatch) {
            const refModelContent = refModelDefMatch[1];
            const refTableMapMatch = refModelContent.match(/@@map\("(\w+)"\)/);
            const refTableName = refTableMapMatch ? refTableMapMatch[1] : refModelName.toLowerCase();
            constraints = ` REFERENCES ${refTableName}(${refField})`;
          }
        }

        fields.push(`  - ${columnName.padEnd(24)} ${sqlType}${constraints}`);
      }

      if (fields.length > 0) {
        tables.push(`TABLE: ${tableName}\n${fields.join("\n")}`);
      }
      modelMatch = modelRegex.exec(schema);
    }

    // Extract relations only for selected tables
    const relationRegex = /model\s+(\w+)\s*\{([^}]+)\}/g;
    modelMatch = relationRegex.exec(schema);
    while (modelMatch !== null) {
      const modelName = modelMatch[1];
      const modelContent = modelMatch[2];

      const mapTableMatch = modelContent.match(/@@map\("(\w+)"\)/);
      const tableName = mapTableMatch ? mapTableMatch[1] : modelName.toLowerCase();

      if (!normalizedTables.has(tableName)) {
        modelMatch = relationRegex.exec(schema);
        continue;
      }

      const relationDefRegex = /(\w+)\s+(\w+)\s+@relation\(fields:\s*\[(\w+)\],\s*references:\s*\[(\w+)\]\)/g;
      let relMatch: RegExpExecArray | null = relationDefRegex.exec(modelContent);

      while (relMatch !== null) {
        const [, , refModel, fkFieldName, refFieldName] = relMatch;

        const fkFieldMatch = modelContent.match(new RegExp(`${fkFieldName}\\s+\\w+\\s+.*?@map\\("(\\w+)"\\)`));
        const fkColumn = fkFieldMatch ? fkFieldMatch[1] : fkFieldName;

        const refModelDefMatch = schema.match(new RegExp(`model\\s+${refModel}\\s*\\{([^}]+)\\}`));
        if (refModelDefMatch) {
          const refModelContent = refModelDefMatch[1];
          const refTableMatch = refModelContent.match(/@@map\("(\w+)"\)/);
          const refTableName = refTableMatch ? refTableMatch[1] : refModel.toLowerCase();

          relations.push(`${refTableName} (1) → ${tableName} (N)  via ${tableName}.${fkColumn}`);
        }
        relMatch = relationDefRegex.exec(modelContent);
      }
      modelMatch = relationRegex.exec(schema);
    }

    const uniqueRelations = [...new Set(relations)];

    let result = tables.join("\n\n");
    if (uniqueRelations.length > 0) {
      result += "\n\nRelasi:\n  - " + uniqueRelations.join("\n  - ");
    }

    return result;
  }

  // Dapatkan daftar kolom yang tersedia
  getAvailableColumns(): string[] {
    return [...this.columnNames];
  }

  // Parse Prisma schema dan generate SQL table descriptions
  getSQLSchemaDescription(): string {
    const schema = this.getRawSchema();
    const tables: string[] = [];
    const relations: string[] = [];

    const modelRegex = /model\s+(\w+)\s*\{([^}]+)\}/g;
    let modelMatch: RegExpExecArray | null = modelRegex.exec(schema);

    while (modelMatch !== null) {
      const modelName = modelMatch[1];
      const modelContent = modelMatch[2];

      const mapTableMatch = modelContent.match(/@@map\("(\w+)"\)/);
      const tableName = mapTableMatch ? mapTableMatch[1] : modelName.toLowerCase();

      const fields: string[] = [];
      const lines = modelContent.split("\n");

      const fieldMappings: Record<string, { columnName: string; type: string; attrs: string }> = {};

      for (const line of lines) {
        const trimmedLine = line.trim();

        if (
          !trimmedLine ||
          trimmedLine.startsWith("@@") ||
          trimmedLine.startsWith("//")
        ) {
          continue;
        }

        const fieldMatch = trimmedLine.match(/^(\w+)\s+(\w+)(.*)$/);
        if (fieldMatch) {
          const fieldName = fieldMatch[1];
          const fieldType = fieldMatch[2];
          const attributes = fieldMatch[3];

          if (this.isRelationField(fieldType)) {
            continue;
          }

          const mapColumnMatch = attributes.match(/@map\("(\w+)"\)/);
          const columnName = mapColumnMatch ? mapColumnMatch[1] : fieldName;

          fieldMappings[fieldName] = {
            columnName,
            type: fieldType,
            attrs: attributes
          };
        }
      }

      for (const [fieldName, { columnName, type, attrs }] of Object.entries(fieldMappings)) {
        const sqlType = this.prismaTypeToSQL(type);

        let constraints = "";
        if (attrs.includes("@id")) {
          constraints = " PRIMARY KEY";
        } else if (attrs.includes("@unique")) {
          constraints = " UNIQUE";
        }

        let defaultValue = "";
        const defaultIndex = attrs.indexOf("@default(");
        if (defaultIndex !== -1) {
          const start = defaultIndex + 9;
          let depth = 1;
          let end = start;
          while (end < attrs.length && depth > 0) {
            if (attrs[end] === '(') depth++;
            else if (attrs[end] === ')') depth--;
            end++;
          }
          defaultValue = attrs.substring(start, end - 1);

          if (!defaultValue.includes("autoincrement()") && !defaultValue.includes("now()")) {
            defaultValue = defaultValue.replace(/"/g, "'");
            constraints += ` DEFAULT ${defaultValue}`;
          }
        }

        const relationDefMatch = modelContent.match(
          new RegExp(`(\\w+)\\s+(\\w+)\\s+@relation\\(fields:\\s*\\[${fieldName}\\],\\s*references:\\s*\\[(\\w+)\\]\\)`)
        );
        if (relationDefMatch) {
          const [, , refModelName, refField] = relationDefMatch;
          const refModelDefMatch = schema.match(new RegExp(`model\\s+${refModelName}\\s*\\{([^}]+)\\}`));
          if (refModelDefMatch) {
            const refModelContent = refModelDefMatch[1];
            const refTableMapMatch = refModelContent.match(/@@map\("(\w+)"\)/);
            const refTableName = refTableMapMatch ? refTableMapMatch[1] : refModelName.toLowerCase();
            constraints = ` REFERENCES ${refTableName}(${refField})`;
          }
        }

        fields.push(`  - ${columnName.padEnd(24)} ${sqlType}${constraints}`);
      }

      if (fields.length > 0) {
        tables.push(`TABLE: ${tableName}\n${fields.join("\n")}`);
      }
      modelMatch = modelRegex.exec(schema);
    }

    const relationRegex = /model\s+(\w+)\s*\{([^}]+)\}/g;
    modelMatch = relationRegex.exec(schema);
    while (modelMatch !== null) {
      const modelName = modelMatch[1];
      const modelContent = modelMatch[2];

      const mapTableMatch = modelContent.match(/@@map\("(\w+)"\)/);
      const tableName = mapTableMatch ? mapTableMatch[1] : modelName.toLowerCase();

      const relationDefRegex = /(\w+)\s+(\w+)\s+@relation\(fields:\s*\[(\w+)\],\s*references:\s*\[(\w+)\]\)/g;
      let relMatch: RegExpExecArray | null = relationDefRegex.exec(modelContent);

      while (relMatch !== null) {
        const [, , refModel, fkFieldName, refFieldName] = relMatch;

        const fkFieldMatch = modelContent.match(new RegExp(`${fkFieldName}\\s+\\w+\\s+.*?@map\\("(\\w+)"\\)`));
        const fkColumn = fkFieldMatch ? fkFieldMatch[1] : fkFieldName;

        const refModelDefMatch = schema.match(new RegExp(`model\\s+${refModel}\\s*\\{([^}]+)\\}`));
        if (refModelDefMatch) {
          const refModelContent = refModelDefMatch[1];
          const refTableMatch = refModelContent.match(/@@map\("(\w+)"\)/);
          const refTableName = refTableMatch ? refTableMatch[1] : refModel.toLowerCase();

          relations.push(`${refTableName} (1) → ${tableName} (N)  via ${tableName}.${fkColumn}`);
        }
        relMatch = relationDefRegex.exec(modelContent);
      }
      modelMatch = relationRegex.exec(schema);
    }

    const uniqueRelations = [...new Set(relations)];

    let result = tables.join("\n\n");
    if (uniqueRelations.length > 0) {
      result += "\n\nRelasi:\n  - " + uniqueRelations.join("\n  - ");
    }

    return result;
  }

  private isRelationField(type: string): boolean {
    const primitiveTypes = ['Int', 'String', 'Float', 'Boolean', 'DateTime', 'Decimal', 'BigInt', 'Json'];
    return !primitiveTypes.includes(type) && type[0] === type[0].toUpperCase() && !type.includes('[]');
  }

  private prismaTypeToSQL(prismaType: string): string {
    const typeMap: Record<string, string> = {
      Int: "INTEGER",
      String: "TEXT",
      Boolean: "BOOLEAN",
      Float: "FLOAT",
      DateTime: "TIMESTAMP",
      Decimal: "DECIMAL",
      BigInt: "BIGINT",
      Json: "JSONB",
    };
    return typeMap[prismaType] || prismaType.toUpperCase();
  }
}

export const querySchemaExtractor = new QuerySchemaExtractor();
