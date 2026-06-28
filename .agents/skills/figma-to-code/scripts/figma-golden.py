#!/usr/bin/env python3
"""
Phase 6 — Golden Baseline + Tạo AGENTS.md.

1. Chụp Playwright screenshot của route đã implement → lưu làm golden baseline
2. Tạo AGENTS.md ở đúng 2 paths:
     - src/features/<feature>/screens/<screen>/AGENTS.md   (screen doc, luôn tạo)
     - src/features/<feature>/AGENTS.md                    (feature overview, chỉ tạo nếu chưa có)

AGENTS.md được populate từ các artifacts đã có:
  - .figma/artifacts/scratchpad.json  → token map, frame info
  - .figma/artifacts/gate-quality.json → arbitrary values (deviations)
  - .figma/artifacts/gate-visual.json → diff percentage

Usage:
  python scripts/figma-golden.py \\
      --node-id <nodeId> \\
      --route /path \\
      --feature auth \\
      --component authentication-page \\
      [--base-url http://localhost:3000]

Exit codes:
  0 = success
  1 = error
"""

import argparse
import json
import shutil
import sys
import time
from datetime import date
from pathlib import Path
from typing import Optional, Tuple

ARTIFACTS_DIR = Path(".figma/artifacts")

FEATURE_AGENTS_TEMPLATE = """# {feature_title} Feature

## Overview
<!-- Mô tả feature này làm gì, các components thuộc feature -->

## Components
<!-- Danh sách components trong feature này -->

## Shared Tokens
<!-- Tokens dùng chung cho toàn feature -->

## Change History
| Date | Component | Changed | Trigger |
|------|-----------|---------|---------|
"""

SCREEN_AGENTS_TEMPLATE = """# {screen_title}

## Meta
- Figma File Key: `{file_key}`
- Figma Node ID: `{node_id}`
- Figma Frame: {frame_name}, {frame_width} x {frame_height}
- Generated: {date}
- Feature: {feature}
- Route: {route}

## Design Intent
<!-- Screen này làm gì, sections/states đã implement -->

## Visual Gate
- Status: **{visual_status}**
- Diff: {diff_percentage}% (exact <= {exact_threshold}%, accept <= {accept_threshold}%)
- Human accepted: {human_accepted}

## Artifacts
| Artifact | Path |
|----------|------|
{artifact_rows}

## Sections
| Section | Path | Figma Node |
|---------|------|------------|
{section_rows}

## Token Map
| Figma Variable | Code Token | Ghi chu |
|----------------|------------|---------|
{token_map_rows}

## Component Dependencies
| Component | Import Path | Ly do dung |
|-----------|-------------|------------|
{component_rows}

## Known Deviations
| Element | Figma | Code | Ly do | Status |
|---------|-------|------|-------|--------|
{deviation_rows}

## Quality Warnings
{quality_warning_rows}

## Patch Anchors
- data-figma-node-id="{node_id}" — {screen_title} root
<!-- Thêm anchors cho các element chính bên trong -->

## Agent Context
- Figma Node ID: `{node_id}`
- Token constraints: chỉ dùng tokens trong Token Map trên
- Screen boundaries: screen-specific code ở `src/features/{feature}/screens/{screen}/`
- Shared component promotion: chỉ move sang `src/features/{feature}/components/` khi dùng bởi 2+ screens
- Route/data behavior belongs in `src/routes/*`; do not change auth/data behavior for visual-only patches
- Do not edit shared components for one screen unless adding an explicit reusable variant
- Known deviations: xem Deviations — không được tự ý revert những deviation có status active

## Change History
| Date | Scope | Changed | Trigger |
|------|-------|---------|---------|
| {date} | initial | Full implementation | figma-implement |
"""


def load_json_safe(path: Path) -> dict:
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}


def capture_golden_screenshot(
    base_url: str, route: str, node_id: str, viewport: Tuple[int, int]
) -> Optional[Path]:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("[figma-golden] Playwright not installed, skipping screenshot.", file=sys.stderr)
        return None

    output_path = ARTIFACTS_DIR / f"golden-{node_id.replace(':', '-')}.png"
    url = base_url.rstrip("/") + route

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page(viewport={"width": viewport[0], "height": viewport[1]})
            page.goto(url, timeout=15000, wait_until="load")
            page.screenshot(path=str(output_path), full_page=False)
            browser.close()
        print(f"[figma-golden] Golden screenshot saved: {output_path}")
        return output_path
    except Exception as e:
        print(f"[figma-golden] Failed to capture golden screenshot: {e}", file=sys.stderr)
        return None


def build_token_map_rows(scratchpad: dict) -> str:
    tokens = scratchpad.get("tokens", {})
    matched = scratchpad.get("matched", tokens.get("matched", scratchpad.get("tokensMatched", [])))
    arbitrary = scratchpad.get("arbitrary", tokens.get("arbitrary", scratchpad.get("tokensArbitrary", [])))

    rows = []
    for m in matched:
        if isinstance(m, str):
            rows.append(f"|  | {m} | matched |")
        else:
            rows.append(f"| {m.get('figmaVariable', '')} | {m.get('cssToken', '')} | matched |")
    for a in arbitrary:
        if isinstance(a, str):
            rows.append(f"|  | {a} | arbitrary/deviation |")
        else:
            rows.append(f"| {a.get('figmaVariable', '')} | {a.get('hex', '')} (arbitrary) | WARN: ngoai palette |")

    return "\n".join(rows) if rows else "<!-- Chua co token map -->"


def build_deviation_rows(quality: dict) -> str:
    arbitrary = quality.get("checks", {}).get("arbitraryValues", {}).get("matches", [])
    if not arbitrary:
        return "<!-- Chua co deviation -->"

    rows = []
    seen = set()
    for m in arbitrary[:10]:
        value = m.get("value", "")
        if value not in seen:
            seen.add(value)
            rows.append(f"| {m.get('file', '').split('/')[-1]} | — | {value} | arbitrary value | active |")

    return "\n".join(rows)


def build_component_rows(scratchpad: dict) -> str:
    components = scratchpad.get("components", {})
    rows = []
    for name in components.get("shadcnReused", []):
        rows.append(f"| {name} | `src/components/ui/*` | shadcn/ui reused |")
    for name in scratchpad.get("componentsReused", []):
        ui_path = Path("src/components/ui") / f"{name.replace('-', '_').lower()}.tsx"
        if ui_path.exists():
            rows.append(f"| {name} | `src/components/ui/{ui_path.name}` | shadcn/ui reused |")
        else:
            rows.append(f"| {name} | existing project component | reused; verify with component lookup if custom |")
    for name in components.get("shadcnInstalled", scratchpad.get("componentsInstalled", [])):
        rows.append(f"| {name} | `src/components/ui/*` | shadcn installed |")
    for name in components.get("customLookupUsed", []):
        rows.append(f"| {name} | see `component-lookup docs {name}` | custom registry reused |")
    for name in components.get("customGenerated", scratchpad.get("componentsCustom", [])):
        rows.append(f"| {name} | feature screen file | generated for this screen |")
    return "\n".join(rows) if rows else "<!-- Chua co component dependency evidence -->"


def build_artifact_rows(feature: str, screen: str, node_id: str, visual: dict) -> str:
    safe_node = node_id.replace(":", "-")
    base = Path(".figma/artifacts") / feature / screen
    rows = [
        ("Reference", base / "reference.png", visual.get("referenceImage")),
        ("Actual", base / "actual.png", visual.get("actualImage")),
        ("Diff", base / "diff.png", visual.get("diffImage")),
        ("Gate visual", base / "gate-visual.json", ".figma/artifacts/gate-visual.json"),
        ("Gate quality", base / "gate-quality.json", ".figma/artifacts/gate-quality.json"),
        ("Scratchpad", base / "scratchpad.json", ".figma/artifacts/scratchpad.json"),
        ("Golden", Path(".figma/artifacts") / f"golden-{safe_node}.png", None),
    ]
    return "\n".join(f"| {label} | `{primary if primary.exists() else fallback or primary}` |" for label, primary, fallback in rows)


def build_quality_warning_rows(quality: dict) -> str:
    rows = []
    for name, check in quality.get("checks", {}).items():
        if check.get("status") == "WARN":
            rows.append(f"- `{name}`: {check.get('matchCount', '')} warning(s). See gate-quality.json.")
        output = check.get("output", "")
        if isinstance(output, str) and "warning" in output.lower():
            rows.append(f"- `{name}` emitted warnings. See gate-quality.json.")
    return "\n".join(rows) if rows else "- None."


def build_section_rows(feature: str, screen: str, node_id: str) -> str:
    plan_path = Path(".figma/artifacts") / feature / screen / "page-plan.json"
    plan = load_json_safe(plan_path)
    rows = []
    for section in plan.get("sections", []):
        rows.append(
            f"| {section.get('name', '')} | `{section.get('output', '')}` | `{section.get('nodeId', '')}` |"
        )
    if rows:
        return "\n".join(rows)
    return f"| {screen} | `src/features/{feature}/screens/{screen}/{screen}.tsx` | `{node_id}` |"


def mirror_screen_artifacts(feature: str, screen: str, node_id: str) -> None:
    safe_node = node_id.replace(":", "-")
    target_dir = ARTIFACTS_DIR / feature / screen
    target_dir.mkdir(parents=True, exist_ok=True)
    copies = [
        (ARTIFACTS_DIR / "scratchpad.json", target_dir / "scratchpad.json"),
        (ARTIFACTS_DIR / "gate-design.json", target_dir / "gate-design.json"),
        (ARTIFACTS_DIR / "gate-quality.json", target_dir / "gate-quality.json"),
        (ARTIFACTS_DIR / "gate-visual.json", target_dir / "gate-visual.json"),
        (ARTIFACTS_DIR / "variables-raw.json", target_dir / "variables-raw.json"),
        (ARTIFACTS_DIR / f"screenshot-{node_id}.png", target_dir / "reference.png"),
        (ARTIFACTS_DIR / f"actual-{safe_node}.png", target_dir / "actual.png"),
        (ARTIFACTS_DIR / f"diff-{safe_node}.png", target_dir / "diff.png"),
    ]
    for source, target in copies:
        if source.exists():
            shutil.copyfile(source, target)


def main():
    parser = argparse.ArgumentParser(description="Phase 6: Golden baseline + AGENTS.md")
    parser.add_argument("--node-id", required=True)
    parser.add_argument("--route", required=True)
    parser.add_argument("--feature", required=True, help="Feature folder name, e.g. auth")
    parser.add_argument("--component", required=True, help="Screen name, e.g. authentication-page")
    parser.add_argument("--base-url", default="http://localhost:3000")
    args = parser.parse_args()

    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)

    # Load artifacts
    scratchpad = load_json_safe(ARTIFACTS_DIR / "scratchpad.json")
    quality = load_json_safe(ARTIFACTS_DIR / "gate-quality.json")
    visual = load_json_safe(ARTIFACTS_DIR / "gate-visual.json")
    design = load_json_safe(ARTIFACTS_DIR / "gate-design.json")
    feature_screen_dir = ARTIFACTS_DIR / args.feature / args.component
    feature_screen_dir.mkdir(parents=True, exist_ok=True)
    mirror_screen_artifacts(args.feature, args.component, args.node_id)

    # Viewport from scratchpad
    frame = scratchpad.get("frame", {})
    viewport = (int(frame.get("width") or 1440), int(frame.get("height") or 900))

    # Capture golden screenshot
    capture_golden_screenshot(args.base_url, args.route, args.node_id, viewport)

    today = date.today().isoformat()
    feature_title = args.feature.replace("-", " ").title()
    screen_title = args.component.replace("-", " ").title()

    # Screen-level AGENTS.md (luon tao/overwrite)
    screen_agents_path = Path(f"src/features/{args.feature}/screens/{args.component}/AGENTS.md")
    screen_agents_path.parent.mkdir(parents=True, exist_ok=True)

    screen_content = SCREEN_AGENTS_TEMPLATE.format(
        screen_title=screen_title,
        file_key=scratchpad.get("fileKey", design.get("fileKey", "")),
        node_id=args.node_id,
        frame_name=frame.get("name", "unknown"),
        frame_width=frame.get("width", "unknown"),
        frame_height=frame.get("height", "unknown"),
        date=today,
        feature=args.feature,
        screen=args.component,
        route=args.route,
        visual_status=visual.get("status", "NOT_RUN"),
        diff_percentage=visual.get("diffPercentage", "N/A"),
        exact_threshold=visual.get("exactThreshold", "N/A"),
        accept_threshold=visual.get("acceptThreshold", "N/A"),
        human_accepted="pending" if visual.get("status") == "NEEDS_HUMAN_ACCEPT" else "not required",
        artifact_rows=build_artifact_rows(args.feature, args.component, args.node_id, visual),
        section_rows=build_section_rows(args.feature, args.component, args.node_id),
        token_map_rows=build_token_map_rows(scratchpad),
        component_rows=build_component_rows(scratchpad),
        deviation_rows=build_deviation_rows(quality),
        quality_warning_rows=build_quality_warning_rows(quality),
    )
    screen_agents_path.write_text(screen_content, encoding="utf-8")
    print(f"[figma-golden] Screen AGENTS.md: {screen_agents_path}")

    # Feature-level AGENTS.md (chi tao neu chua ton tai)
    feature_agents_path = Path(f"src/features/{args.feature}/AGENTS.md")
    if not feature_agents_path.exists():
        feature_agents_path.write_text(
            FEATURE_AGENTS_TEMPLATE.format(feature_title=feature_title),
            encoding="utf-8",
        )
        print(f"[figma-golden] Feature AGENTS.md: {feature_agents_path} (new)")
    else:
        print(f"[figma-golden] Feature AGENTS.md already exists, skipping: {feature_agents_path}")

    # Summary
    diff_pct = visual.get("diffPercentage", "N/A")
    print(f"[figma-golden] Done. Visual diff: {diff_pct}%")
    sys.exit(0)


if __name__ == "__main__":
    main()
