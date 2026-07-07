# Przypinamy wydanie Debiana (trixie), bo ruchomy tag python:3.11-slim
# zmienił bazę bez ostrzeżenia i wywalił build na Railway 24.06.2026.
FROM python:3.11-slim-trixie

# Tesseract OCR + języki PL i EN
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-pol \
    tesseract-ocr-eng \
    libgomp1 \
    poppler-utils \
    libucl1 \
    libucl-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .

EXPOSE 8000
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
