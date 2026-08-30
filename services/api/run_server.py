"""Uvicorn launcher with WindowsSelectorEventLoopPolicy for async psycopg compatibility."""

import asyncio
import sys

if sys.platform == "win32":
    try:
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    except Exception:
        pass

import uvicorn

if __name__ == "__main__":
    config = uvicorn.Config("app.main:app", host="127.0.0.1", port=8000, loop="asyncio")
    server = uvicorn.Server(config)
    asyncio.run(server.serve())
