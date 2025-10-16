"""Initial schema for task queue, events, and webhooks."""
from __future__ import annotations

from typing import Iterable, List

INITIAL_STATEMENTS: List[str] = [
    """
    CREATE TABLE IF NOT EXISTS automation_tasks (
        id VARCHAR(40) PRIMARY KEY,
        title TEXT NOT NULL,
        task_type VARCHAR(64) NOT NULL,
        priority VARCHAR(32) NOT NULL,
        status VARCHAR(32) NOT NULL,
        owner VARCHAR(64),
        due_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb
    );
    """.strip(),
    """
    CREATE TABLE IF NOT EXISTS automation_events (
        id BIGSERIAL PRIMARY KEY,
        topic VARCHAR(128) NOT NULL,
        payload JSONB NOT NULL,
        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    """.strip(),
    """
    CREATE TABLE IF NOT EXISTS automation_webhooks (
        id VARCHAR(40) PRIMARY KEY,
        url TEXT NOT NULL,
        topics TEXT[] NOT NULL,
        secret TEXT,
        description TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    """.strip(),
    """
    CREATE TABLE IF NOT EXISTS automation_webhook_outbox (
        id VARCHAR(40) PRIMARY KEY,
        webhook_id VARCHAR(40) REFERENCES automation_webhooks(id) ON DELETE CASCADE,
        url TEXT NOT NULL,
        topic VARCHAR(128) NOT NULL,
        payload JSONB NOT NULL,
        timestamp TIMESTAMPTZ,
        queued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        status VARCHAR(32) NOT NULL DEFAULT 'pending'
    );
    """.strip(),
]


def generate_statements() -> Iterable[str]:
    """Yield initial schema statements."""

    for statement in INITIAL_STATEMENTS:
        yield statement

