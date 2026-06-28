#!/usr/bin/env python3
"""
Phase 0 — Setup / Bootstrap (run once, before figma-init.py).

Checks every dependency the figma-implement pipeline scripts need, and
auto-installs anything missing. Designed to be run by the agent itself
(via bash) at the start of a pipeline run — the human should not need to
type install commands manually.

Checks:
  - Python packages: numpy, Pillow, playwright, axe-playwright-python
  - Playwright's Chromium browser binary
  - Node.js + pnpm on PATH (cannot be auto-installed safely — reported only)
  - .env with FIGMA_ACCESS_TOKEN (reported only — can't auto-generate a token)

Usage:
  python scripts/figma-setup.py [--check-only]

Exit codes:
  0 = everything ready (already present, or successfully auto-installed)
  1 = something is missing that could not be auto-installed (Node/pnpm/token)
"""

import argparse
import importlib.util
import shutil
import subprocess
import sys
from pathlib import Path

REQUIRED_PYTHON_PACKAGES = {
    "numpy": "numpy>=1.26",
    "PIL": "Pillow>=10.0",
    "playwright": "playwright>=1.40",
    "axe_playwright_python": "axe-playwright-python>=0.1.7",
}

INSTALL_TIMEOUT_SECONDS = 300


def is_python_package_installed(module_name: str) -> bool:
    return importlib.util.find_spec(module_name) is not None


def pip_install(package_spec: str) -> tuple[bool, str]:
    cmd = [sys.executable, "-m", "pip", "install", package_spec, "--break-system-packages"]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=INSTALL_TIMEOUT_SECONDS)
        if proc.returncode == 0:
            return True, proc.stdout
        return False, proc.stdout + proc.stderr
    except subprocess.TimeoutExpired:
        return False, f"pip install timed out after {INSTALL_TIMEOUT_SECONDS}s"
    except Exception as e:
        return False, str(e)


def check_and_install_python_packages(check_only: bool) -> list[dict]:
    results = []
    for module_name, package_spec in REQUIRED_PYTHON_PACKAGES.items():
        if is_python_package_installed(module_name):
            results.append({"package": package_spec, "status": "ALREADY_INSTALLED"})
            continue

        if check_only:
            results.append({"package": package_spec, "status": "MISSING"})
            continue

        print(f"[figma-setup] Installing {package_spec}...")
        ok, output = pip_install(package_spec)
        if ok:
            results.append({"package": package_spec, "status": "INSTALLED"})
        else:
            results.append({"package": package_spec, "status": "INSTALL_FAILED", "error": output.strip()[-500:]})

    return results


def check_and_install_playwright_browser(check_only: bool) -> dict:
    # If playwright itself isn't installed, the browser check/install step can't run yet —
    # it will be handled on the next run once the package is installed.
    if not is_python_package_installed("playwright"):
        return {"status": "SKIPPED", "reason": "playwright package not installed yet"}

    try:
        from playwright.sync_api import sync_playwright

        with sync_playwright() as p:
            try:
                browser = p.chromium.launch()
                browser.close()
                return {"status": "ALREADY_INSTALLED"}
            except Exception:
                pass  # falls through to install below
    except Exception:
        pass

    if check_only:
        return {"status": "MISSING"}

    print("[figma-setup] Installing Playwright Chromium browser...")
    try:
        proc = subprocess.run(
            [sys.executable, "-m", "playwright", "install", "chromium"],
            capture_output=True,
            text=True,
            timeout=INSTALL_TIMEOUT_SECONDS,
        )
        if proc.returncode == 0:
            return {"status": "INSTALLED"}
        return {"status": "INSTALL_FAILED", "error": (proc.stdout + proc.stderr).strip()[-500:]}
    except subprocess.TimeoutExpired:
        return {"status": "INSTALL_FAILED", "error": f"timed out after {INSTALL_TIMEOUT_SECONDS}s"}
    except Exception as e:
        return {"status": "INSTALL_FAILED", "error": str(e)}


def check_node_and_pnpm() -> dict:
    """Node.js and pnpm are not auto-installed — too invasive to a developer's machine to do silently."""
    node_path = shutil.which("node")
    pnpm_path = shutil.which("pnpm")

    result = {
        "node": {"status": "FOUND", "path": node_path} if node_path else {"status": "MISSING"},
        "pnpm": {"status": "FOUND", "path": pnpm_path} if pnpm_path else {"status": "MISSING"},
    }
    if not node_path:
        result["node"]["installInstructions"] = "Install Node.js: https://nodejs.org/"
    if not pnpm_path:
        result["pnpm"]["installInstructions"] = "Install pnpm: npm install -g pnpm"

    return result


def check_figma_token() -> dict:
    """Token requires a human to generate it on figma.com — can't be auto-created."""
    env_path = Path(".env")
    if not env_path.exists():
        return {
            "status": "MISSING",
            "reason": ".env file not found",
            "instructions": (
                "Create .env at project root with: FIGMA_ACCESS_TOKEN=figd_xxx\n"
                "Get a token at: https://www.figma.com/developers/api#access-tokens"
            ),
        }

    content = env_path.read_text(encoding="utf-8")
    for line in content.splitlines():
        line = line.strip()
        if line.startswith("FIGMA_ACCESS_TOKEN=") and len(line.split("=", 1)[1].strip()) > 0:
            return {"status": "FOUND"}

    return {
        "status": "MISSING",
        "reason": "FIGMA_ACCESS_TOKEN not set in .env",
        "instructions": "Add to .env: FIGMA_ACCESS_TOKEN=figd_xxx",
    }


def main():
    parser = argparse.ArgumentParser(description="Bootstrap / dependency check for the figma-implement pipeline.")
    parser.add_argument(
        "--check-only", action="store_true", help="Report missing dependencies without installing anything"
    )
    args = parser.parse_args()

    print("[figma-setup] Checking Python packages...")
    python_results = check_and_install_python_packages(args.check_only)
    for r in python_results:
        print(f"  - {r['package']}: {r['status']}")

    print("[figma-setup] Checking Playwright Chromium browser...")
    browser_result = check_and_install_playwright_browser(args.check_only)
    print(f"  - chromium: {browser_result['status']}")

    print("[figma-setup] Checking Node.js / pnpm...")
    node_pnpm_result = check_node_and_pnpm()
    print(f"  - node: {node_pnpm_result['node']['status']}")
    print(f"  - pnpm: {node_pnpm_result['pnpm']['status']}")

    print("[figma-setup] Checking FIGMA_ACCESS_TOKEN...")
    token_result = check_figma_token()
    print(f"  - .env: {token_result['status']}")

    # Anything that could be auto-installed but wasn't (and isn't just check-only) is a real failure.
    install_failures = [r for r in python_results if r["status"] == "INSTALL_FAILED"]
    if browser_result["status"] == "INSTALL_FAILED":
        install_failures.append({"package": "chromium", "status": "INSTALL_FAILED", "error": browser_result.get("error")})

    # Things that can never be auto-installed: missing Node/pnpm or missing token always block.
    blocking_missing = []
    if node_pnpm_result["node"]["status"] == "MISSING":
        blocking_missing.append("node")
    if node_pnpm_result["pnpm"]["status"] == "MISSING":
        blocking_missing.append("pnpm")
    if token_result["status"] == "MISSING":
        blocking_missing.append("FIGMA_ACCESS_TOKEN")

    if args.check_only:
        missing = [r["package"] for r in python_results if r["status"] == "MISSING"]
        if browser_result["status"] == "MISSING":
            missing.append("chromium")
        if missing:
            print(f"[figma-setup] MISSING (not installed, --check-only): {', '.join(missing)}")

    if install_failures:
        print("[figma-setup] FAILED to auto-install:")
        for f in install_failures:
            print(f"  - {f['package']}: {f.get('error', 'unknown error')}")

    if blocking_missing:
        print(f"[figma-setup] BLOCKING — cannot auto-install: {', '.join(blocking_missing)}")
        for name in ("node", "pnpm"):
            if node_pnpm_result.get(name, {}).get("status") == "MISSING":
                print(f"  - {node_pnpm_result[name]['installInstructions']}")
        if token_result["status"] == "MISSING":
            print(f"  - {token_result['instructions']}")

    if install_failures or blocking_missing:
        sys.exit(1)

    print("[figma-setup] All dependencies ready.")
    sys.exit(0)


if __name__ == "__main__":
    main()
