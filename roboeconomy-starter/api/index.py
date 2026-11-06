"""Vercel Python entrypoint. Set DATABASE_URL to managed Postgres in Vercel."""
from services.api.app.main import app
