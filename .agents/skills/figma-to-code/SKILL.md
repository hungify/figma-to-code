---
name: figma-to-code
description: Use when implementing a full page or page section from a Figma link in Codex, Claude Code, or Cursor, especially when the work needs feature-sliced code, section sub-agents, visual diff gates, and feature documentation.
---

# figma-to-code

Implement UI từ Figma theo pipeline chuẩn. Chạy từng phase theo thứ tự. Design/quality gate FAIL thì dừng codegen; visual diff có human accept flow.

## Ngôn ngữ output

Mặc định trả lời bằng tiếng Việt. Nếu user dùng ngôn ngữ khác thì follow theo ngôn ngữ đó.

## Điều kiện tiên quyết

Nếu prompt không có Figma link: hỏi lại ngay, không làm gì khác.

```
"Bạn cần cung cấp Figma link để tiếp tục. Ví dụ: https://figma.com/design/abc?node-id=10:20"
```

Parse file-key và node-id từ link trước khi bắt đầu pipeline.

Trước khi codegen, hỏi rõ scope:

1. Đây là full page hay section trong page?
2. Nếu full page: xin target route, ví dụ `/pricing`.
3. Nếu section: xin route chứa section nếu cần visual verify.

## Khi nào dùng skill này

- "Implement component/page này: <figma-link>"
- "Build cái này theo design: <figma-link>"
- "KH thay đổi lớn, làm lại từ đầu" kèm Figma link mới

Nếu KH chỉ thay đổi nhỏ và dev đã tự patch code, dùng `figma-doc-sync` thay thế.

## References phải đọc theo nhu cầu

- Đọc `references/artifact-contract.md` trước Phase 2 và Phase 6. Đây là hard contract, không phải guidance.
- Đọc `references/project-rules-template.md` trước Phase 3 để biết rule file và feature-slice structure.
- Đọc `references/page-decomposition.md` khi scope là full page hoặc cần sub-agent sections.
- Đọc `references/agent-adapters.md` nếu đang chạy ngoài Codex hoặc cần portable behavior cho Claude Code/Cursor.

## Paths

Trong command, dùng `SKILL_DIR` là folder chứa file `SKILL.md` này.

```bash
SKILL_DIR=.agents/skills/figma-to-code
```

Nếu skill được symlink/copy sang path khác, resolve lại `SKILL_DIR` trước khi chạy scripts.

---

## Phase 0 — Setup + Cache (1 lần/ngày)

Trước khi cache, check môi trường đủ dependency. Mặc định chạy check-only để không cài package ngoài ý muốn:

```bash
python3 "$SKILL_DIR/scripts/figma-setup.py" --check-only
```

- Exit 0: đủ dependency, tiếp tục.
- Exit 1: báo dev instructions in ra, dừng pipeline.
- Chỉ chạy không `--check-only` nếu user/project rules cho phép agent tự cài dependency.

Sau đó cache file structure:

```bash
python3 "$SKILL_DIR/scripts/figma-init.py" --file-key <key>
```

Kiểm tra `.figma/cache/manifest.json`:

- Nếu `cachedAt` < 24h: dùng cache, bỏ qua bước này
- Nếu cache miss hoặc expired: chạy init để refresh

---

## Phase 1 — Gate: Design Readiness

```bash
python3 "$SKILL_DIR/scripts/figma-gate-design.py" --file-key <key> --node-id <nodeId>
```

Đọc `.figma/artifacts/gate-design.json`:

- `status: FAIL`: vẫn tạo `.figma/artifacts/designer-feedback.md`, báo designer feedback cho dev, rồi DỪNG codegen.
- `status: PASS`: tiếp tục

---

## Phase 1.5 — Scope + Page Decomposition

Nếu scope là full page:

1. Đọc `references/page-decomposition.md`.
2. Dùng metadata/cache để chia page thành sections theo top-level frame children, name, bbox order.
3. Tạo `.figma/artifacts/<feature>/<screen>/page-plan.json`.
4. Spawn tối đa 4 sub-agents song song. Khi sub-agent xong, giao section tiếp theo.
5. Sub-agent chỉ tạo section component + docs. Main agent sở hữu route/page shell/integration.

Nếu scope là section:

1. Không chia page.
2. Implement 1 section component theo feature-slice structure.

---

## Phase 2 — Fetch Design Context

Trước Phase 2, đọc `references/artifact-contract.md` và tạo scoped artifact folder:

```bash
SCREEN_ARTIFACT_DIR=.figma/artifacts/<feature>/<screen>
mkdir -p "$SCREEN_ARTIFACT_DIR"
```

Gọi Figma MCP với node-id đã parse từ link, theo thứ tự:

1. `get_design_context(fileKey, nodeId)` — lấy full context (React + Tailwind)
2. `get_variable_defs(fileKey, nodeId)` — lấy variables used in selection
3. `get_screenshot(fileKey, nodeId)` — lưu vào `.figma/artifacts/screenshot-{nodeId}.png`

Lưu raw output của `get_variable_defs` vào `.figma/artifacts/variables-raw.json`.
Mirror raw output vào `$SCREEN_ARTIFACT_DIR/variables-raw.json`.

Nếu `get_design_context` trả về lỗi token quá lớn (truncated): gọi thêm `get_metadata(fileKey, nodeId)` để lấy node map tổng quan, tìm sub-node nhỏ hơn, rồi fetch lại `get_design_context` cho đúng sub-node đó. **Không** gọi `get_metadata` nếu không truncate — frame size/layout/padding đã có sẵn trong cache từ Phase 0, không cần fetch lại.

Chạy script đối chiếu token + lấy frame info từ cache:

```bash
python3 "$SKILL_DIR/scripts/figma-fetch-context.py" \
  --variables-json .figma/artifacts/variables-raw.json \
  --file-key <key> --node-id <nodeId> \
  --css-path src/app/globals.css
```

Nếu vừa gọi `get_metadata` ở bước truncate-fallback trên, truyền thêm `--metadata-json .figma/artifacts/metadata-raw.json` để dùng giá trị đó thay cache.

Script tự so sánh variables từ `get_variable_defs` với `globals.css`:

- Token có trong css: dùng token, ví dụ `bg-primary-500`
- Token không có trong css: WARN dev + dùng arbitrary value, ví dụ `bg-[#3B82F6]`

Kết quả ghi vào scratchpad (`.figma/artifacts/scratchpad.md`) và mirror sang `$SCREEN_ARTIFACT_DIR/scratchpad.json`. Scratchpad bắt buộc đủ fields trong `references/artifact-contract.md`.

```
Frame: W H
Layout: gap padding
Typography: size/weight/lineHeight
Tokens matched: --primary --bg ...
Tokens arbitrary: #3B82F6 (WARN: ngoài palette)
Components reused: Button, Input...
```

### Phát hiện shadcn component chưa cài

Từ output `get_design_context`, với mỗi component instance trong design (Button, Dialog, Select, Tabs, DropdownMenu, Input, Checkbox, ...):

1. Check xem đã tồn tại file `src/components/ui/<name>.tsx` chưa.
2. Nếu **đã có**: reuse, không cài lại.
3. Nếu **chưa có** nhưng tên khớp với 1 component trong shadcn registry chuẩn: chạy lệnh cài trước khi sang Phase 3, không tự viết lại logic component thuần để thay thế.

```bash
pnpm ui add <name>
```

1. Nếu **chưa có** và không khớp tên nào trong shadcn registry: đây là component custom của feature, để Phase 3 gen mới như bình thường.

Thêm vào scratchpad nội bộ:

```
Components reused: Button, Input...
Components installed (shadcn): Dialog, Select...
Components custom (gen mới): ProductCard...
```

Không được chỉ ghi `componentsInstalled: []`; phải ghi `shadcnChecked`, `shadcnReused`, `shadcnInstalled`, `customLookupUsed`, `customGenerated`.

---

## Phase 3 — Generate Code

Rules bắt buộc khi gen:

- Nếu Code Connect có sẵn: dùng Code Connect map, ví dụ `<Button variant="primary">`
- Nếu Code Connect không có: WARN dev, dùng `custom-component-lookup` registry trước khi grep thủ công
- Trước khi lookup custom component: đảm bảo registry có sẵn bằng `pnpm component-lookup info`; nếu thiếu, chạy `pnpm component-lookup:gen`
- Khi Figma node giống custom component: chạy `pnpm component-lookup figma "<node path>"` hoặc `pnpm component-lookup search <query>`
- Trước khi dùng custom component: chạy `pnpm component-lookup docs <ComponentName>` và copy import path/props chính xác
- Token có trong css: dùng token class
- Token không có: ưu tiên codebase-native token gần nhất, WARN designer update needed; chỉ dùng arbitrary value khi cần visual fidelity và ghi deviation vào docs
- Reuse existing components trong `src/components/ui/` (bao gồm các component shadcn vừa cài ở Phase 2)
- Full page: gen theo section components, không gen cả page trong 1 prompt
- Follow feature-slice structure từ `references/project-rules-template.md`
- Sub-agent không edit route/page shell; main agent integrate

Nếu Code Connect chưa setup: WARN dev trước khi gen, accuracy sẽ thấp.

Output section-specific:

```
src/features/<feature>/screens/<screen>/sections/<section>.tsx
```

Output shared component nếu dùng bởi 2+ screens:

```
src/features/<feature>/components/<component>.tsx
```

---

## Phase 4 — Gate: Visual Verify

```bash
python3 "$SKILL_DIR/scripts/figma-gate-visual.py" --route <route> --node-id <nodeId>
```

Primary — pixel diff (`screenshot-{nodeId}.png` vs Playwright screenshot):

- Diff <= 1%: exact pass
- Diff > 1% và <= 3%: ask human accept trong chat
- Diff > 3%: FAIL, đề xuất fix pass; human vẫn có thể override

Reference — computed style check: không block, chỉ log.

Đọc `.figma/artifacts/gate-visual.json`:

- `status: EXACT_PASS`: tiếp tục
- `status: NEEDS_HUMAN_ACCEPT`: hỏi dev trong chat, include diff path
- `status: FAIL`: báo diff path, đề xuất fix trước khi hỏi accept override

Với full page: chạy visual verify cho từng section và final full page.

Sau visual gate, mirror artifacts theo contract:

```bash
cp .figma/artifacts/gate-visual.json "$SCREEN_ARTIFACT_DIR/gate-visual.json"
cp .figma/artifacts/screenshot-<nodeId>.png "$SCREEN_ARTIFACT_DIR/reference.png"
cp .figma/artifacts/actual-<nodeId>.png "$SCREEN_ARTIFACT_DIR/actual.png"
cp .figma/artifacts/diff-<nodeId>.png "$SCREEN_ARTIFACT_DIR/diff.png"
```

---

## Phase 5 — Gate: Code Quality

```bash
python3 "$SKILL_DIR/scripts/figma-gate-quality.py" \
  --files src/features/<feature>/screens/<screen>/sections/<section>.tsx \
  --route <route>
```

Kiểm tra lần lượt:

- `tsc --noEmit`: không type error
- grep arbitrary values: WARN nếu có, không block
- Playwright a11y: không vi phạm WCAG
- `pnpm lint`: format sạch

Đọc `.figma/artifacts/gate-quality.json`:

- Bất kỳ check nào FAIL: DỪNG, báo lỗi cụ thể cho dev
- WARN vẫn phải ghi vào screen `AGENTS.md` phần Known Deviations/Quality Warnings

Sau quality gate, mirror `$SCREEN_ARTIFACT_DIR/gate-quality.json`.

---

## Phase 6 — Golden Baseline + Tạo AGENTS.md

```bash
python3 "$SKILL_DIR/scripts/figma-golden.py" \
  --node-id <nodeId> \
  --route <route> \
  --feature <feature> \
  --component <screen>
```

Tạo nested `AGENTS.md` theo feature-based slice:

```
src/features/<feature>/AGENTS.md
src/features/<feature>/screens/<screen>/AGENTS.md
```

Section docs nằm trong screen AGENTS hoặc section block của screen AGENTS. Không để docs chính trong `.figma/artifacts`; artifacts chỉ là evidence.

Trước khi kết thúc Phase 6, check hard contract:

- `page-plan.json` output paths khớp file thật.
- Screen `AGENTS.md` có đủ sections trong `references/artifact-contract.md`.
- Nếu visual status là `NEEDS_HUMAN_ACCEPT`, docs phải ghi `Human accepted: pending`.
- Nếu arbitrary values hoặc lint warnings tồn tại, docs phải ghi trong Known Deviations/Quality Warnings.
- Nếu shadcn component được dùng, docs/scratchpad phải ghi checked/reused/installed evidence.

---

## Phase 7 — Human Review

Bước 1, xem summary tổng hợp tất cả phase trước:

```bash
python3 "$SKILL_DIR/scripts/figma-review.py" --node-id <nodeId>
```

In ra + ghi `.figma/artifacts/review-summary.md`. Nếu có phase trước FAIL, summary sẽ cảnh báo rõ — đọc kỹ trước khi quyết.

Bước 2, dev quyết định:

```bash
# APPROVE: commit (mặc định không push, thêm --push nếu muốn push luôn)
python3 "$SKILL_DIR/scripts/figma-review.py" --node-id <nodeId> --decision approve \
  --files src/features/<feature>/screens/<screen>/<screen>.tsx \
  src/features/<feature>/screens/<screen>/sections/<section>.tsx \
  src/features/<feature>/screens/<screen>/AGENTS.md --push

# REJECT: rollback file (đã track -> revert về bản cũ, mới tạo -> xoá) + log lý do
python3 "$SKILL_DIR/scripts/figma-review.py" --node-id <nodeId> --decision reject \
  --files src/features/<feature>/screens/<screen>/sections/<section>.tsx \
  --reason "<lý do cụ thể>"
```

---

## Luu y

- Mỗi gate FAIL: DỪNG ngay, không tiếp tục phase tiếp theo
- Full page phải chia section, main agent integrate
- Arbitrary value chỉ dùng khi cần fidelity; luôn WARN + document deviation
- Component khớp tên shadcn nhưng chưa cài: luôn cài qua `pnpm ui add <name>`, không tự viết lại
- Codebase-native thắng Figma raw value; WARN designer update needed khi lệch design token
- Patch nhỏ sau initial implementation dùng `figma-doc-sync`
