import fs from "fs";
import path from "path";

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
  if (word.length <= 4) return 0; // kata pendek: harus exact
  if (word.length <= 7) return 1; // 5-7 karakter: 1 kesalahan
  return 2;                        // ≥8 karakter: 2 kesalahan
}

// Cek apakah token dalam question cocok (fuzzy) dengan keyword
function fuzzyMatch(question: string, keyword: string): boolean {
  if (question.includes(keyword)) return true;
  // Tokenize question by non-word boundaries to avoid partial word false positives
  const tokens = question.split(/\s+/);
  const tolerance = maxTypoTolerance(keyword);
  if (tolerance === 0) return false;
  return tokens.some((token) => levenshtein(token, keyword) <= tolerance);
}

export class SchemaExtractor {
  private schemaPath: string;
  private tableNames: string[] = [];
  private columnNames: string[] = [];
  private tableAliases: Record<string, string[]> = {};

  constructor() {
    this.schemaPath = path.join(process.cwd(), "prisma/schema.prisma");
    this.extractSchemaInfo();
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
    const modelsOnly = this.getModelsOnly();
    // This removes excess whitespace and comments, leaving only structure
    return modelsOnly
      .replace(/\/\/.*$/gm, "") // Remove comments
      .replace(/\n\s*\n/g, "\n") // Remove empty lines
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
      
      // Tambahkan alias bahasa Indonesia untuk tabel tertentu
      const indonesianAliases: Record<string, string[]> = {
        products: ["produk", "barang"],
        users: ["pengguna", "user", "pelanggan"],
        orders: ["pesanan", "order", "pembelian", "transaksi"],
        order_items: ["item pesanan", "detail pesanan"],
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
      // Ekstrak field names (baris yang berisi tipe data)
      const fieldRegex = /^\s+(\w+)\s+\w+/gm;
      let fieldMatch: RegExpExecArray | null = fieldRegex.exec(modelContent);
      while (fieldMatch !== null) {
        const columnName = fieldMatch[1];
        if (!["id", "createdAt", "updatedAt"].includes(columnName)) {
          this.columnNames.push(columnName);
        }
        fieldMatch = fieldRegex.exec(modelContent);
      }
      match = modelBlockRegex.exec(schema);
    }

    // Tambahkan kolom-kolom umum yang sering ditanyakan
    this.columnNames.push(
      "total",
      "amount",
      "price",
      "quantity",
      "revenue",
      "sales",
      "user",
      "product",
      "order",
      "category",
      "status",
      "date",
      "name",
      "email",
      "role",
      "stock",
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

    // Cek apakah pertanyaan kosong atau terlalu pendek
    if (!question || question.trim().length < 3) {
      return {
        isValid: false,
        reason:
          "Pertanyaan terlalu pendek atau kosong. Silakan ajukan pertanyaan yang lebih spesifik tentang data.",
        confidence: "low",
      };
    }

    // Kata kunci yang menunjukkan pertanyaan tidak relevan
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
      "sekolah",
      "universitas",
      "pendidikan umum",
    ];

    for (const keyword of irrelevantKeywords) {
      if (fuzzyMatch(question, keyword)) {
        return {
          isValid: false,
          reason: `Pertanyaan Anda tentang "${keyword}" tidak dapat dijawab. Sistem ini hanya dapat menjawab pertanyaan terkait data bisnis (penjualan, produk, pengguna, dan order).`,
          confidence: "high",
        };
      }
    }

    // Cek apakah ada kata kunci yang relate dengan tabel yang ada
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

    // Cek apakah ada kata kunci yang relate dengan kolom
    let matchedColumns = 0;
    for (const columnName of this.columnNames) {
      if (fuzzyMatch(question, columnName.toLowerCase())) {
        matchedColumns++;
      }
    }

    // Kata kunci bisnis umum yang menunjukkan intent analitik
    const businessKeywords = [
      "tampilkan",
      "show",
      "display",
      "list",
      "daftar",
      "lihat",
      "view",
      "semua",
      "all",
      "total",
      "jumlah",
      "rata",
      "average",
      "count",
      "terbanyak",
      "tertinggi",
      "terendah",
      "terakhir",
      "top",
      "best",
      "worst",
      "perbandingan",
      "comparison",
      "vs",
      "versus",
      "trend",
      "tren",
      "perkembangan",
      "pertumbuhan",
      "growth",
      "persen",
      "percentage",
      "persentase",
      "bulan",
      "minggu",
      "tahun",
      "hari",
      "tanggal",
      "waktu",
      "kategori",
      "category",
      "jenis",
      "tipe",
      "status",
      "lunas",
      "belum",
      "pending",
      "batal",
      "customer",
      "pelanggan",
      "pembeli",
      "user",
      "pengguna",
      "produk",
      "product",
      "barang",
      "item",
      "order",
      "pesanan",
      "pembelian",
      "transaksi",
      "penjualan",
      "jual",
      "beli",
      "harga",
      "price",
      "biaya",
      "cost",
      "revenue",
      "pendapatan",
      "stock",
      "stok",
      "inventory",
      "gudang",
      "branch",
      "cabang",
      "lokasi",
      "tempat",
      "ranking",
      "peringkat",
      "rank",
      "siapa",
      "apa",
      "berapa",
      "bagaimana",
      "kapan",
      "where",
      "what",
      "how",
      "how many",
      "how much",
      "dibuat",
      "created",
      "baru",
      "latest",
      "recent",
      "cari",
      "find",
      "search",
      "filter",
      "sort",
      "urutkan",
      "group",
      "kelompokkan",
    ];

    let matchedBusinessKeywords = 0;
    for (const keyword of businessKeywords) {
      if (fuzzyMatch(question, keyword)) {
        matchedBusinessKeywords++;
      }
    }

    // Logika validasi
    // 1. Jika ada match dengan tabel → VALID
    if (matchedTables.length > 0) {
      return {
        isValid: true,
        matchedTables,
        confidence: "high",
      };
    }

    // 2. Jika ada match dengan kolom + business keywords → VALID
    if (matchedColumns > 0 && matchedBusinessKeywords >= 1) {
      return {
        isValid: true,
        matchedTables: [],
        confidence: "medium",
      };
    }

    // 3. Jika ada minimal 1 business keyword yang kuat → VALID
    //    (untuk pertanyaan sederhana seperti "tampilkan semua produk")
    if (matchedBusinessKeywords >= 1) {
      return {
        isValid: true,
        matchedTables: [],
        confidence: "low",
      };
    }

    // 4. Jika tidak ada match sama sekali → INVALID
    return {
      isValid: false,
      reason:
        "Pertanyaan Anda tidak terkait dengan data yang tersedia dalam database. Silakan ajukan pertanyaan tentang penjualan, produk, pengguna, order, atau transaksi.",
      matchedTables: [],
      confidence: "low",
    };
  }

  // Dapatkan daftar tabel yang tersedia
  getAvailableTables(): string[] {
    return [...this.tableNames];
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

    // Extract all models
    const modelRegex = /model\s+(\w+)\s*\{([^}]+)\}/g;
    let modelMatch: RegExpExecArray | null = modelRegex.exec(schema);

    while (modelMatch !== null) {
      const modelName = modelMatch[1];
      const modelContent = modelMatch[2];

      // Get table name from @@map directive
      const mapTableMatch = modelContent.match(/@@map\("(\w+)"\)/);
      const tableName = mapTableMatch ? mapTableMatch[1] : modelName.toLowerCase();

      // Extract fields
      const fields: string[] = [];
      const lines = modelContent.split("\n");
      
      // First pass: collect all fields and their mappings
      const fieldMappings: Record<string, { columnName: string; type: string; attrs: string }> = {};
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        
        // Skip directives and empty lines
        if (
          !trimmedLine ||
          trimmedLine.startsWith("@@") ||
          trimmedLine.startsWith("//")
        ) {
          continue;
        }

        // Match field definitions: fieldName Type @attributes
        const fieldMatch = trimmedLine.match(/^(\w+)\s+(\w+)(.*)$/);
        if (fieldMatch) {
          const fieldName = fieldMatch[1];
          const fieldType = fieldMatch[2];
          const attributes = fieldMatch[3];

          // Skip relation fields (capitalized type that's not a primitive)
          if (this.isRelationField(fieldType)) {
            continue;
          }

          // Get SQL column name from @map directive
          const mapColumnMatch = attributes.match(/@map\("(\w+)"\)/);
          const columnName = mapColumnMatch ? mapColumnMatch[1] : fieldName;

          fieldMappings[fieldName] = {
            columnName,
            type: fieldType,
            attrs: attributes
          };
        }
      }

      // Second pass: build field descriptions
      for (const [fieldName, { columnName, type, attrs }] of Object.entries(fieldMappings)) {
        const sqlType = this.prismaTypeToSQL(type);

        let constraints = "";
        if (attrs.includes("@id")) {
          constraints = " PRIMARY KEY";
        } else if (attrs.includes("@unique")) {
          constraints = " UNIQUE";
        }

        // Check for default value - handle nested parentheses
        let defaultValue = "";
        const defaultIndex = attrs.indexOf("@default(");
        if (defaultIndex !== -1) {
          const start = defaultIndex + 9; // length of "@default("
          let depth = 1;
          let end = start;
          while (end < attrs.length && depth > 0) {
            if (attrs[end] === '(') depth++;
            else if (attrs[end] === ')') depth--;
            end++;
          }
          defaultValue = attrs.substring(start, end - 1);
          
          // Skip function defaults like autoincrement() and now()
          if (!defaultValue.includes("autoincrement()") && !defaultValue.includes("now()")) {
            defaultValue = defaultValue.replace(/"/g, "'");
            constraints += ` DEFAULT ${defaultValue}`;
          }
        }

        // Check if this field is referenced by a relation
        // Find the relation definition that references this field
        const relationDefMatch = modelContent.match(
          new RegExp(`(\\w+)\\s+(\\w+)\\s+@relation\\(fields:\\s*\\[${fieldName}\\],\\s*references:\\s*\\[(\\w+)\\]\\)`)
        );
        if (relationDefMatch) {
          const [, , refModelName, refField] = relationDefMatch;
          // Find the referenced model's table name
          const refModelDefMatch = schema.match(new RegExp(`model\\s+${refModelName}\\s*\\{([^}]+)\\}`));
          if (refModelDefMatch) {
            const refModelContent = refModelDefMatch[1];
            const refTableMapMatch = refModelContent.match(/@@map\("(\w+)"\)/);
            const refTableName = refTableMapMatch ? refTableMapMatch[1] : refModelName.toLowerCase();
            constraints = ` REFERENCES ${refTableName}(${refField})`;
          }
        }

        fields.push(`  - ${columnName.padEnd(14)} ${sqlType}${constraints}`);
      }

      if (fields.length > 0) {
        tables.push(`TABLE: ${tableName}\n${fields.join("\n")}`);
      }
      modelMatch = modelRegex.exec(schema);
    }

    // Extract relations
    const relationRegex = /model\s+(\w+)\s*\{([^}]+)\}/g;
    modelMatch = relationRegex.exec(schema);
    while (modelMatch !== null) {
      const modelName = modelMatch[1];
      const modelContent = modelMatch[2];
      
      const mapTableMatch = modelContent.match(/@@map\("(\w+)"\)/);
      const tableName = mapTableMatch ? mapTableMatch[1] : modelName.toLowerCase();

      // Find all relation definitions
      const relationDefRegex = /(\w+)\s+(\w+)\s+@relation\(fields:\s*\[(\w+)\],\s*references:\s*\[(\w+)\]\)/g;
      let relMatch: RegExpExecArray | null = relationDefRegex.exec(modelContent);
      
      while (relMatch !== null) {
        const [, , refModel, fkFieldName, refFieldName] = relMatch;
        
        // Get the mapped column name for the FK field
        const fkFieldMatch = modelContent.match(new RegExp(`${fkFieldName}\\s+\\w+\\s+.*?@map\\("(\\w+)"\\)`));
        const fkColumn = fkFieldMatch ? fkFieldMatch[1] : fkFieldName;
        
        // Find the referenced table name
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

    // Remove duplicate relations
    const uniqueRelations = [...new Set(relations)];

    let result = tables.join("\n\n");
    if (uniqueRelations.length > 0) {
      result += "\n\nRelasi:\n  - " + uniqueRelations.join("\n  - ");
    }

    return result;
  }

  // Helper: Check if field type is a relation (model reference)
  private isRelationField(type: string): boolean {
    const primitiveTypes = ['Int', 'String', 'Float', 'Boolean', 'DateTime', 'Decimal', 'BigInt', 'Json'];
    // If it's not a primitive and starts with uppercase, it's a model reference
    return !primitiveTypes.includes(type) && type[0] === type[0].toUpperCase() && !type.includes('[]');
  }

  // Helper: Convert Prisma type to SQL type
  private prismaTypeToSQL(prismaType: string): string {
    const typeMap: Record<string, string> = {
      Int: "INTEGER",
      String: "TEXT",
      Boolean: "BOOLEAN",
      Float: "FLOAT",
      DateTime: "TIMESTAMP",
      Decimal: "DECIMAL",
      BigInt: "BIGINT",
    };
    return typeMap[prismaType] || prismaType.toUpperCase();
  }

  // Helper: Get table name for a model
  private getTableNameForModel(fieldName: string, schema: string): string {
    const modelMatch = schema.match(new RegExp(`model\\s+\\w+\\s*\\{[^}]*\\b${fieldName}\\b[^}]*@@map\\("(\\w+)"\\)`));
    return modelMatch ? modelMatch[1] : fieldName.toLowerCase();
  }
}

export const schemaExtractor = new SchemaExtractor();
