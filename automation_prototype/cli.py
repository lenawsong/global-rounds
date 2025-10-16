"""CLI entry point for the Global Rounds automation prototype."""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from automation import engagement, ordering, payments, performance, workforce, finance
from backend.compliance import scan_compliance
from backend.config import load_infrastructure_config
from backend.events import EventDispatcher, load_events_for_order, replay_events
from backend.ingestion import ingest_portal_holds
from backend.tasks import TaskStore
from backend.revenue_model import build_revenue_model
from backend.sla import evaluate as evaluate_sla, load_policy


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Global Rounds automation prototype")
    parser.add_argument(
        "command",
        choices=[
            "run-all",
            "ordering",
            "payments",
            "workforce",
            "engagement",
            "performance",
            "finance",
            "compliance-scan",
            "ingest-portal-holds",
            "infrastructure",
            "revenue-model",
            "sla-evaluate",
            "events-replay",
        ],
    )
    parser.add_argument("--data-dir", default="data", help="Path to synthetic data directory")
    parser.add_argument(
        "--as-of",
        default=datetime.now(timezone.utc).date().isoformat(),
        help="As-of date in YYYY-MM-DD format",
    )
    parser.add_argument(
        "--output",
        help="Optional path to write JSON results",
    )
    parser.add_argument(
        "--order-id",
        help="Order identifier (used by sla-evaluate and events-replay).",
    )
    parser.add_argument(
        "--topic",
        action="append",
        help="Event topic filter (supports wildcards; repeat for multiple).",
    )
    parser.add_argument(
        "--from",
        dest="from_date",
        help="Start of event replay window (YYYY-MM-DD or ISO).",
    )
    parser.add_argument(
        "--to",
        dest="to_date",
        help="End of event replay window (YYYY-MM-DD or ISO).",
    )
    return parser.parse_args()


def _write_output(results, output_path: str | None) -> None:
    if not output_path:
        print(json.dumps(results, indent=2))
        return
    destination = Path(output_path)
    destination.write_text(json.dumps(results, indent=2), encoding="utf-8")
    print(f"Wrote output to {destination}")


def _parse_date(value: str | None) -> datetime | None:
    if not value:
        return None
    text = value.strip()
    if not text:
        return None
    try:
        if len(text) == 10:
            return datetime.strptime(text, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
    except ValueError as exc:
        raise SystemExit(f"Invalid date '{value}': {exc}")


COMMAND_MAP = {
    "ordering": lambda data_dir, as_of: ordering.run(data_dir, as_of),
    "payments": lambda data_dir, as_of: payments.reconcile_claims(data_dir, as_of),
    "workforce": lambda data_dir, as_of: workforce.forecast_staffing(data_dir, as_of),
    "engagement": lambda data_dir, as_of: engagement.generate_notifications(data_dir, as_of),
    "performance": lambda data_dir, as_of: performance.compute_kpis(data_dir, as_of),
    "finance": lambda data_dir, as_of: finance.compute_financial_pulse(data_dir, as_of),
}


def main() -> None:
    args = parse_args()
    as_of = datetime.strptime(args.as_of, "%Y-%m-%d")
    data_dir = Path(args.data_dir)

    if args.command == "run-all":
        results = {
            "ordering": ordering.run(data_dir, as_of),
            "payments": payments.reconcile_claims(data_dir, as_of),
            "workforce": workforce.forecast_staffing(data_dir, as_of),
            "engagement": engagement.generate_notifications(data_dir, as_of),
            "performance": performance.compute_kpis(data_dir, as_of),
            "finance": finance.compute_financial_pulse(data_dir, as_of),
        }
    elif args.command == "compliance-scan":
        dispatcher = EventDispatcher(data_dir)
        task_store = TaskStore(data_dir)
        results = scan_compliance(data_dir, as_of=as_of.replace(tzinfo=timezone.utc), task_store=task_store, dispatcher=dispatcher)
    elif args.command == "ingest-portal-holds":
        results = ingest_portal_holds(
            data_dir,
            dispatcher=EventDispatcher(data_dir),
            as_of=as_of.replace(tzinfo=timezone.utc),
        )
    elif args.command == "infrastructure":
        config = load_infrastructure_config()
        results = config.to_dict()
    elif args.command == "revenue-model":
        results = build_revenue_model(data_dir, as_of.replace(tzinfo=timezone.utc))
    elif args.command == "sla-evaluate":
        if not args.order_id:
            raise SystemExit("--order-id is required for sla-evaluate")
        bundle = load_policy(data_dir)
        events = load_events_for_order(data_dir, args.order_id)
        if not events:
            raise SystemExit(f"No events found for order {args.order_id}")
        score = evaluate_sla(events, policy=bundle.specs, policy_version=bundle.version)
        results = score.model_dump(mode="json")
    elif args.command == "events-replay":
        since = _parse_date(args.from_date)
        until = _parse_date(args.to_date)
        topics = args.topic or []
        events = replay_events(
            data_dir,
            since=since,
            until=until,
            topics=topics,
            order_id=args.order_id,
        )
        results = {
            "count": len(events),
            "events": events,
        }
    else:
        results = COMMAND_MAP[args.command](data_dir, as_of)

    _write_output(results, args.output)


if __name__ == "__main__":  # pragma: no cover
    main()
