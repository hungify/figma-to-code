#!/usr/bin/env python3
"""
Phase 4 — Gate: Visual Verify.

Primary check: pixel diff between the Figma reference screenshot
    (.figma/artifacts/screenshot-{nodeId}.png, saved by the agent during Phase 2's
get_screenshot call) and a live Playwright screenshot of the implemented
    route. Diff <=1% is exact pass, <=3% needs human accept, >3% fails.

Reference check (non-blocking): optional computed-style comparison via
--check-selector / --expected-color. Logged only, never fails the gate.

Usage:
  python scripts/figma-gate-visual.py --route /products/123 --node-id <nodeId> \
      [--base-url http://localhost:3000] [--exact-threshold 1.0] [--accept-threshold 3.0] \
      [--check-selector ".price" --expected-color "#3B82F6"]

Exit codes:
  0 = EXACT_PASS or NEEDS_HUMAN_ACCEPT
  1 = FAIL (diff over accept threshold, or gate could not run e.g. missing reference/server)
"""

import argparse
import json
import sys
import time
from pathlib import Path
from typing import Optional, Tuple

import numpy as np
from PIL import Image

ARTIFACTS_DIR = Path(".figma/artifacts")
GATE_OUTPUT_PATH = ARTIFACTS_DIR / "gate-visual.json"
SCRATCHPAD_PATH = ARTIFACTS_DIR / "scratchpad.json"

DEFAULT_EXACT_THRESHOLD_PERCENT = 1.0
DEFAULT_ACCEPT_THRESHOLD_PERCENT = 3.0
# Per-channel tolerance to absorb anti-aliasing / font-rendering noise.
# A pixel is only counted as "different" if any channel differs by more
# than this amount.
PIXEL_CHANNEL_TOLERANCE = 30


def normalize_node_id(node_id: str) -> str:
    if "-" in node_id and ":" not in node_id:
        parts = node_id.split("-")
        if len(parts) == 2 and all(p.isdigit() for p in parts):
            return ":".join(parts)
    return node_id


def node_id_for_filename(node_id: str) -> str:
    """Figma screenshots are conventionally saved with ':' kept as-is or as '-'; try both."""
    return normalize_node_id(node_id)


def find_reference_screenshot(node_id: str) -> Optional[Path]:
    normalized = node_id_for_filename(node_id)
    candidates = [
        ARTIFACTS_DIR / f"screenshot-{normalized}.png",
        ARTIFACTS_DIR / f"screenshot-{normalized.replace(':', '-')}.png",
    ]
    for c in candidates:
        if c.exists():
            return c
    return None


def get_viewport_size(reference_img: Image.Image) -> Tuple[int, int]:
    """
    Prefer the frame size recorded in scratchpad.json (Phase 2 output) so the
    live page is rendered at the same width/height as the Figma frame.
    Falls back to the reference screenshot's own dimensions.
    """
    if SCRATCHPAD_PATH.exists():
        try:
            scratchpad = json.loads(SCRATCHPAD_PATH.read_text(encoding="utf-8"))
            frame = scratchpad.get("frame", {})
            width, height = frame.get("width"), frame.get("height")
            if width and height:
                return (int(width), int(height))
        except (json.JSONDecodeError, TypeError, ValueError):
            pass

    return reference_img.size


def capture_screenshot(base_url: str, route: str, viewport: Tuple[int, int], output_path: Path) -> None:
    """Launch Playwright chromium, navigate to the route, save a screenshot."""
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print(
            "[figma-gate-visual] Playwright is not installed.\n"
            "  Install with: pip install playwright --break-system-packages && playwright install chromium",
            file=sys.stderr,
        )
        sys.exit(1)

    url = base_url.rstrip("/") + route
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page(viewport={"width": viewport[0], "height": viewport[1]})
            page.goto(url, timeout=15000, wait_until="load")
            page.screenshot(path=str(output_path))
            browser.close()
    except Exception as e:
        print(f"[figma-gate-visual] Failed to capture screenshot of {url}: {e}", file=sys.stderr)
        sys.exit(1)


def compute_diff(reference: Image.Image, actual: Image.Image, tolerance: int = PIXEL_CHANNEL_TOLERANCE) -> dict:
    """
    Compare two images pixel by pixel. If dimensions differ, actual is resized
    to match reference (dimension mismatch is recorded, since resizing can
    mask real layout differences).

    Returns dict with diffPercentage, dimensionMismatch, diffImage (PIL Image).
    """
    dimension_mismatch = reference.size != actual.size
    if dimension_mismatch:
        actual = actual.resize(reference.size)

    ref_arr = np.array(reference.convert("RGB"), dtype=np.int16)
    act_arr = np.array(actual.convert("RGB"), dtype=np.int16)

    abs_diff = np.abs(ref_arr - act_arr)
    pixel_diff_mask = np.any(abs_diff > tolerance, axis=2)  # shape (H, W), True where pixel differs

    total_pixels = pixel_diff_mask.size
    diff_pixels = int(np.sum(pixel_diff_mask))
    diff_percentage = (diff_pixels / total_pixels) * 100 if total_pixels else 0.0

    # Build a visualization: dim the reference image, highlight diff pixels in red.
    base = (ref_arr * 0.4).astype(np.uint8)
    diff_img_arr = base.copy()
    diff_img_arr[pixel_diff_mask] = [255, 0, 0]
    diff_image = Image.fromarray(diff_img_arr, mode="RGB")

    return {
        "diffPercentage": round(diff_percentage, 3),
        "diffPixels": diff_pixels,
        "totalPixels": total_pixels,
        "dimensionMismatch": dimension_mismatch,
        "referenceSize": reference.size,
        "actualSizeOriginal": actual.size if not dimension_mismatch else None,
        "diffImage": diff_image,
    }


def run_computed_style_check(base_url: str, route: str, selector: str, expected_color: str) -> dict:
    """
    Non-blocking reference check: compare a DOM element's computed background
    or text color against an expected value. Logged only, never fails the gate.
    """
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        return {"ran": False, "reason": "playwright not installed"}

    url = base_url.rstrip("/") + route
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page()
            page.goto(url, timeout=15000, wait_until="networkidle")
            element = page.query_selector(selector)
            if element is None:
                browser.close()
                return {"ran": True, "found": False, "selector": selector}

            computed_color = element.evaluate(
                "(el) => getComputedStyle(el).backgroundColor || getComputedStyle(el).color"
            )
            browser.close()
            return {
                "ran": True,
                "found": True,
                "selector": selector,
                "computedColor": computed_color,
                "expectedColor": expected_color,
                "note": "Logged only — does not affect gate status.",
            }
    except Exception as e:
        return {"ran": True, "found": False, "error": str(e)}


def main():
    parser = argparse.ArgumentParser(description="Visual verification gate (pixel diff).")
    parser.add_argument("--route", required=True, help="Route path to check, e.g. /products/123")
    parser.add_argument("--node-id", required=True, help="Figma node id matching the reference screenshot")
    parser.add_argument("--base-url", default="http://localhost:3000", help="Base URL of the running dev server")
    parser.add_argument(
        "--exact-threshold",
        type=float,
        default=DEFAULT_EXACT_THRESHOLD_PERCENT,
        help="Diff %% at or below this is an exact pass",
    )
    parser.add_argument(
        "--accept-threshold",
        type=float,
        default=DEFAULT_ACCEPT_THRESHOLD_PERCENT,
        help="Diff %% at or below this needs human accept instead of hard fail",
    )
    parser.add_argument("--check-selector", default=None, help="Optional CSS selector for non-blocking style check")
    parser.add_argument("--expected-color", default=None, help="Expected color for --check-selector (log only)")
    args = parser.parse_args()

    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)

    reference_path = find_reference_screenshot(args.node_id)
    if reference_path is None:
        print(
            f"[figma-gate-visual] No reference screenshot found for node-id={args.node_id} "
            f"in {ARTIFACTS_DIR}.\n"
            f"  Expected: screenshot-{node_id_for_filename(args.node_id)}.png "
            f"(saved during Phase 2's get_screenshot call).",
            file=sys.stderr,
        )
        result = {
            "status": "FAIL",
            "error": "REFERENCE_SCREENSHOT_NOT_FOUND",
            "nodeId": args.node_id,
            "checkedAt": int(time.time()),
        }
        GATE_OUTPUT_PATH.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
        sys.exit(1)

    reference_img = Image.open(reference_path)
    viewport = get_viewport_size(reference_img)

    actual_path = ARTIFACTS_DIR / f"actual-{node_id_for_filename(args.node_id).replace(':', '-')}.png"
    print(f"[figma-gate-visual] Capturing {args.base_url}{args.route} at viewport {viewport}...")
    capture_screenshot(args.base_url, args.route, viewport, actual_path)
    actual_img = Image.open(actual_path)

    diff_result = compute_diff(reference_img, actual_img)
    diff_path = ARTIFACTS_DIR / f"diff-{node_id_for_filename(args.node_id).replace(':', '-')}.png"
    diff_result["diffImage"].save(diff_path)

    diff_percentage = diff_result["diffPercentage"]
    if diff_percentage <= args.exact_threshold:
        status = "EXACT_PASS"
    elif diff_percentage <= args.accept_threshold:
        status = "NEEDS_HUMAN_ACCEPT"
    else:
        status = "FAIL"

    style_check = None
    if args.check_selector:
        style_check = run_computed_style_check(
            args.base_url, args.route, args.check_selector, args.expected_color
        )

    result = {
        "status": status,
        "nodeId": normalize_node_id(args.node_id),
        "route": args.route,
        "exactThreshold": args.exact_threshold,
        "acceptThreshold": args.accept_threshold,
        "diffPercentage": diff_percentage,
        "diffPixels": diff_result["diffPixels"],
        "totalPixels": diff_result["totalPixels"],
        "dimensionMismatch": diff_result["dimensionMismatch"],
        "referenceSize": list(diff_result["referenceSize"]),
        "referenceImage": str(reference_path),
        "actualImage": str(actual_path),
        "diffImage": str(diff_path),
        "checkedAt": int(time.time()),
    }
    if style_check is not None:
        result["computedStyleCheck"] = style_check

    GATE_OUTPUT_PATH.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")

    if diff_result["dimensionMismatch"]:
        print(
            f"[figma-gate-visual] WARN: dimension mismatch — reference is "
            f"{diff_result['referenceSize']}, actual was resized to match for diffing."
        )

    if status == "FAIL":
        print(
            f"[figma-gate-visual] FAIL — diff {diff_percentage}% "
            f"exceeds accept threshold {args.accept_threshold}%."
        )
        print(f"[figma-gate-visual] See {diff_path} for visual diff.")
        sys.exit(1)
    if status == "NEEDS_HUMAN_ACCEPT":
        print(
            f"[figma-gate-visual] NEEDS_HUMAN_ACCEPT — diff {diff_percentage}% "
            f"is above exact threshold {args.exact_threshold}% and within accept threshold {args.accept_threshold}%."
        )
        print(f"[figma-gate-visual] See {diff_path} for visual diff.")
        sys.exit(0)

    print(f"[figma-gate-visual] EXACT_PASS — diff {diff_percentage}% within exact threshold {args.exact_threshold}%.")
    sys.exit(0)


if __name__ == "__main__":
    main()
