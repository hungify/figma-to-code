#!/usr/bin/env python3
"""
Phase 1 — Gate: Design Readiness.

Reads the cached Figma manifest (.figma/cache/manifest.json, written by
figma-init.py) and walks the subtree of the given --node-id to find nodes
that violate design-system rules:

  RAW_HEX_FILL        — SOLID fill not bound to a Figma Style or Variable
  MISSING_AUTO_LAYOUT — Frame/Group/Component with >1 child but no auto layout

Both violation types block the gate (status: FAIL). The agent must report
the violations to the dev and stop the pipeline until design is fixed.

Usage:
  python scripts/figma-gate-design.py --file-key <key> --node-id <nodeId>

  --node-id is the node being implemented in this pipeline run. Only its
  subtree is checked — not the entire file. This prevents stale legacy nodes
  elsewhere in the file from blocking current work.

  If --node-id is omitted, the entire file is checked (useful for a full
  design-system audit, but not recommended for per-component pipeline runs).

Exit codes:
  0 = PASS
  1 = FAIL (violations found, or manifest missing/stale)
"""

import argparse
import json
import sys
import time
from pathlib import Path
from typing import Optional

CACHE_DIR = Path(".figma/cache")
ARTIFACTS_DIR = Path(".figma/artifacts")
GATE_OUTPUT_PATH = ARTIFACTS_DIR / "gate-design.json"
DESIGNER_FEEDBACK_PATH = ARTIFACTS_DIR / "designer-feedback.md"

# Nodes with fewer children than this are not flagged for missing auto layout.
# A frame with 1 child has no layout ambiguity.
MIN_CHILDREN_FOR_LAYOUT_CHECK = 2


# ---------------------------------------------------------------------------
# Node classification helpers (mirrored from figma-init.py so this script
# is self-contained and can be run without importing figma-init)
# ---------------------------------------------------------------------------

def is_raw_hex_fill(node: dict) -> bool:
    """True if node has a SOLID fill not bound to any Figma Style or Variable."""
    fills = node.get("fills") or []
    style_refs = node.get("styles") or {}
    bound_vars = node.get("boundVariables") or {}

    has_fill_style_ref = "fill" in style_refs
    has_fill_var_ref = "fills" in bound_vars

    for f in fills:
        if (
            f.get("type") == "SOLID"
            and f.get("visible", True)
            and not has_fill_style_ref
            and not has_fill_var_ref
        ):
            return True
    return False


def has_auto_layout(node: dict) -> bool:
    return node.get("layoutMode") in ("HORIZONTAL", "VERTICAL")


def is_layout_container(node: dict) -> bool:
    """Frame/Group/Component with enough children to require explicit layout."""
    return (
        node.get("type") in ("FRAME", "GROUP", "COMPONENT", "COMPONENT_SET", "INSTANCE")
        and len(node.get("children", [])) >= MIN_CHILDREN_FOR_LAYOUT_CHECK
    )


# ---------------------------------------------------------------------------
# Manifest helpers
# ---------------------------------------------------------------------------

def normalize_node_id(node_id: str) -> str:
    """Accept both '123:456' (API) and '123-456' (URL) formats."""
    if "-" in node_id and ":" not in node_id:
        parts = node_id.split("-")
        if len(parts) == 2 and all(p.isdigit() for p in parts):
            return ":".join(parts)
    return node_id


def find_node(root: dict, target_id: str) -> Optional[dict]:
    """BFS walk to find first node matching target_id."""
    queue = [root]
    while queue:
        node = queue.pop(0)
        if node.get("id") == target_id:
            return node
        queue.extend(node.get("children", []) or [])
    return None


def find_node_in_manifest(manifest: dict, node_id: str) -> Optional[dict]:
    target = normalize_node_id(node_id)
    for page in manifest.get("pages", []):
        found = find_node(page, target)
        if found is not None:
            return found
    return None


# ---------------------------------------------------------------------------
# Violation collector
# ---------------------------------------------------------------------------

def collect_violations(node: dict, path: str = "") -> list[dict]:
    """
    Recursively walk a node subtree and return a flat list of violation dicts.
    Each dict has: id, name, type, path, flags.
    """
    violations = []
    node_path = f"{path}/{node.get('name', '?')}".lstrip("/")

    flags = node.get("flags", [])

    # The manifest already has flags baked in (set by figma-init.py's summarize_node).
    # For nodes where the manifest was built by an older version without boundVariables
    # check, re-derive from raw node data defensively.
    derived_flags = []
    if is_raw_hex_fill(node):
        derived_flags.append("RAW_HEX_FILL")
    if is_layout_container(node) and not has_auto_layout(node):
        derived_flags.append("MISSING_AUTO_LAYOUT")

    # Union: trust both sources
    all_flags = list(set(flags) | set(derived_flags))

    if all_flags:
        violations.append({
            "id": node.get("id"),
            "name": node.get("name"),
            "type": node.get("type"),
            "path": node_path,
            "flags": sorted(all_flags),
        })

    for child in node.get("children", []) or []:
        violations.extend(collect_violations(child, node_path))

    return violations


def write_designer_feedback(violations: list[dict], file_key: str, node_id: Optional[str]) -> None:
    lines = [
        "# Designer Feedback",
        "",
        f"- File key: `{file_key}`",
        f"- Node id: `{node_id or 'entire file'}`",
        f"- Violations: {len(violations)}",
        "",
        "## Required Figma Updates",
        "",
    ]

    for violation in violations:
        flags = ", ".join(violation["flags"])
        lines.extend(
            [
                f"### {violation.get('name') or 'Unnamed node'}",
                "",
                f"- Node id: `{violation.get('id')}`",
                f"- Path: `{violation.get('path')}`",
                f"- Flags: `{flags}`",
                "",
            ]
        )
        if "RAW_HEX_FILL" in violation["flags"]:
            lines.append("- Replace raw fill with a Figma variable or style matching the code token system.")
        if "MISSING_AUTO_LAYOUT" in violation["flags"]:
            lines.append("- Add Auto Layout or confirm the absolute layout is intentional.")
        lines.append("")

    DESIGNER_FEEDBACK_PATH.write_text("\n".join(lines), encoding="utf-8")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Design readiness gate.")
    parser.add_argument("--file-key", required=True, help="Figma file key")
    parser.add_argument(
        "--node-id",
        default=None,
        help=(
            "Node id to check (subtree only). Omit to check the entire file "
            "(audit mode — not recommended for per-component pipeline runs)."
        ),
    )
    args = parser.parse_args()

    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)

    # Load manifest
    manifest_path = CACHE_DIR / "manifest.json"
    if not manifest_path.exists():
        msg = (
            f"[figma-gate-design] Manifest not found at {manifest_path}.\n"
            f"  Run first: python scripts/figma-init.py --file-key {args.file_key}"
        )
        print(msg, file=sys.stderr)
        result = {
            "status": "FAIL",
            "error": "MANIFEST_NOT_FOUND",
            "fileKey": args.file_key,
            "checkedAt": int(time.time()),
        }
        GATE_OUTPUT_PATH.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
        sys.exit(1)

    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        print(f"[figma-gate-design] Manifest JSON invalid: {e}", file=sys.stderr)
        sys.exit(1)

    # Validate file-key matches
    if manifest.get("fileKey") != args.file_key:
        print(
            f"[figma-gate-design] Manifest is for file-key={manifest.get('fileKey')}, "
            f"but requested file-key={args.file_key}.\n"
            f"  Refresh: python scripts/figma-init.py --file-key {args.file_key} --force",
            file=sys.stderr,
        )
        sys.exit(1)

    # Determine root to walk
    if args.node_id:
        normalized = normalize_node_id(args.node_id)
        root = find_node_in_manifest(manifest, normalized)
        if root is None:
            print(
                f"[figma-gate-design] Node {args.node_id} not found in cached manifest.\n"
                f"  Refresh: python scripts/figma-init.py --file-key {args.file_key} --force",
                file=sys.stderr,
            )
            result = {
                "status": "FAIL",
                "error": "NODE_NOT_FOUND",
                "nodeId": args.node_id,
                "checkedAt": int(time.time()),
            }
            GATE_OUTPUT_PATH.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
            sys.exit(1)
        scope = f"node {normalized}"
        violations = collect_violations(root)
    else:
        # Audit mode: walk all pages
        scope = "entire file"
        violations = []
        for page in manifest.get("pages", []):
            for top_node in page.get("children", []):
                violations.extend(collect_violations(top_node))

    # Summarise by flag type
    raw_hex_nodes = [v for v in violations if "RAW_HEX_FILL" in v["flags"]]
    missing_layout_nodes = [v for v in violations if "MISSING_AUTO_LAYOUT" in v["flags"]]

    status = "FAIL" if violations else "PASS"

    result = {
        "status": status,
        "scope": scope,
        "fileKey": args.file_key,
        "nodeId": args.node_id,
        "checkedAt": int(time.time()),
        "summary": {
            "totalViolations": len(violations),
            "rawHexFill": len(raw_hex_nodes),
            "missingAutoLayout": len(missing_layout_nodes),
        },
        "violations": violations,
    }

    GATE_OUTPUT_PATH.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    if violations:
        write_designer_feedback(violations, args.file_key, args.node_id)

    # Print summary
    print(f"[figma-gate-design] Scope: {scope}")
    print(f"[figma-gate-design] RAW_HEX_FILL: {len(raw_hex_nodes)} node(s)")
    print(f"[figma-gate-design] MISSING_AUTO_LAYOUT: {len(missing_layout_nodes)} node(s)")

    if status == "FAIL":
        print(f"\n[figma-gate-design] FAIL — {len(violations)} violation(s) found.")
        print("  Fix the following nodes in Figma before continuing:\n")
        for v in violations:
            print(f"  [{', '.join(v['flags'])}]")
            print(f"    id:   {v['id']}")
            print(f"    name: {v['name']}")
            print(f"    path: {v['path']}\n")
        print(f"[figma-gate-design] Details written to {GATE_OUTPUT_PATH}")
        print(f"[figma-gate-design] Designer feedback written to {DESIGNER_FEEDBACK_PATH}")
        sys.exit(1)
    else:
        print(f"[figma-gate-design] PASS — no violations found.")
        print(f"[figma-gate-design] Details written to {GATE_OUTPUT_PATH}")
        sys.exit(0)


if __name__ == "__main__":
    main()
