---
name: figma-doc-sync
description: Sync AGENTS.md sau khi dev tự patch code. Dùng sau mỗi lần patch component — chỉ update AGENTS.md đã có sẵn, không tạo mới. Nếu chưa có AGENTS.md thì báo lỗi và yêu cầu chạy figma-implement trước. Không dùng khi implement mới hoặc regen.
---

# figma-doc-sync

Sau khi dev patch code xong, skill này update `AGENTS.md` để agent lần sau đọc được context đúng. Đây là gate bắt buộc, không được skip.

## Ngôn ngữ output

Mặc định trả lời bằng tiếng Việt. Nếu user dùng ngôn ngữ khác thì follow theo ngôn ngữ đó.

## Điều kiện tiên quyết

Tìm `AGENTS.md` gần nhất với file vừa thay đổi:

```
src/features/<feature>/components/<name>/AGENTS.md   (ưu tiên)
src/features/<feature>/AGENTS.md                     (fallback)
```

Nếu không tìm thấy: DỪNG ngay, báo lỗi.

```
"Không tìm thấy AGENTS.md. Hãy chạy figma-implement trước để tạo file này."
```

## Khi nào dùng skill này

- Dev vừa patch component theo Figma update nhỏ và cần sync docs
- Gọi sau figma-implement nếu cần update thêm sau khi approve

---

## Bước 1 — Xác định scope thay đổi

Đọc git diff của lần patch vừa rồi:

```bash
git diff HEAD~1 -- src/features/<feature>/
```

Xác định:

- File nào thay đổi
- Token nào thêm hoặc bỏ
- DOM structure có đổi không
- Có deviation mới so với Figma không

Nếu không rõ thay đổi gì: hỏi lại dev trước khi tiếp tục.

---

## Bước 2 — Update AGENTS.md

Chỉ update section có thay đổi thực sự, không rewrite toàn bộ file.

### Token Map

Nếu token thêm hoặc bỏ:

```md
## Token Map

| Figma Variable | Code Token        | Ghi chu      |
| -------------- | ----------------- | ------------ |
| color/primary  | color-primary-500 |              |
| spacing/md     | spacing-4         | them lan nay |
| color/surface  | --bg              | bo lan nay   |
```

### Deviations

Nếu có deviation mới hoặc deviation cũ không còn hiệu lực:

```md
## Deviations

| Element | Figma       | Code        | Ly do                  | Status   |
| ------- | ----------- | ----------- | ---------------------- | -------- |
| Button  | 48px height | 44px height | touch target min iOS   | active   |
| Gap     | 24px        | 20px        | token khong co gia tri | resolved |
```

### Patch Anchors

Nếu DOM structure thay đổi:

```md
## Patch Anchors

- data-figma-node-id="123:456" — FormContainer
- data-figma-node-id="123:457" — SubmitButton (them moi)
```

### Change History

Append-only, không bao giờ edit dòng cũ:

```md
## Change History

| Date       | Scope   | Changed                  | Trigger       |
| ---------- | ------- | ------------------------ | ------------- |
| 2026-06-27 | partial | button-color, header-gap | KH update #42 |
```

---

## Bước 3 — Update Golden Baseline

Nếu visual thay đổi, dù nhỏ:

```bash
pnpm figma:golden
```

---

## Bước 4 — Gate: Doc Sync Check

```bash
pnpm figma:gate:quality
```

Gate G4.6 verify: nếu file `.tsx` thay đổi mà `AGENTS.md` không thay đổi trong cùng commit thì FAIL.

---

## Luu y

- Chi update section co thay doi thuc su, khong rewrite toan bo file
- Change History la append-only, khong xoa hay sua dong cu
- Known deviations khong duoc tu y "fix"
- Neu khong ro thay doi gi: hoi lai dev truoc khi update
