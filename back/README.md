# Backend development

Run backend commands from the repository root so the `back` package is
imported consistently:

```sh
uv sync --project back --locked --group dev
uv run --project back uvicorn back.main:app --reload --host 127.0.0.1 --port 8000
uv run --project back pytest back
```

The Vercel Python adapter imports the same application from `back.main`.
Configure the required Supabase environment variables in your local environment
without committing them; tests use mocked clients and do not require database
access.
