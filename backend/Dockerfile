FROM ghcr.io/astral-sh/uv:python3.11-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# System deps for Pillow/ReportLab fonts
RUN apt-get update && apt-get install -y --no-install-recommends \
    libfreetype6 libjpeg62-turbo zlib1g \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt /app/requirements.txt
RUN uv pip install -r /app/requirements.txt

COPY backend/app /app/app

EXPOSE 8000

# Railway sets PORT dynamically; use it if available, fallback to 8000
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}

