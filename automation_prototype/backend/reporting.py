"""Utilities for generating lightweight PDF reports."""
from __future__ import annotations

from datetime import datetime
from typing import Iterable

from backend.schemas import ComplianceAlert


def _escape_pdf_text(value: str) -> str:
    """Escape characters that have special meaning in PDF string literals."""
    return value.replace('\\', '\\\\').replace('(', '\\(').replace(')', '\\)')


def _build_content_stream(title: str, timestamp: str, lines: Iterable[str]) -> bytes:
    content = [
        'BT',
        '/F1 18 Tf',
        '72 760 Td',
        f'({_escape_pdf_text(title)}) Tj',
        '/F1 12 Tf',
        '0 -26 Td',
        f'({_escape_pdf_text(timestamp)}) Tj',
        '0 -18 Td',
        '14 TL',
    ]
    for line in lines:
        content.append(f'({_escape_pdf_text(line)}) Tj')
        content.append('T*')
    content.append('ET')
    return '\n'.join(content).encode('latin-1', 'replace')


def _assemble_pdf(content_stream: bytes) -> bytes:
    objects: list[tuple[int, bytes]] = []
    objects.append((1, b"<< /Type /Catalog /Pages 2 0 R >>"))
    objects.append((2, b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>"))
    objects.append(
        (
            3,
            b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R "
            b"/Resources << /Font << /F1 5 0 R >> >> >>",
        )
    )
    stream_obj = b"<< /Length %d >>\nstream\n" % len(content_stream)
    stream_obj += content_stream + b"\nendstream"
    objects.append((4, stream_obj))
    objects.append((5, b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"))

    result = bytearray()
    result.extend(b"%PDF-1.4\n")
    offsets = [0]

    for obj_id, body in objects:
        offsets.append(len(result))
        result.extend(f"{obj_id} 0 obj\n".encode('latin-1'))
        result.extend(body)
        if not body.endswith(b"\n"):
            result.extend(b"\n")
        result.extend(b"endobj\n")

    xref_offset = len(result)
    count = len(objects) + 1
    result.extend(f"xref\n0 {count}\n".encode('latin-1'))
    result.extend(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        result.extend(f"{offset:010d} 00000 n \n".encode('latin-1'))
    result.extend(
        (
            f"trailer\n<< /Size {count} /Root 1 0 R >>\nstartxref\n{xref_offset}\n%%EOF\n".encode(
                'latin-1'
            )
        )
    )
    return bytes(result)


def generate_compliance_pdf(
    alerts: Iterable[ComplianceAlert],
    generated_at: datetime,
    title: str | None = None,
) -> bytes:
    """Render a compact PDF containing key compliance alert details."""
    heading = title or "Compliance Alert Packet"
    lines: list[str] = []
    for index, alert in enumerate(alerts, start=1):
        patient = alert.patient_id or "—"
        sku = alert.supply_sku or "—"
        severity = (alert.severity or "unknown").upper()
        due = alert.due_date or "—"
        notes = alert.notes or ""
        summary = f"{index}. Patient {patient} • SKU {sku} • {severity} • Due {due}"
        if notes:
            summary = f"{summary} • {notes}"
        lines.append(summary)

    if not lines:
        lines.append("No compliance alerts available.")

    timestamp_line = f"Generated {generated_at.astimezone().strftime('%Y-%m-%d %H:%M:%S %Z')}"
    content_stream = _build_content_stream(heading, timestamp_line, lines)
    return _assemble_pdf(content_stream)
