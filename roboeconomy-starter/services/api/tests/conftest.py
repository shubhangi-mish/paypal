"""Run every test against a throwaway SQLite file, never the real DATABASE_URL."""
import os
import tempfile

os.environ["DATABASE_URL"] = f"sqlite:///{tempfile.mkdtemp()}/test.db"
