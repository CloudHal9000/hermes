FROM python:3.12-slim

RUN pip install websockets

WORKDIR /app
COPY mock_adapter.py .

CMD ["python3", "mock_adapter.py"]
