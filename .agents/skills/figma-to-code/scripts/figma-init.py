#!/usr/bin/env python3
"""
Phase 0 — Cache Figma file structure (once per day).

Calls the Figma REST API to fetch a file's node tree, stores a trimmed-down
summary in .figma/cache/manifest.json. Later phases (gate-design, etc.) read
this cache instead of hitting the API every time.

Token source:
  .env at project root (key FIGMA_ACCESS_TOKEN=...)

Usage:
  python scripts/figma-init.py --file-key <key> [--force]

Exit codes:
  0 = cache ready (freshly fetched or existing cache still within TTL)
  1 = error (missing token, API error, bad file-key...)
"""

import argparse
import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

CACHE_DIR = Path(".figma/cache")
CACHE_TTL_SECONDS = 24 * 60 * 60
FIGMA_API_BASE = "https://api.figma.com/v1"


def resolve_token() -> str:
    """Resolve Figma API token from .env file at project root."""
    env_path = Path(".env")
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            if key.strip() == "FIGMA_ACCESS_TOKEN":
                value = value.strip().strip('"').strip("'")
                if value:
                    return value

    print(
        "[figma-init] FIGMA_ACCESS_TOKEN not found in .env.\n"
        "  Add to .env at project root: FIGMA_ACCESS_TOKEN=figd_xxx\n"
        "  Get a token at: https://www.figma.com/developers/api#access-tokens",
        file=sys.stderr,
    )
    sys.exit(1)


def fetch_figma_file(file_key: str, token: str) -> dict:
    """Fetch the full file JSON from Figma REST API."""
    url = f"{FIGMA_API_BASE}/files/{file_key}"
    req = urllib.request.Request(url, headers={"X-Figma-Token": token})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        if e.code == 403:
            print(
                f"[figma-init] 403 Forbidden. Token has no access to file-key={file_key}.\n"
                f"  Check: token is still valid, and the file is shared with the token's account.",
                file=sys.stderr,
            )
        elif e.code == 404:
            print(
                f"[figma-init] 404 Not Found. file-key={file_key} may be incorrect.",
                file=sys.stderr,
            )
        else:
            print(f"[figma-init] HTTP {e.code}: {body}", file=sys.stderr)
        sys.exit(1)
    except urllib.error.URLError as e:
        print(f"[figma-init] Network error calling Figma API: {e}", file=sys.stderr)
        sys.exit(1)


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
    """Frame/Group with >1 child is treated as a container that should use auto layout."""
    return (
        node.get("type") in ("FRAME", "GROUP", "COMPONENT", "COMPONENT_SET", "INSTANCE")
        and len(node.get("children", [])) > 1
    )


def summarize_node(node: dict, depth: int = 0, max_depth: int = 12) -> dict:
    """
    Trim down a single node: keep id/name/type/key-style-info, recurse into children.
    Truncates at max_depth to avoid bloating the cache on very deep trees.
    """
    summary = {
        "id": node.get("id"),
        "name": node.get("name"),
        "type": node.get("type"),
    }

    if "layoutMode" in node:
        summary["layoutMode"] = node["layoutMode"]
        summary["itemSpacing"] = node.get("itemSpacing")
        summary["paddingLeft"] = node.get("paddingLeft")
        summary["paddingRight"] = node.get("paddingRight")
        summary["paddingTop"] = node.get("paddingTop")
        summary["paddingBottom"] = node.get("paddingBottom")

    if "absoluteBoundingBox" in node:
        box = node["absoluteBoundingBox"]
        summary["box"] = {"w": box.get("width"), "h": box.get("height")}

    style_refs = node.get("styles")
    if style_refs:
        summary["styleRefs"] = style_refs

    flags = []
    if is_raw_hex_fill(node):
        flags.append("RAW_HEX_FILL")
    if is_layout_container(node) and not has_auto_layout(node):
        flags.append("MISSING_AUTO_LAYOUT")
    if flags:
        summary["flags"] = flags

    children = node.get("children")
    if children and depth < max_depth:
        summary["children"] = [
            summarize_node(c, depth + 1, max_depth) for c in children
        ]
    elif children:
        summary["childrenCount"] = len(children)
        summary["truncated"] = True

    return summary


def build_manifest(file_key: str, raw: dict) -> dict:
    """Build the trimmed-down manifest from the raw Figma file JSON."""
    document = raw.get("document", {})
    pages = document.get("children", [])

    summarized_pages = []
    for page in pages:
        summarized_pages.append(
            {
                "id": page.get("id"),
                "name": page.get("name"),
                "type": page.get("type"),
                "children": [summarize_node(c) for c in page.get("children", [])],
            }
        )

    return {
        "fileKey": file_key,
        "fileName": raw.get("name"),
        "lastModified": raw.get("lastModified"),
        "version": raw.get("version"),
        "cachedAt": int(time.time()),
        "pages": summarized_pages,
    }


def main():
    parser = argparse.ArgumentParser(
        description="Cache Figma file structure (trimmed down)."
    )
    parser.add_argument(
        "--file-key", required=True, help="Figma file key (from the Figma link)"
    )
    parser.add_argument(
        "--force", action="store_true", help="Ignore TTL, force re-fetch"
    )
    args = parser.parse_args()

    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    manifest_path = CACHE_DIR / "manifest.json"

    if manifest_path.exists() and not args.force:
        try:
            existing = json.loads(manifest_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            existing = None

        if existing and existing.get("fileKey") == args.file_key:
            age = time.time() - existing.get("cachedAt", 0)
            if age < CACHE_TTL_SECONDS:
                print(
                    f"[figma-init] Cache still fresh ({int(age / 60)} min old). "
                    f"Using cache. Use --force to refresh."
                )
                sys.exit(0)

    print(f"[figma-init] Fetching file-key={args.file_key} from Figma API...")
    token = resolve_token()
    raw = fetch_figma_file(args.file_key, token)
    manifest = build_manifest(args.file_key, raw)

    # Write to a temp file then rename, so a failed run never corrupts an existing cache.
    tmp_path = manifest_path.with_suffix(".json.tmp")
    tmp_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    tmp_path.replace(manifest_path)

    page_count = len(manifest["pages"])
    print(
        f"[figma-init] OK. Cached '{manifest['fileName']}' "
        f"({page_count} pages) -> {manifest_path}"
    )


if __name__ == "__main__":
    main()
