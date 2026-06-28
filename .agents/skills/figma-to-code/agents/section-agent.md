# section-agent

Sub-agent được main agent spawn để implement 1 section/component độc lập.
Nhận vào: file-key, node-id, feature, screen, route. Chạy section pipeline rồi report về main agent.

## Input từ main agent

```
file-key:  <figma file key>
node-id:   <section node id>
feature:   <feature folder name, e.g. auth>
screen:    <screen folder name, e.g. login-page>
section:   <section name, e.g. hero-section>
route:     <dev server route, e.g. /auth/login>
base-url:  <dev server base url, default http://localhost:3000>
skill-dir: .agents/skills/figma-to-code
```

## Nhiệm vụ

Chạy figma-to-code pipeline cho node-id section được giao. Context của sub-agent chỉ chứa section này.

Sub-agent không được:

- Edit route/page shell.
- Commit/push.
- Overwrite `src/features/<feature>/screens/<screen>/AGENTS.md`.
- Update full-page artifacts hoặc final review summary.

Main agent sở hữu page shell, screen AGENTS.md, full-page visual verify, human accept, commit/push.

## Naming contract

- `section` phải là kebab-case, role-based, stable.
- Dùng suffix `-section` cho page sections: `hero-section`, `pricing-section`, `faq-section`.
- Không dùng Figma generic names như `frame-123`, `group-7`, `rectangle-42`.
- Trong prose dùng `node-id`; trong JSON dùng `nodeId`.

## Path setup

Trước mọi command:

```bash
SKILL_DIR=<skill-dir>
SECTION_ARTIFACT_DIR=.figma/artifacts/<feature>/<screen>/sections/<section>
mkdir -p "$SECTION_ARTIFACT_DIR"
```

## Phase 0 — Setup + Cache

```bash
python3 "$SKILL_DIR/scripts/figma-setup.py" --check-only
python3 "$SKILL_DIR/scripts/figma-init.py" --file-key <file-key>
```

Cache dùng chung với main agent (cùng file-key), không cần re-fetch nếu còn trong TTL 24h.

## Phase 1 — Gate: Design Readiness

```bash
python3 "$SKILL_DIR/scripts/figma-gate-design.py" --file-key <file-key> --node-id <node-id>
```

FAIL: report designer feedback path về main agent, dừng codegen cho section.

## Phase 2 — Fetch Design Context

### Phase 2a — MCP Fetch

Gọi theo thứ tự, validate response trước khi save. Artifacts lưu trong `$SECTION_ARTIFACT_DIR` để tránh conflict và để 100 screens vẫn search được:

1. `get_design_context(fileKey, nodeId)` — save `$SECTION_ARTIFACT_DIR/context.json`
2. `get_variable_defs(fileKey, nodeId)` — save `$SECTION_ARTIFACT_DIR/variables.json`
3. `get_screenshot(fileKey, nodeId)` — save/copy `$SECTION_ARTIFACT_DIR/figma.png`
   Nếu response có `"err"` hoặc status >= 400: DỪNG ngay.
   Nếu 429: chờ 60s, retry tối đa 3 lần.

Nếu screenshot tool trả local path, copy file đó sang `$SECTION_ARTIFACT_DIR/figma.png`. Nếu tool trả binary/base64, decode/save thành PNG.

Chỉ gọi `get_metadata(fileKey, nodeId)` khi `get_design_context` bị truncate; save `$SECTION_ARTIFACT_DIR/metadata.json`.

### Phase 2b — Color Check

```bash
python3 "$SKILL_DIR/scripts/figma-fetch-context.py" \
  --variables-json "$SECTION_ARTIFACT_DIR/variables.json" \
  --file-key <file-key> \
  --node-id <node-id>
```

Nếu đã gọi metadata do truncate, thêm `--metadata-json "$SECTION_ARTIFACT_DIR/metadata.json"`.

Đọc `.figma/artifacts/scratchpad.md` trước khi sang Phase 3.

### Phát hiện shadcn component chưa cài

Từ output `get_design_context`:

- Check `src/components/ui/<name>.tsx` đã tồn tại chưa
- Chưa có + khớp shadcn registry: `pnpm ui add <name>`
- Chưa có + không khớp: để Phase 3 gen mới

## Phase 3 — Generate Code

Rules bắt buộc:

- Đọc `scratchpad.md` trước, dùng token đã match
- Color có trong css: dùng token class
- Color không có: ưu tiên codebase-native token gần nhất, WARN designer update needed; arbitrary value chỉ dùng khi cần visual fidelity
- Reuse existing components trong `src/components/ui/`
- 1 component 1 lần
- Không edit route/page shell

Output:

```
src/features/<feature>/screens/<screen>/sections/<section>.tsx
```

## Phase 4 — Gate: Visual Verify

Gate script hiện tìm reference ở `.figma/artifacts/screenshot-{nodeId}.png`, nên tạo copy compatibility từ scoped artifact:

```bash
cp "$SECTION_ARTIFACT_DIR/figma.png" ".figma/artifacts/screenshot-<nodeId>.png"
```

```bash
python3 "$SKILL_DIR/scripts/figma-gate-visual.py" \
  --route <route> \
  --node-id <nodeId> \
  --base-url <base-url>
```

Copy outputs về section folder nếu tồn tại:

```bash
cp ".figma/artifacts/actual-<nodeId>.png" "$SECTION_ARTIFACT_DIR/actual.png" 2>/dev/null || true
cp ".figma/artifacts/diff-<nodeId>.png" "$SECTION_ARTIFACT_DIR/diff.png" 2>/dev/null || true
cp ".figma/artifacts/gate-visual.json" "$SECTION_ARTIFACT_DIR/gate-visual.json" 2>/dev/null || true
```

`EXACT_PASS`: report pass. `NEEDS_HUMAN_ACCEPT`: report diff path, không tự hỏi user. `FAIL`: report diff path; main agent quyết định fix pass hoặc hỏi override.

## Phase 5 — Gate: Code Quality

```bash
python3 "$SKILL_DIR/scripts/figma-gate-quality.py" \
  --files src/features/<feature>/screens/<screen>/sections/<section>.tsx \
  --route <route> \
  --base-url <base-url>
```

## Phase 6 — Section Report

Không chạy `figma-golden.py` trong sub-agent. Script đó ghi screen-level `AGENTS.md`; chạy song song sẽ overwrite docs.

Thay vào đó, ghi `$SECTION_ARTIFACT_DIR/section-report.json`:

```json
{
  "feature": "<feature>",
  "screen": "<screen>",
  "section": "<section>",
  "nodeId": "<node-id>",
  "route": "<route>",
  "status": "EXACT_PASS | NEEDS_HUMAN_ACCEPT | FAIL",
  "files": ["src/features/<feature>/screens/<screen>/sections/<section>.tsx"],
  "artifacts": {
    "figma": "$SECTION_ARTIFACT_DIR/figma.png",
    "actual": "$SECTION_ARTIFACT_DIR/actual.png",
    "diff": "$SECTION_ARTIFACT_DIR/diff.png",
    "gateVisual": "$SECTION_ARTIFACT_DIR/gate-visual.json"
  },
  "designerFeedback": "$SECTION_ARTIFACT_DIR/designer-feedback.md",
  "notes": ["token deviations, arbitrary values, component reuse, missing assets"]
}
```

Main agent collect report này để update screen AGENTS.md một lần sau all sections finish.

## Phase 7 — Report về main agent

Sub-agent KHÔNG tự commit. Thay vào đó, report kết quả về main agent:

```
section: <section>
node-id: <nodeId>
status: EXACT_PASS | NEEDS_HUMAN_ACCEPT | FAIL
diff: <diffPercentage>%
files:
  - src/features/<feature>/screens/<screen>/sections/<section>.tsx
section-report: .figma/artifacts/<feature>/<screen>/sections/<section>/section-report.json
gate-visual: <path to diff png nếu NEEDS_HUMAN_ACCEPT hoặc FAIL>
designer-feedback: <path nếu design gate FAIL hoặc token deviation>
```

Main agent collect tất cả section reports rồi mới chạy human review một lần duy nhất.

## Luu y

- Main agent dispatch tối đa 4 sub-agents song song; section tiếp theo chạy khi một sub-agent hoàn tất
- Artifact files dùng scoped folder `$SECTION_ARTIFACT_DIR`; flat `.figma/artifacts/*` chỉ là compatibility cho scripts hiện tại
- Sub-agent không commit, không push — đó là việc của main agent sau human review
- Nếu design/quality FAIL: dừng ngay, report FAIL về main agent kèm details
- Nếu visual `NEEDS_HUMAN_ACCEPT`: report về main agent; final approval bị block đến khi main agent hỏi human trong chat
