"""Agent orchestration for the automation prototype."""
from __future__ import annotations

import sys
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Iterable, List, Mapping, MutableMapping

# Ensure the automation package is importable when running from /backend
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.append(str(ROOT))

from automation import engagement, ordering, payments, performance, workforce, finance  # noqa: E402


@dataclass
class AgentResult:
    name: str
    payload: Mapping[str, object]
    run_at: datetime


@dataclass
class AgentOrchestrator:
    data_dir: Path
    results: MutableMapping[str, AgentResult] = field(default_factory=dict)

    def run_agents(self, agents: Iterable[str], as_of: datetime) -> Dict[str, Mapping[str, object]]:
        responses: Dict[str, Mapping[str, object]] = {}
        for agent in agents:
            payload = self._run_single(agent, as_of)
            responses[agent] = payload
            self.results[agent] = AgentResult(name=agent, payload=payload, run_at=datetime.now(timezone.utc))
        return responses

    def _run_single(self, agent: str, as_of: datetime) -> Mapping[str, object]:
        agent = agent.lower()
        if agent == "ordering":
            return ordering.run(self.data_dir, as_of.replace(tzinfo=None))
        if agent == "payments":
            return payments.reconcile_claims(self.data_dir, as_of.replace(tzinfo=None))
        if agent == "workforce":
            return workforce.forecast_staffing(self.data_dir, as_of.replace(tzinfo=None))
        if agent == "engagement":
            return engagement.generate_notifications(self.data_dir, as_of.replace(tzinfo=None))
        if agent == "performance":
            return performance.compute_kpis(self.data_dir, as_of.replace(tzinfo=None))
        if agent == "finance":
            return finance.compute_financial_pulse(self.data_dir, as_of.replace(tzinfo=None))
        raise ValueError(f"Unknown agent '{agent}'")

    def run_all(self, as_of: datetime) -> Dict[str, Mapping[str, object]]:
        return self.run_agents(
            ["ordering", "payments", "workforce", "engagement", "performance", "finance"],
            as_of,
        )

    def status(self) -> List[Mapping[str, object]]:
        statuses: List[Mapping[str, object]] = []
        for name in ["ordering", "payments", "workforce", "engagement", "performance", "finance"]:
            result = self.results.get(name)
            statuses.append(
                {
                    "agent": name,
                    "last_run": result.run_at.isoformat() if result else None,
                    "records": _estimate_records(result.payload) if result else 0,
                }
            )
        return statuses

    def snapshot(self) -> Mapping[str, object]:
        return {name: result.payload for name, result in self.results.items()}


def _estimate_records(payload: Mapping[str, object]) -> int:
    total = 0
    for value in payload.values():
        if isinstance(value, list):
            total += len(value)
    return total
