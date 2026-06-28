#!/usr/bin/env python3
"""
Phase 5 — Gate: Code Quality.

Runs four checks in order:
  1. tsc --noEmit            — blocks the gate on any type error
  2. arbitrary Tailwind scan — WARN only, never blocks (per skill design)
  3. axe-core a11y check     — blocks the gate on WCAG violations
  4. pnpm lint               — blocks the gate on lint errors

Checks that are skipped because required input wasn't provided (e.g. no
--route given for the a11y check) do NOT fail the gate — only checks that
actually ran and found problems do.

Usage:
  python scripts/figma-gate-quality.py \
      --files src/features/foo/components/Bar.tsx \
      --route /foo/bar [--base-url http://localhost:3000] \
      [--ignore-impact minor] [--skip-lint] [--skip-tsc]

Exit codes:
  0 = PASS (or only WARN-level findings)
  1 = FAIL (a blocking check failed)
"""

import argparse
import json
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path
from typing import List, Optional

ARTIFACTS_DIR = Path(".figma/artifacts")
GATE_OUTPUT_PATH = ARTIFACTS_DIR / "gate-quality.json"

SUBPROCESS_TIMEOUT_SECONDS = 180

# Heuristic for Tailwind arbitrary-value utilities, e.g. bg-[#3B82F6], w-[320px], text-[14px].
ARBITRARY_VALUE_PATTERN = re.compile(r"[a-zA-Z][a-zA-Z0-9-]*-\[[^\]\s]+\]")
QUOTED_STRING_PATTERN = re.compile(r"(\"[^\"]*\"|'[^']*'|`[^`]*`)")


def run_subprocess(cmd: List[str], cwd: Optional[str] = None) -> dict:
    """Run a command, capturing stdout/stderr/exit code. Distinguishes 'not found' from real failures."""
    binary = cmd[0]
    if shutil.which(binary) is None and not Path(binary).exists():
        return {
            "ranAt": int(time.time()),
            "returnCode": None,
            "output": "",
            "error": f"'{binary}' not found on PATH. Is it installed?",
        }

    try:
        proc = subprocess.run(
            cmd,
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=SUBPROCESS_TIMEOUT_SECONDS,
        )
        return {
            "ranAt": int(time.time()),
            "returnCode": proc.returncode,
            "output": (proc.stdout + proc.stderr).strip(),
            "error": None,
        }
    except subprocess.TimeoutExpired:
        return {
            "ranAt": int(time.time()),
            "returnCode": None,
            "output": "",
            "error": f"Command timed out after {SUBPROCESS_TIMEOUT_SECONDS}s: {' '.join(cmd)}",
        }


def check_typescript(skip: bool) -> dict:
    if skip:
        return {"status": "SKIPPED", "reason": "--skip-tsc passed"}

    result = run_subprocess(["pnpm", "exec", "tsc", "--noEmit"])
    if result["error"]:
        return {"status": "FAIL", "reason": result["error"]}

    if result["returnCode"] == 0:
        return {"status": "PASS", "output": result["output"]}

    error_lines = [line for line in result["output"].splitlines() if ": error TS" in line]
    return {
        "status": "FAIL",
        "errorCount": len(error_lines),
        "errors": error_lines[:50],  # cap to keep JSON readable
        "output": result["output"],
    }


def check_arbitrary_values(files: List[str]) -> dict:
    if not files:
        return {"status": "SKIPPED", "reason": "no --files provided"}

    matches = []
    for file_path in files:
        p = Path(file_path)
        if not p.exists():
            matches.append({"file": file_path, "error": "file not found"})
            continue

        content = p.read_text(encoding="utf-8")
        for quoted in QUOTED_STRING_PATTERN.finditer(content):
            string_literal = quoted.group(0)
            for hit in ARBITRARY_VALUE_PATTERN.finditer(string_literal):
                line_number = content[: quoted.start()].count("\n") + 1
                matches.append({"file": file_path, "line": line_number, "value": hit.group(0)})

    status = "WARN" if matches else "OK"
    return {"status": status, "matchCount": len(matches), "matches": matches}


def check_accessibility(route: Optional[str], base_url: str, ignore_impact: List[str]) -> dict:
    if not route:
        return {"status": "SKIPPED", "reason": "no --route provided"}

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        return {
            "status": "FAIL",
            "reason": "Playwright not installed. Install with: pip install playwright --break-system-packages && playwright install chromium",
        }

    try:
        from axe_playwright_python.sync_playwright import Axe
    except ImportError:
        return {
            "status": "FAIL",
            "reason": "axe-playwright-python not installed. Install with: pip install axe-playwright-python --break-system-packages",
        }

    url = base_url.rstrip("/") + route
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page()
            page.goto(url, timeout=15000, wait_until="load")
            axe = Axe()
            results = axe.run(page)
            browser.close()
    except Exception as e:
        return {"status": "FAIL", "reason": f"Failed to run a11y check on {url}: {e}"}

    violations = results.response.get("violations", []) if hasattr(results, "response") else []
    filtered_violations = [v for v in violations if v.get("impact") not in ignore_impact]

    status = "FAIL" if filtered_violations else "PASS"
    return {
        "status": status,
        "route": route,
        "violationCount": len(filtered_violations),
        "ignoredImpact": ignore_impact,
        "violations": [
            {
                "id": v.get("id"),
                "impact": v.get("impact"),
                "description": v.get("description"),
                "nodeCount": len(v.get("nodes", [])),
            }
            for v in filtered_violations
        ],
    }


def check_lint(skip: bool) -> dict:
    if skip:
        return {"status": "SKIPPED", "reason": "--skip-lint passed"}

    result = run_subprocess(["pnpm", "lint"])
    if result["error"]:
        return {"status": "FAIL", "reason": result["error"]}

    if result["returnCode"] == 0:
        return {"status": "PASS", "output": result["output"]}

    return {"status": "FAIL", "output": result["output"]}


def main():
    parser = argparse.ArgumentParser(description="Code quality gate.")
    parser.add_argument("--files", nargs="*", default=[], help="Generated file(s) to scan for arbitrary Tailwind values")
    parser.add_argument("--route", default=None, help="Route to run the a11y check against")
    parser.add_argument("--base-url", default="http://localhost:3000", help="Base URL of the running dev server")
    parser.add_argument(
        "--ignore-impact",
        default="",
        help="Comma-separated axe impact levels to ignore, e.g. 'minor' or 'minor,moderate'",
    )
    parser.add_argument("--skip-tsc", action="store_true", help="Skip the tsc --noEmit check")
    parser.add_argument("--skip-lint", action="store_true", help="Skip the pnpm lint check")
    args = parser.parse_args()

    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    ignore_impact = [s.strip() for s in args.ignore_impact.split(",") if s.strip()]

    checks = {
        "typescript": check_typescript(args.skip_tsc),
        "arbitraryValues": check_arbitrary_values(args.files),
        "accessibility": check_accessibility(args.route, args.base_url, ignore_impact),
        "lint": check_lint(args.skip_lint),
    }

    # Only typescript / accessibility / lint can fail the gate. arbitraryValues is WARN-only by design.
    blocking_checks = ["typescript", "accessibility", "lint"]
    failed_checks = [name for name in blocking_checks if checks[name]["status"] == "FAIL"]

    status = "FAIL" if failed_checks else "PASS"

    result = {
        "status": status,
        "checkedAt": int(time.time()),
        "failedChecks": failed_checks,
        "checks": checks,
    }

    GATE_OUTPUT_PATH.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"[figma-gate-quality] typescript: {checks['typescript']['status']}")
    print(f"[figma-gate-quality] arbitraryValues: {checks['arbitraryValues']['status']}"
          f" ({checks['arbitraryValues'].get('matchCount', 0)} found)" if checks['arbitraryValues']['status'] == 'WARN' else f"[figma-gate-quality] arbitraryValues: {checks['arbitraryValues']['status']}")
    print(f"[figma-gate-quality] accessibility: {checks['accessibility']['status']}")
    print(f"[figma-gate-quality] lint: {checks['lint']['status']}")

    if checks["arbitraryValues"]["status"] == "WARN":
        print("[figma-gate-quality] WARN: arbitrary Tailwind values found (not blocking):")
        for m in checks["arbitraryValues"]["matches"][:20]:
            print(f"  - {m.get('file')}:{m.get('line')} {m.get('value')}")

    if status == "FAIL":
        print(f"[figma-gate-quality] FAIL — blocking check(s) failed: {', '.join(failed_checks)}")
        print(f"[figma-gate-quality] Details written to {GATE_OUTPUT_PATH}")
        sys.exit(1)
    else:
        print(f"[figma-gate-quality] PASS")
        print(f"[figma-gate-quality] Details written to {GATE_OUTPUT_PATH}")
        sys.exit(0)


if __name__ == "__main__":
    main()
