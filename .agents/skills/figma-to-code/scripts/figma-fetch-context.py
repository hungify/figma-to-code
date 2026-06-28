#!/usr/bin/env python3
"""
Phase 2 — Fetch Design Context (orchestrator).

This script does NOT call the Figma MCP itself — Claude calls
get_design_context / get_variable_defs / get_screenshot directly and saves
their raw JSON output to disk. This script then:
  1. Parses CSS custom properties (design tokens) from the project's
     global stylesheet (e.g. globals.css).
  2. Parses Figma variables from get_variable_defs output.
  3. Matches Figma variables to CSS tokens by color VALUE (not name),
     since naming conventions between Figma and code commonly diverge.
  4. Reads frame width/height/layout from the Phase 0 cache
     (.figma/cache/manifest.json) instead of calling get_metadata — per
     Figma's own MCP guide, get_metadata is only meant to be called when
     get_design_context truncates due to size, not as a routine first step.
     Pass --metadata-json explicitly only for that fallback case.
  5. Writes a machine-readable scratchpad.json and a human-readable
     scratchpad.md summarizing the match results, following the format
     described in the figma-implement skill.

Usage:
  python scripts/figma-fetch-context.py \
      --variables-json .figma/artifacts/variables-raw.json \
      --file-key abc123 --node-id 10:20 \
      [--css-path src/app/globals.css] \
      [--metadata-json .figma/artifacts/metadata-raw.json]  # only if get_design_context truncated

If --css-path is omitted, the script searches a few common locations.

Exit codes:
  0 = scratchpad written successfully (matched tokens, arbitrary tokens, or both)
  1 = error (missing/invalid input files)
"""

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Optional, Tuple

ARTIFACTS_DIR = Path(".figma/artifacts")
SCRATCHPAD_JSON_PATH = ARTIFACTS_DIR / "scratchpad.json"
SCRATCHPAD_MD_PATH = ARTIFACTS_DIR / "scratchpad.md"
CACHE_PATH = Path(".figma/cache/manifest.json")

COMMON_CSS_PATHS = [
    "src/app/globals.css",
    "src/styles/globals.css",
    "app/globals.css",
    "styles/globals.css",
    "src/index.css",
    "src/app.css",
    "src/global.css",
]

# Color value tolerance: Figma RGB floats (0-1) rounded to 0-255 ints can be
# off by a shade from hand-written CSS hex due to float rounding. Allow a
# small per-channel delta when matching.
COLOR_MATCH_TOLERANCE = 2


def normalize_node_id(node_id: str) -> str:
    """Figma node ids appear as '123:456' in the API/manifest, '123-456' in URLs."""
    if "-" in node_id and ":" not in node_id:
        parts = node_id.split("-")
        if len(parts) == 2 and all(p.isdigit() for p in parts):
            return ":".join(parts)
    return node_id


def find_node_in_manifest(manifest: dict, node_id: str) -> Optional[dict]:
    target = normalize_node_id(node_id)

    def walk(node: dict):
        if node.get("id") == target:
            return node
        for child in node.get("children", []) or []:
            found = walk(child)
            if found is not None:
                return found
        return None

    for page in manifest.get("pages", []):
        found = walk(page)
        if found is not None:
            return found
    return None


def extract_frame_from_cache(file_key: str, node_id: str) -> dict:
    """
    Read frame width/height/layout/padding from the Phase 0 cache
    (.figma/cache/manifest.json) instead of calling get_metadata.
    """
    if not CACHE_PATH.exists():
        print(
            f"[figma-fetch-context] No cache found at {CACHE_PATH}.\n"
            f"  Run: python scripts/figma-init.py --file-key {file_key}",
            file=sys.stderr,
        )
        sys.exit(1)

    manifest = json.loads(CACHE_PATH.read_text(encoding="utf-8"))
    if manifest.get("fileKey") != file_key:
        print(
            f"[figma-fetch-context] Cache is for file-key={manifest.get('fileKey')}, "
            f"but you requested file-key={file_key}.\n"
            f"  Run: python scripts/figma-init.py --file-key {file_key} --force",
            file=sys.stderr,
        )
        sys.exit(1)

    node = find_node_in_manifest(manifest, node_id)
    if node is None:
        print(
            f"[figma-fetch-context] Node {node_id} not found in cached manifest.\n"
            f"  Refresh cache: python scripts/figma-init.py --file-key {file_key} --force",
            file=sys.stderr,
        )
        sys.exit(1)

    box = node.get("box") or {}
    return {
        "width": box.get("w"),
        "height": box.get("h"),
        "layoutMode": node.get("layoutMode"),
        "itemSpacing": node.get("itemSpacing"),
        "padding": {
            "top": node.get("paddingTop"),
            "right": node.get("paddingRight"),
            "bottom": node.get("paddingBottom"),
            "left": node.get("paddingLeft"),
        },
    }


def load_json(path: str, label: str) -> dict:
    p = Path(path)
    if not p.exists():
        print(f"[figma-fetch-context] {label} not found at {path}", file=sys.stderr)
        sys.exit(1)
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        print(f"[figma-fetch-context] {label} is not valid JSON: {e}", file=sys.stderr)
        sys.exit(1)


def find_css_path(explicit_path: Optional[str]) -> Optional[Path]:
    if explicit_path:
        p = Path(explicit_path)
        if not p.exists():
            print(f"[figma-fetch-context] --css-path given but not found: {explicit_path}", file=sys.stderr)
            sys.exit(1)
        return p

    for candidate in COMMON_CSS_PATHS:
        p = Path(candidate)
        if p.exists():
            return p

    return None


def hex_to_rgb(hex_str: str) -> Optional[Tuple[int, int, int]]:
    hex_str = hex_str.strip().lstrip("#")
    if len(hex_str) == 3:
        hex_str = "".join(c * 2 for c in hex_str)
    if len(hex_str) not in (6, 8):
        return None
    try:
        r = int(hex_str[0:2], 16)
        g = int(hex_str[2:4], 16)
        b = int(hex_str[4:6], 16)
        return (r, g, b)
    except ValueError:
        return None


def parse_css_color_value(value: str) -> Optional[Tuple[int, int, int]]:
    """Normalize a CSS color value (hex / rgb() / rgba()) to an (r, g, b) tuple."""
    value = value.strip()

    if value.startswith("#"):
        return hex_to_rgb(value)

    rgb_match = re.match(r"rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)", value)
    if rgb_match:
        return tuple(int(round(float(g))) for g in rgb_match.groups())

    # hsl() and named colors are not handled — too lossy to match reliably by value.
    return None


def extract_css_tokens(css_path: Path) -> list[dict]:
    """
    Extract CSS custom properties that look like color tokens, e.g.:
      --primary-500: #3B82F6;
      --bg: rgb(255, 255, 255);
    Returns a list of {name, rawValue, rgb}.
    """
    content = css_path.read_text(encoding="utf-8")
    tokens = []

    for match in re.finditer(r"(--[\w-]+)\s*:\s*([^;]+);", content):
        name, raw_value = match.group(1), match.group(2).strip()
        rgb = parse_css_color_value(raw_value)
        if rgb is not None:
            tokens.append({"name": name, "rawValue": raw_value, "rgb": rgb})

    return tokens


def figma_color_to_rgb(color: dict) -> Tuple[int, int, int]:
    """Figma colors are floats 0-1 per channel. Convert to 0-255 ints."""
    r = round(color.get("r", 0) * 255)
    g = round(color.get("g", 0) * 255)
    b = round(color.get("b", 0) * 255)
    return (r, g, b)


def rgb_to_hex(rgb: Tuple[int, int, int]) -> str:
    return "#{:02X}{:02X}{:02X}".format(*rgb)


def colors_match(a: Tuple[int, int, int], b: Tuple[int, int, int], tolerance: int = COLOR_MATCH_TOLERANCE) -> bool:
    return all(abs(a[i] - b[i]) <= tolerance for i in range(3))


def extract_figma_variables(variables_raw: dict) -> list[dict]:
    """
    Normalize get_variable_defs output into a flat list of
    {name, rgb, hex}. Only COLOR-type variables are considered for
    value-matching; other types (FLOAT, STRING, BOOLEAN) are passed through
    unmatched since they can't be matched by color value.
    """
    variables = []

    # get_variable_defs commonly returns either a flat dict of name->value
    # or a list of variable objects. Handle both shapes defensively.
    raw_vars = variables_raw.get("variables", variables_raw)

    if isinstance(raw_vars, dict):
        items = [{"name": k, **(v if isinstance(v, dict) else {"value": v})} for k, v in raw_vars.items()]
    elif isinstance(raw_vars, list):
        items = raw_vars
    else:
        items = []

    for item in items:
        name = item.get("name", "unknown")
        value = item.get("value", item.get("resolvedValue"))
        entry = {"name": name, "rgb": None, "hex": None, "matchable": False}

        if isinstance(value, dict) and all(k in value for k in ("r", "g", "b")):
            rgb = figma_color_to_rgb(value)
            entry["rgb"] = rgb
            entry["hex"] = rgb_to_hex(rgb)
            entry["matchable"] = True
        elif isinstance(value, str) and value.startswith("#"):
            rgb = hex_to_rgb(value)
            if rgb:
                entry["rgb"] = rgb
                entry["hex"] = rgb_to_hex(rgb)
                entry["matchable"] = True

        variables.append(entry)

    return variables


def match_variables_to_tokens(figma_vars: list[dict], css_tokens: list[dict]) -> dict:
    matched = []
    arbitrary = []
    unmatchable = []

    for var in figma_vars:
        if not var["matchable"]:
            unmatchable.append(var)
            continue

        found = None
        for token in css_tokens:
            if colors_match(var["rgb"], token["rgb"]):
                found = token
                break

        if found:
            matched.append(
                {
                    "figmaVariable": var["name"],
                    "hex": var["hex"],
                    "cssToken": found["name"],
                    "cssValue": found["rawValue"],
                }
            )
        else:
            arbitrary.append({"figmaVariable": var["name"], "hex": var["hex"]})

    return {"matched": matched, "arbitrary": arbitrary, "unmatchable": unmatchable}


def extract_frame_summary(metadata_raw: dict) -> dict:
    """Pull width/height/layout/typography hints out of get_metadata output, defensively."""
    node = metadata_raw.get("node", metadata_raw)
    box = node.get("absoluteBoundingBox") or {}

    summary = {
        "width": box.get("width"),
        "height": box.get("height"),
        "layoutMode": node.get("layoutMode"),
        "itemSpacing": node.get("itemSpacing"),
        "padding": {
            "top": node.get("paddingTop"),
            "right": node.get("paddingRight"),
            "bottom": node.get("paddingBottom"),
            "left": node.get("paddingLeft"),
        },
    }
    return summary


def render_markdown(scratchpad: dict) -> str:
    frame = scratchpad["frame"]
    lines = []
    lines.append(f"Frame: {frame.get('width')} x {frame.get('height')}")

    layout_parts = []
    if frame.get("layoutMode"):
        layout_parts.append(f"mode={frame['layoutMode']}")
    if frame.get("itemSpacing") is not None:
        layout_parts.append(f"gap={frame['itemSpacing']}")
    padding = frame.get("padding") or {}
    if any(v is not None for v in padding.values()):
        layout_parts.append(
            f"padding={padding.get('top')}/{padding.get('right')}/{padding.get('bottom')}/{padding.get('left')}"
        )
    lines.append(f"Layout: {' '.join(layout_parts) if layout_parts else 'n/a'}")

    lines.append("")
    lines.append("Tokens matched:")
    if scratchpad["matched"]:
        for m in scratchpad["matched"]:
            lines.append(f"  {m['cssToken']} ({m['cssValue']}) <- Figma '{m['figmaVariable']}' ({m['hex']})")
    else:
        lines.append("  (none)")

    lines.append("")
    lines.append("Tokens arbitrary (WARN: not in CSS, use arbitrary Tailwind value):")
    if scratchpad["arbitrary"]:
        for a in scratchpad["arbitrary"]:
            lines.append(f"  {a['hex']} <- Figma '{a['figmaVariable']}'")
    else:
        lines.append("  (none)")

    if scratchpad["unmatchable"]:
        lines.append("")
        lines.append("Non-color variables (not value-matched):")
        for u in scratchpad["unmatchable"]:
            lines.append(f"  {u['name']}")

    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="Phase 2 orchestrator: match Figma variables to CSS tokens.")
    parser.add_argument("--variables-json", required=True, help="Path to raw get_variable_defs output")
    parser.add_argument("--file-key", required=True, help="Figma file key (to look up frame info in Phase 0 cache)")
    parser.add_argument("--node-id", required=True, help="Figma node id (to look up frame info in Phase 0 cache)")
    parser.add_argument(
        "--metadata-json",
        default=None,
        help="Path to raw get_metadata output. Only needed as a fallback if get_design_context "
        "truncated and Claude had to call get_metadata to find a smaller sub-node — frame info "
        "is otherwise read from the Phase 0 cache automatically.",
    )
    parser.add_argument("--css-path", default=None, help="Path to project's global CSS file")
    args = parser.parse_args()

    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)

    variables_raw = load_json(args.variables_json, "variables JSON")

    if args.metadata_json:
        metadata_raw = load_json(args.metadata_json, "metadata JSON")
        frame_summary = extract_frame_summary(metadata_raw)
    else:
        frame_summary = extract_frame_from_cache(args.file_key, args.node_id)

    css_path = find_css_path(args.css_path)
    if css_path is None:
        print(
            "[figma-fetch-context] No CSS file found at common paths and --css-path not given.\n"
            "  Searched: " + ", ".join(COMMON_CSS_PATHS) + "\n"
            "  Pass explicitly: --css-path <path/to/globals.css>",
            file=sys.stderr,
        )
        sys.exit(1)

    css_tokens = extract_css_tokens(css_path)
    figma_vars = extract_figma_variables(variables_raw)
    match_result = match_variables_to_tokens(figma_vars, css_tokens)

    scratchpad = {
        "cssPath": str(css_path),
        "cssTokenCount": len(css_tokens),
        "frame": frame_summary,
        **match_result,
    }

    SCRATCHPAD_JSON_PATH.write_text(json.dumps(scratchpad, ensure_ascii=False, indent=2), encoding="utf-8")
    SCRATCHPAD_MD_PATH.write_text(render_markdown(scratchpad), encoding="utf-8")

    print(f"[figma-fetch-context] CSS tokens found: {len(css_tokens)} (from {css_path})")
    print(f"[figma-fetch-context] Matched: {len(match_result['matched'])}, "
          f"Arbitrary: {len(match_result['arbitrary'])}, "
          f"Unmatchable (non-color): {len(match_result['unmatchable'])}")
    if match_result["arbitrary"]:
        print("[figma-fetch-context] WARN: some variables have no matching CSS token:")
        for a in match_result["arbitrary"]:
            print(f"  - {a['figmaVariable']} ({a['hex']})")
    print(f"[figma-fetch-context] Scratchpad written to {SCRATCHPAD_JSON_PATH} and {SCRATCHPAD_MD_PATH}")


if __name__ == "__main__":
    main()
