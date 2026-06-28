#!/usr/bin/env python3
"""
Phase 7 — Human Review.

Two modes:
  1. No --decision given: print + write a human-readable summary aggregating
     every prior phase's artifacts (design gate, scratchpad, visual gate,
     quality gate, golden baseline). The dev reads this to decide.
  2. --decision approve|reject given: act on the dev's decision.
       - approve: git add + commit the given --files (push only if --push
         is also passed — commit and push are deliberately separate steps).
       - reject: roll back --files (git checkout if tracked, delete if
         newly created/untracked) and append a record to
         .figma/artifacts/review-log.json with --reason.

Usage:
  # Step 1 — just see the summary
  python scripts/figma-review.py --node-id <nodeId>

  # Step 2a — approve and commit (push separately)
  python scripts/figma-review.py --node-id <nodeId> --decision approve \
      --files src/features/products/components/ProductCard.tsx --push

  # Step 2b — reject and roll back
  python scripts/figma-review.py --node-id <nodeId> --decision reject \
      --files src/features/products/components/ProductCard.tsx \
      --reason "Spacing doesn't match design, needs another pass"

Exit codes:
  0 = summary printed (no decision), or approve/reject completed successfully
  1 = error (git operation failed, missing required args for the decision)
"""

import argparse
import json
import shutil
import subprocess
import sys
import time
from pathlib import Path
from typing import List, Optional

ARTIFACTS_DIR = Path(".figma/artifacts")
REVIEW_LOG_PATH = ARTIFACTS_DIR / "review-log.json"
REVIEW_SUMMARY_PATH = ARTIFACTS_DIR / "review-summary.md"

GATE_DESIGN_PATH = ARTIFACTS_DIR / "gate-design.json"
GATE_VISUAL_PATH = ARTIFACTS_DIR / "gate-visual.json"
GATE_QUALITY_PATH = ARTIFACTS_DIR / "gate-quality.json"
SCRATCHPAD_PATH = ARTIFACTS_DIR / "scratchpad.json"


def normalize_node_id(node_id: str) -> str:
    if "-" in node_id and ":" not in node_id:
        parts = node_id.split("-")
        if len(parts) == 2 and all(p.isdigit() for p in parts):
            return ":".join(parts)
    return node_id


def load_json_or_none(path: Path) -> Optional[dict]:
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None


def run_git(args: List[str]) -> dict:
    if shutil.which("git") is None:
        return {"ok": False, "output": "", "error": "'git' not found on PATH"}

    try:
        proc = subprocess.run(["git"] + args, capture_output=True, text=True, timeout=60)
        return {
            "ok": proc.returncode == 0,
            "output": (proc.stdout + proc.stderr).strip(),
            "error": None if proc.returncode == 0 else (proc.stdout + proc.stderr).strip(),
        }
    except subprocess.TimeoutExpired:
        return {"ok": False, "output": "", "error": "git command timed out"}
    except Exception as e:
        return {"ok": False, "output": "", "error": str(e)}


def is_tracked(file_path: str) -> bool:
    result = run_git(["ls-files", "--error-unmatch", file_path])
    return result["ok"]


def build_summary(node_id: str) -> str:
    gate_design = load_json_or_none(GATE_DESIGN_PATH)
    gate_visual = load_json_or_none(GATE_VISUAL_PATH)
    gate_quality = load_json_or_none(GATE_QUALITY_PATH)
    scratchpad = load_json_or_none(SCRATCHPAD_PATH)

    lines = [f"# Review Summary — node {normalize_node_id(node_id)}", ""]

    lines.append("## Phase 1 — Design Readiness")
    if gate_design is None:
        lines.append("- Not run.")
    else:
        lines.append(f"- Status: **{gate_design.get('status')}**")
        if gate_design.get("violations"):
            lines.append(f"- Violations: {len(gate_design['violations'])}")

    lines.append("")
    lines.append("## Phase 2 — Design Tokens")
    if scratchpad is None:
        lines.append("- Not run.")
    else:
        matched = scratchpad.get("matched", [])
        arbitrary = scratchpad.get("arbitrary", [])
        lines.append(f"- Matched tokens: {len(matched)}")
        lines.append(f"- Arbitrary tokens (WARN): {len(arbitrary)}")
        for a in arbitrary:
            lines.append(f"  - `{a['hex']}` ← Figma `{a['figmaVariable']}`")

    lines.append("")
    lines.append("## Phase 4 — Visual Verify")
    if gate_visual is None:
        lines.append("- Not run.")
    else:
        lines.append(f"- Status: **{gate_visual.get('status')}**")
        exact_threshold = gate_visual.get("exactThreshold", gate_visual.get("threshold"))
        accept_threshold = gate_visual.get("acceptThreshold", gate_visual.get("threshold"))
        lines.append(
            f"- Diff: {gate_visual.get('diffPercentage')}% "
            f"(exact {exact_threshold}%, accept {accept_threshold}%)"
        )
        if gate_visual.get("diffImage"):
            lines.append(f"- Diff image: `{gate_visual['diffImage']}`")

    lines.append("")
    lines.append("## Phase 5 — Code Quality")
    if gate_quality is None:
        lines.append("- Not run.")
    else:
        lines.append(f"- Status: **{gate_quality.get('status')}**")
        checks = gate_quality.get("checks", {})
        for name in ("typescript", "accessibility", "lint", "arbitraryValues"):
            if name in checks:
                lines.append(f"  - {name}: {checks[name].get('status')}")

    golden_path = ARTIFACTS_DIR / f"golden-{normalize_node_id(node_id).replace(':', '-')}.png"
    lines.append("")
    lines.append("## Phase 6 — Golden Baseline")
    lines.append(f"- Golden screenshot: {'`' + str(golden_path) + '`' if golden_path.exists() else 'not found'}")

    lines.append("")
    overall_blockers = []
    if gate_design and gate_design.get("status") == "FAIL":
        overall_blockers.append("design gate")
    if gate_visual and gate_visual.get("status") == "FAIL":
        overall_blockers.append("visual gate")
    if gate_quality and gate_quality.get("status") == "FAIL":
        overall_blockers.append("quality gate")

    if gate_visual and gate_visual.get("status") == "NEEDS_HUMAN_ACCEPT":
        lines.append("**Visual diff needs human accept before approval.**")
    elif overall_blockers:
        lines.append(f"**⚠ Earlier gate(s) failed: {', '.join(overall_blockers)}. Review carefully before approving.**")
    else:
        lines.append("**All prior gates passed.**")

    return "\n".join(lines)


def do_approve(files: List[str], commit_message: str, push: bool) -> int:
    if not files:
        print("[figma-review] --files is required for --decision approve", file=sys.stderr)
        return 1

    missing = [f for f in files if not Path(f).exists()]
    if missing:
        print(f"[figma-review] These files don't exist, cannot commit: {missing}", file=sys.stderr)
        return 1

    add_result = run_git(["add"] + files)
    if not add_result["ok"]:
        print(f"[figma-review] git add failed: {add_result['error']}", file=sys.stderr)
        return 1

    commit_result = run_git(["commit", "-m", commit_message])
    if not commit_result["ok"]:
        print(f"[figma-review] git commit failed: {commit_result['error']}", file=sys.stderr)
        return 1

    print(f"[figma-review] Committed: {commit_message}")
    print(commit_result["output"])

    if push:
        push_result = run_git(["push"])
        if not push_result["ok"]:
            print(f"[figma-review] git push failed: {push_result['error']}", file=sys.stderr)
            print("[figma-review] Commit succeeded locally — push manually once resolved.", file=sys.stderr)
            return 1
        print("[figma-review] Pushed to remote.")
    else:
        print("[figma-review] Not pushed (pass --push to push to remote).")

    return 0


def do_reject(files: List[str], node_id: str, reason: str) -> int:
    if not reason:
        print("[figma-review] --reason is required for --decision reject", file=sys.stderr)
        return 1

    rolled_back = []
    for f in files:
        path = Path(f)
        if not path.exists():
            continue
        if is_tracked(f):
            result = run_git(["checkout", "--", f])
            if result["ok"]:
                rolled_back.append({"file": f, "action": "git checkout"})
            else:
                print(f"[figma-review] WARN: could not git checkout {f}: {result['error']}", file=sys.stderr)
        else:
            path.unlink()
            rolled_back.append({"file": f, "action": "deleted (was untracked)"})

    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    log = []
    if REVIEW_LOG_PATH.exists():
        try:
            log = json.loads(REVIEW_LOG_PATH.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            log = []

    log.append(
        {
            "nodeId": normalize_node_id(node_id),
            "decision": "reject",
            "reason": reason,
            "rolledBack": rolled_back,
            "loggedAt": int(time.time()),
        }
    )
    REVIEW_LOG_PATH.write_text(json.dumps(log, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"[figma-review] REJECTED — reason: {reason}")
    for r in rolled_back:
        print(f"  - {r['file']}: {r['action']}")
    print(f"[figma-review] Logged to {REVIEW_LOG_PATH}")
    return 0


def main():
    parser = argparse.ArgumentParser(description="Human review gate.")
    parser.add_argument("--node-id", required=True, help="Figma node id")
    parser.add_argument("--decision", choices=["approve", "reject"], default=None)
    parser.add_argument("--files", nargs="*", default=[], help="Implementation file(s) affected by this decision")
    parser.add_argument("--commit-message", default=None, help="Commit message for --decision approve")
    parser.add_argument("--push", action="store_true", help="Also git push after committing (approve only)")
    parser.add_argument("--reason", default=None, help="Reason for rejection (required for --decision reject)")
    args = parser.parse_args()

    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    summary = build_summary(args.node_id)
    REVIEW_SUMMARY_PATH.write_text(summary, encoding="utf-8")
    print(summary)
    print(f"\n[figma-review] Summary written to {REVIEW_SUMMARY_PATH}")

    if args.decision is None:
        sys.exit(0)

    if args.decision == "approve":
        message = args.commit_message or f"Implement Figma node {normalize_node_id(args.node_id)}"
        sys.exit(do_approve(args.files, message, args.push))
    else:
        sys.exit(do_reject(args.files, args.node_id, args.reason))


if __name__ == "__main__":
    main()
