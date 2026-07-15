# Các bước triển khai (Implementation Steps)

> ### 📜 TÀI LIỆU LẬP KẾ HOẠCH BAN ĐẦU — Wave 0→4 về cơ bản ĐÃ XONG (cập nhật 2026-07-15)
>
> Giữ lại để tra cấu trúc và tiêu chí nghiệm thu. **Đừng dùng như to-do list để làm lại từ đầu.**
> Khác biệt lớn nhất so với kế hoạch:
> - **S1.A** dự định dựng phòng bằng `templates/` parametric → thực tế phòng **load từ
>   `truyenthong.glb`** (Blender, ánh sáng bake sẵn, render unlit). `templates/` chỉ còn là fallback.
> - **S0.3** dự định slot có `transform` trong JSON → thực tế slot nằm trong GLB (`VM_Slot_TT_*`),
>   viewer tự quét.
> - Mới có **1 phòng** (`room-truyenthong`), chưa làm nhiều thời kỳ / nhiều phòng.
>
> Trạng thái thực tế: [cloudflare.md](cloudflare.md) · [asset-workflow.md](asset-workflow.md) · [blender-bake-and-color.md](blender-bake-and-color.md).

Tài liệu giao cho agent để **implement**. Đọc kèm [CLAUDE.md](../CLAUDE.md) và [architecture-plan.md](architecture-plan.md).
Mỗi step có: **Phụ thuộc** (phải xong trước) · **Song song với** · **Bàn giao** (file/kết quả) · **Việc làm** · **Nghiệm thu** (Definition of Done).

> Quy ước: ID dạng `S<wave>.<n>`. Tên package: `@vm/shared`, `@vm/viewer`. Node ≥ 20, pnpm. TypeScript strict ở mọi nơi.

---

## Sơ đồ phụ thuộc & wave (cái nào chạy song song)

```
WAVE 0 (tuần tự, nền móng)
  S0.1 Scaffold monorepo
        └─► S0.2 @vm/shared (types + zod)
                  └─► S0.3 content.sample.json

WAVE 1 (song song sau Wave 0)   ── 3 nhánh độc lập ──
  ┌─ S1.A  @vm/viewer CORE  (render phòng, perf)      ◄ critical path
  ├─ S1.B  workers/api      (upload R2 + publish)
  └─ S1.C  infra            (wrangler, Pages, headers)

WAVE 2 (sau S1.A)
  └─ S2.D  @vm/viewer INTERACTION (slot click, portal, nav, gyro)

WAVE 3 (song song sau S2.D; F cần thêm S1.B)
  ┌─ S3.E  apps/web   (site khách)
  └─ S3.F  apps/admin (upload, gán slot, preview, publish)

WAVE 4 (sau Wave 3)
  └─ S4.G  Deploy + hardening + kiểm thử perf/mobile + bàn giao
```

**Gợi ý chia cho nhiều agent song song:** sau Wave 0, có thể chạy 3 agent cùng lúc cho **S1.A / S1.B / S1.C**. Sau S2.D, chạy 2 agent cho **S3.E / S3.F**. Mỗi nhánh chỉ phụ thuộc `@vm/shared` (đã đông cứng ở Wave 0) → ít xung đột.

---

## WAVE 0 — Nền móng (tuần tự)

### S0.1 — Scaffold monorepo
- **Phụ thuộc:** không. **Song song với:** —
- **Bàn giao:** `pnpm-workspace.yaml`, root `package.json`, `tsconfig.base.json`, `.gitignore`, `.editorconfig`, `prettier`/`eslint` config, `README.md`.
- **Việc làm:**
  - `pnpm-workspace.yaml` gồm `apps/*`, `packages/*`, `workers/*`.
  - `tsconfig.base.json`: `strict: true`, `moduleResolution: bundler`, path alias `@vm/*`.
  - Scripts root: `dev`, `build`, `lint`, `typecheck`, `validate:content`.
  - Khởi tạo `git` (repo hiện chưa có git) + commit nền móng.
- **Nghiệm thu:** `pnpm install` chạy sạch; `pnpm typecheck` pass (rỗng cũng OK); cấu trúc thư mục đúng CLAUDE.md §3.

### S0.2 — Package `@vm/shared` (data model + validate)
- **Phụ thuộc:** S0.1. **Song song với:** —
- **Bàn giao:** `packages/shared/src/{types.ts, schema.ts, constants.ts, validate.ts, index.ts}` + test.
- **Việc làm:**
  - `types.ts`: `Period, Room, Slot, Viewpoint, Item, Content` (đúng CLAUDE.md §4).
  - `schema.ts`: zod schema phản chiếu types; `ContentSchema` cho toàn bộ file.
  - `constants.ts`: enum `RoomTemplate ('hall'|'gallery'|'corridor'|'honor')`, `LightingPreset ('warm'|'neutral'|'cool')`, `SlotType`, mục tiêu kích thước ảnh (thumb/wall/full), hằng số **ngân sách perf** (maxDrawCalls=150, dprDesktop=[1,1.5], dprMobile=1...).
  - `validate.ts`: `parseContent(input): Content` — dùng zod, throw lỗi rõ ràng.
  - Build bằng `tsup` (esm + dts).
- **Nghiệm thu:** vitest: parse content hợp lệ → pass; content sai (thiếu field/sai enum) → throw. `pnpm --filter @vm/shared build` ra `dist` + `.d.ts`.

### S0.3 — Seed `content.sample.json` (1 phòng mẫu)
- **Phụ thuộc:** S0.2. **Song song với:** —
- **Bàn giao:** `content/content.sample.json`, `content/textures/` (placeholder tường/sàn), `content/images/` (placeholder), script `validate:content`.
- **Việc làm:**
  - 1 `period` (vd "1975–1985"), 1 `room` template `gallery`, **2–3 viewpoint**, **8–12 slot** với `transform` (vị trí/kích thước trên tường), 8–12 `item` trỏ ảnh placeholder.
  - Script `validate:content` chạy `parseContent` lên file này.
- **Nghiệm thu:** `pnpm validate:content` pass. Dữ liệu đủ để render 1 phòng đầy slot.

> **Đông cứng `@vm/shared` sau Wave 0.** Mọi nhánh sau dựa vào nó — đổi schema phải thông báo và cập nhật đồng bộ.

---

## WAVE 1 — 3 nhánh song song

### S1.A — `@vm/viewer` CORE (render phòng + perf) ◄ critical path
- **Phụ thuộc:** S0.2 (+ S0.3 để test). **Song song với:** S1.B, S1.C.
- **Bàn giao:** `packages/viewer/src/`: `SceneCanvas.tsx`, `RoomScene.tsx`, `templates/*`, `lighting/*`, `TextureManager.ts`, `PerfGuard.ts`, một dev harness (`examples/` hoặc Storybook/Vite page) render `content.sample.json`.
- **Việc làm:**
  - `SceneCanvas`: `<Canvas>` cấu hình theo §6 — `dpr` từ constants, **không shadow**, `frameloop="demand"` khi tĩnh, frustum culling on, antialias hợp lý.
  - `templates/`: hàm parametric dựng tường/sàn/trần cho 4 template (hộp đơn giản, merge geometry).
  - `lighting/`: 3 preset (ambient + ít directional/point, **không** real-time shadow).
  - `TextureManager`: KTX2Loader + fallback WebP/JPG, **lazy-load theo khoảng cách/tầm nhìn**, LRU cache, `dispose()` khi rời phòng.
  - `PerfGuard`: dò GPU tier (vd `useDetectGPU`) → set quality, hạ dpr/tắt hiệu ứng nếu yếu.
  - Hiển thị `<Stats>`/drawcall ở dev để kiểm chứng ngân sách.
- **Nghiệm thu:** render phòng mẫu **60fps desktop**; **draw calls < 150**; texture nạp lười (mở DevTools thấy chỉ tải texture slot gần camera); KHÔNG có shadow/post-FX trong scene graph.

### S1.B — `workers/api` (upload R2 + publish)
- **Phụ thuộc:** S0.2 (dùng zod để validate publish). **Song song với:** S1.A, S1.C.
- **Bàn giao:** `workers/api/src/index.ts`, `wrangler.toml` (binding R2), test/curl script.
- **Việc làm:**
  - `POST /upload-url`: trả **presigned PUT** lên R2 (S3-compatible API), gắn key `media/<id>/<variant>.<ext>`.
  - `POST /publish`: nhận draft content → `parseContent` (zod) → ghi `content.json` vào R2; trả version/timestamp.
  - Auth: kiểm `Cf-Access-Jwt-Assertion` (prod) / bearer token (dev). Khách xem KHÔNG chạm Worker.
  - CORS đúng cho domain admin.
- **Nghiệm thu:** local `wrangler dev`: xin được upload-url và PUT file thành công; publish content hợp lệ → ghi R2; content sai → 400 với lỗi zod.

### S1.C — `infra` (cấu hình hạ tầng)
- **Phụ thuộc:** S0.1. **Song song với:** S1.A, S1.B.
- **Bàn giao:** `infra/`: `wrangler.toml` mẫu, `_headers`/`_redirects` cho Pages (cache ảnh dài hạn, CORS), `.env.example`, README deploy (Pages web + admin, R2 bucket, custom domain, Cloudflare Access).
- **Việc làm:** viết cấu hình deploy cho cả **Cloudflare** lẫn **Nginx nội bộ** (CLAUDE.md "deploy-agnostic"). Header cache: ảnh `immutable`, `content.json` cache ngắn.
- **Nghiệm thu:** tài liệu đủ để 1 người làm theo deploy được; không chứa secret thật.

---

## WAVE 2 — Tương tác viewer

### S2.D — `@vm/viewer` INTERACTION (slot click, portal, nav, gyro)
- **Phụ thuộc:** S1.A. **Song song với:** S1.B/S1.C nếu còn chạy.
- **Bàn giao:** `SlotFrame.tsx`, `Portal.tsx`, `NavController.tsx` (+ types callback).
- **Việc làm:**
  - `SlotFrame`: plane gắn texture + mesh khung; hover highlight; `onSelect(slotId)`. Instancing cho khung lặp lại.
  - `Portal`: hotspot chuyển phòng → `onNavigate(roomId)`.
  - `NavController`: di chuyển camera giữa `viewpoint` (lerp mượt), OrbitControls có giới hạn; **toggle DeviceOrientation** cho mobile (cảm biến xoay).
- **Nghiệm thu:** click slot phát đúng `slotId`; chuyển viewpoint mượt; portal đổi phòng; bật/tắt gyro trên mobile thật hoạt động; vẫn trong ngân sách perf.

---

## WAVE 3 — Ứng dụng (song song)

### S3.E — `apps/web` (site khách)
- **Phụ thuộc:** S2.D. **Song song với:** S3.F.
- **Bàn giao:** `apps/web/src/`: `content/ContentProvider`, `pages/{Landing,Tour,Period}`, `ui/{TimelineNav,Minimap,InfoModal,AutoTour,Gallery2DFallback}`.
- **Việc làm:**
  - `ContentProvider`: fetch `content.json` (URL từ env/R2), `parseContent`, cache.
  - Landing (giới thiệu 50 năm) → TimelineNav (chọn thời kỳ) → Tour (render `@vm/viewer`) → click slot mở `InfoModal` (ảnh full, năm, mô tả, tag) → Portal sang phòng khác.
  - `Minimap`, `AutoTour` (kiosk tự chạy), mobile gyro toggle.
  - `Gallery2DFallback`: lưới ảnh + modal, dùng **cùng** content.json, kích hoạt khi PerfGuard báo GPU yếu.
- **Nghiệm thu:** đi hết tour mẫu; modal hiển thị đúng item; mobile xoay cảm biến chạy; ép GPU yếu → fallback 2D; Lighthouse perf hợp lý; site **tĩnh** (không gọi backend khi xem).

### S3.F — `apps/admin` (quản lý nội dung)
- **Phụ thuộc:** S2.D (preview) + S1.B (upload/publish). **Song song với:** S3.E.
- **Bàn giao:** `apps/admin/src/`: `auth/`, `periods/`, `rooms/`, `items/`, `assign/`, `preview/`, `publish/`.
- **Việc làm:**
  - `auth`: gate qua Cloudflare Access (prod), bypass ở dev.
  - `PeriodManager`, `RoomManager` (chọn template + texture tường/sàn, đặt viewpoint, đặt/sửa vị trí slot qua form hoặc editor trực quan).
  - `ItemLibrary`: chọn file → **resize client-side (canvas)** ra **thumb/wall/full** → xin `/upload-url` → PUT R2 → lưu URL + metadata.
  - `AssignItemToSlot`: chọn phòng → slot → gán item (thao tác lõi "thả ảnh vào block").
  - `PreviewPane`: render `@vm/viewer` với draft content trong bộ nhớ (giống site thật).
  - `Publish`: POST draft → `/publish`.
- **Nghiệm thu:** round-trip đầy đủ: upload ảnh → gán vào slot → preview thấy đúng → publish → `content.json` trên R2 đổi → site web hiển thị nội dung mới. Người không rành kỹ thuật vẫn đổi được ảnh mà không vỡ layout.

---

## WAVE 4 — Hoàn thiện & bàn giao

### S4.G — Deploy + hardening + kiểm thử + bàn giao
- **Phụ thuộc:** S3.E, S3.F. **Song song với:** —
- **Bàn giao:** web + admin trên Cloudflare Pages; Worker deployed; R2 bucket; Cloudflare Access bảo vệ admin; analytics tối thiểu; SEO landing; tài liệu hướng dẫn team nội dung.
- **Việc làm:**
  - Deploy thật; gắn custom domain; bật Access cho /admin.
  - **Kiểm thử perf trên mobile thật** (đời thấp) → tinh chỉnh ngân sách/fallback.
  - Analytics nhẹ, meta SEO cho landing, auto-tour cho màn hình lớn.
  - Viết hướng dẫn "đổi ảnh trong 5 bước" cho team nội dung.
  - (Tùy chọn) chuẩn bị bản deploy **Nginx nội bộ** từ cùng build tĩnh.
- **Nghiệm thu:** site công khai chạy ổn desktop + mobile; admin đăng nhập + publish được; đạt ngân sách perf trên thiết bị thật; team nội dung tự thao tác theo tài liệu.

---

## Checklist xuyên suốt (áp cho mọi step)
- [ ] TypeScript strict, không `any` tùy tiện; type dùng chung lấy từ `@vm/shared`.
- [ ] Đụng tới render → tự soát **ngân sách perf** (CLAUDE.md §6): không shadow real-time, không post-FX, lazy texture, dpr cap.
- [ ] Validate dữ liệu ở ranh giới publish & load bằng zod.
- [ ] Không nhúng secret/khóa R2 vào client; ghi dữ liệu chỉ qua Worker.
- [ ] Slot cố định ở runtime public; chỉ admin chỉnh vị trí.
- [ ] Tách 3 tầng ảnh (thumb/wall/full); không treo ảnh gốc nặng lên tường.
- [ ] Giữ static & deploy-agnostic (copy được sang Nginx nội bộ).
```
