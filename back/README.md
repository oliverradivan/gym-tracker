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
without committing them (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and
`SUPABASE_SERVICE_ROLE_KEY`); user-owned table requests use the anon key with
the caller's JWT, while tests use mocked clients and do not require database
access.

Regenerate the root deployment `requirements.txt` from `back/uv.lock` with `make export-requirements`.
