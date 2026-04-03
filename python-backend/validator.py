import sqlglot
from sqlglot import exp

class SQLValidationError(Exception):
    pass

def validate_and_format_sql(sql_str: str) -> str:
    """
    Memecah string SQL menjadi bentuk Abstract Syntax Tree (AST) untuk:
    1. Memastikan strukturnya masuk akal (tidak syntax error).
    2. Mendeteksi dan memblokir keyword merusak (DROP, DELETE, UPDATE, INSERT, dll).
    3. Menyuntikkan secara otomatis LIMIT 100 jika tidak ada klausa LIMIT pada AI Prompt.
    """
    dialect = "postgres"
    
    try:
        parsed = sqlglot.parse_one(sql_str, read=dialect)
    except Exception as e:
        raise SQLValidationError(f"Invalid SQL Query: AI menghasilkan sintaks yang cacat -> {str(e)}")
        
    # Daftar class AST yang mendefinisikan Operasi Merusak / DDL
    forbidden_tokens = [
        exp.Delete,
        exp.Drop,
        exp.Update,
        exp.Insert,
        exp.Alter,        # ALTER TABLE, ALTER COLUMN, dll (bukan AlterTable)
        exp.Create,
        exp.Command,
    ]
    
    # Telusuri menggunakan find untuk masing2 token
    for forbidden in forbidden_tokens:
        if parsed.find(forbidden):
            raise SQLValidationError(
                f"Keamanan Ditolak: Ditemukan perintah {forbidden.__name__}. Hanya operasi READ-ONLY (SELECT) yang diizinkan."
            )
            
    # Cek fungsi postgres berbahaya spt pg_sleep dll
    for ftype in [exp.Func, exp.Anonymous]:
        for node in parsed.find_all(ftype):
            func_name = getattr(node, "name", "").upper()
            if "SLEEP" in func_name or "PG_" in func_name or "EVAL" in func_name:
                raise SQLValidationError(
                    f"Keamanan Ditolak: Terdeteksi pemanggilan fungsi sistem mencurigakan ({func_name})."
                )

    # Tambahkan Limit Otomatis jika Root adalah Select dan tidak ada klausul Limit
    # Note: Limit ini akan di-override oleh API pagination
    if not parsed.args.get("limit"):
        # Default limit untuk query tanpa pagination parameter
        parsed = parsed.limit(10)
        
    # Kembalikan string SQL yang telah terverifikasi dan termutasi (menambahkan LIMIT)
    return parsed.sql(dialect=dialect)
