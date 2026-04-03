#!/usr/bin/env python3
"""Apply Supabase SQL migrations in this repo to a Postgres database.

This script is intended for creating the tables/policies defined in
`supabase/migrations/*.sql` directly from this codebase.

Usage (PowerShell):
  python scripts/apply_supabase_migrations.py --db-url "postgresql://..."

Or set an env var (recommended) and just run:
  $env:SUPABASE_DB_URL = "postgresql://..."
  python scripts/apply_supabase_migrations.py

Recognized env vars (first match wins):
  - SUPABASE_DB_URL
  - SUPABASE_DATABASE_URL
  - DATABASE_URL
  - POSTGRES_URL

Notes:
- This needs a *Postgres* connection string (contains password). Do NOT put this
  in any `VITE_*` variable (those get exposed to the browser).
- The migrations are not guaranteed to be idempotent; run against an empty DB
  or a DB that already has these migrations applied.
"""

from __future__ import annotations

import argparse
import os
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, List, Optional


_ENV_KEYS = [
    # Preferred for this repo
    "SUPABASE_DB_URL",
    "SUPABASE_CONNECTION_STRING",

    # Common conventions
    "SUPABASE_DATABASE_URL",
    "DATABASE_URL",
    "POSTGRES_URL",
    "POSTGRES_CONNECTION_STRING",

    # Back-compat only (Vite exposes VITE_* to the browser; avoid using this)
    "VITE_DATABASE_URL",
]


def _load_dotenv_if_present(repo_root: Path) -> List[Path]:
    """Minimal .env loader (no external dependency).

    Loads KEY=VALUE lines into os.environ if the key isn't already set.
    Supports simple quoting with single/double quotes.
    """

    dotenv_candidates = [
        repo_root / ".env",
        repo_root / ".env.local",
        repo_root / ".env.development",
        repo_root / ".env.production",
    ]

    loaded: List[Path] = []

    for dotenv_path in dotenv_candidates:
        if not dotenv_path.exists():
            continue

        loaded.append(dotenv_path)

        for raw_line in dotenv_path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" not in line:
                continue

            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip()

            if not key or key in os.environ:
                continue

            if (value.startswith('"') and value.endswith('"')) or (
                value.startswith("'") and value.endswith("'")
            ):
                value = value[1:-1]

            os.environ[key] = value

    return loaded


def _get_db_url(cli_db_url: Optional[str]) -> str:
    if cli_db_url:
        return cli_db_url

    for key in _ENV_KEYS:
        value = os.environ.get(key)
        if value:
            return value

    keys = ", ".join(_ENV_KEYS)
    raise SystemExit(
        "Missing database URL. Provide --db-url or set one of: " + keys
    )


def _redact_db_url(db_url: str) -> str:
    # Redact password in postgresql://user:pass@host
    return re.sub(r"(postgres(?:ql)?://[^:/\s]+:)([^@\s]+)(@)", r"\1***\3", db_url)


_DOLLAR_QUOTE_RE = re.compile(r"\$[A-Za-z_][A-Za-z0-9_]*\$")


def split_sql_statements(sql: str) -> List[str]:
    """Split SQL into executable statements.

    Handles:
    - single quotes, double quotes
    - line comments (-- ...)
    - block comments (/* ... */)
    - dollar-quoted strings ($tag$ ... $tag$ and $$ ... $$)

    This is sufficient for typical Supabase migrations.
    """

    statements: List[str] = []
    start = 0
    i = 0

    in_single = False
    in_double = False
    in_line_comment = False
    in_block_comment = False
    dollar_tag: Optional[str] = None

    while i < len(sql):
        ch = sql[i]
        nxt = sql[i + 1] if i + 1 < len(sql) else ""

        if in_line_comment:
            if ch == "\n":
                in_line_comment = False
            i += 1
            continue

        if in_block_comment:
            if ch == "*" and nxt == "/":
                in_block_comment = False
                i += 2
                continue
            i += 1
            continue

        if dollar_tag is not None:
            if sql.startswith(dollar_tag, i):
                tag = dollar_tag
                dollar_tag = None
                i += len(tag)
                continue
            i += 1
            continue

        if in_single:
            if ch == "'":
                if nxt == "'":
                    i += 2
                    continue
                in_single = False
            i += 1
            continue

        if in_double:
            if ch == '"':
                if nxt == '"':
                    i += 2
                    continue
                in_double = False
            i += 1
            continue

        # Not in string/comment
        if ch == "-" and nxt == "-":
            in_line_comment = True
            i += 2
            continue

        if ch == "/" and nxt == "*":
            in_block_comment = True
            i += 2
            continue

        if ch == "'":
            in_single = True
            i += 1
            continue

        if ch == '"':
            in_double = True
            i += 1
            continue

        if ch == "$":
            if sql.startswith("$$", i):
                dollar_tag = "$$"
                i += 2
                continue

            m = _DOLLAR_QUOTE_RE.match(sql, i)
            if m:
                dollar_tag = m.group(0)
                i += len(dollar_tag)
                continue

        if ch == ";":
            stmt = sql[start:i].strip()
            if stmt:
                statements.append(stmt)
            start = i + 1

        i += 1

    tail = sql[start:].strip()
    if tail:
        statements.append(tail)

    return statements


@dataclass
class Migration:
    path: Path

    @property
    def name(self) -> str:
        return self.path.name


def list_migrations(repo_root: Path) -> List[Migration]:
    migrations_dir = repo_root / "supabase" / "migrations"
    if not migrations_dir.exists():
        raise SystemExit(f"Migrations folder not found: {migrations_dir}")

    files = sorted(migrations_dir.glob("*.sql"))
    if not files:
        raise SystemExit(f"No .sql migrations found in: {migrations_dir}")

    return [Migration(path=f) for f in files]


def apply_with_psycopg(db_url: str, migrations: List[Migration]) -> None:
    # Prefer psycopg2 if available (no dependency required at import time).
    try:
        import psycopg2  # type: ignore
    except Exception as exc:
        raise RuntimeError("psycopg2 is not installed") from exc

    conn = psycopg2.connect(db_url)
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS public.schema_migrations (
                      filename text PRIMARY KEY,
                      applied_at timestamptz NOT NULL DEFAULT now()
                    )
                    """
                )

                for mig in migrations:
                    cur.execute(
                        "SELECT 1 FROM public.schema_migrations WHERE filename = %s",
                        (mig.name,),
                    )
                    if cur.fetchone() is not None:
                        print(f"Skipping {mig.name} (already applied)")
                        continue

                    sql = mig.path.read_text(encoding="utf-8")
                    statements = split_sql_statements(sql)
                    if not statements:
                        print(f"Skipping {mig.name} (empty)")
                        cur.execute(
                            "INSERT INTO public.schema_migrations (filename) VALUES (%s)",
                            (mig.name,),
                        )
                        continue

                    print(f"Applying {mig.name} ({len(statements)} statements)...")
                    for stmt in statements:
                        cur.execute(stmt)

                    cur.execute(
                        "INSERT INTO public.schema_migrations (filename) VALUES (%s)",
                        (mig.name,),
                    )

        print("Done applying migrations.")
    finally:
        conn.close()


def main(argv: Optional[Iterable[str]] = None) -> int:
    repo_root = Path(__file__).resolve().parents[1]
    loaded_dotenv = _load_dotenv_if_present(repo_root)

    parser = argparse.ArgumentParser(
        description="Apply supabase/migrations/*.sql to a Postgres database."
    )
    parser.add_argument(
        "--db-url",
        dest="db_url",
        default=None,
        help="Postgres connection string (overrides env vars).",
    )
    args = parser.parse_args(list(argv) if argv is not None else None)

    if loaded_dotenv:
        loaded_names = ", ".join(p.name for p in loaded_dotenv)
        print(f"Loaded env file(s): {loaded_names}")
    else:
        print("No .env files found; using OS environment variables.")

    db_url = _get_db_url(args.db_url)
    print(f"DB: {_redact_db_url(db_url)}")

    migrations = list_migrations(repo_root)
    print(f"Found {len(migrations)} migration(s) in supabase/migrations")

    try:
        apply_with_psycopg(db_url, migrations)
    except RuntimeError:
        print(
            "psycopg2 is required to run this script. Install it with:\n"
            "  pip install -r scripts/requirements.txt\n",
            file=sys.stderr,
        )
        return 2

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
