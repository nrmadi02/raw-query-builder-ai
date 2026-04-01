#!/bin/bash

# Pastikan berada di root direktori project
cd "$(dirname "$0")/python-backend"

echo "⚙️ Mempersiapkan Python Backend..."

# Cek apakah virtual environment sudah ada
if [ ! -d ".venv" ]; then
    echo "📦 Membuat virtual environment (.venv)..."
    python3 -m venv .venv
fi

# Aktifkan virtual environment
source .venv/bin/activate

# Install requirements
echo "⬇️ Menginstall dependensi (FastAPI, LiteLLM, dsb)..."
pip install -r requirements.txt

# Jalankan server FastAPI
echo "🚀 Berhasil! Menjalankan Backend Python di http://localhost:8000"
uvicorn main:app --reload --port 8000
