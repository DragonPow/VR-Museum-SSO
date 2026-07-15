# AGENTS.md — Phòng Truyền Thống Số 50 Năm

> Bộ nhớ dự án cho agent. Đọc file này đầu mỗi phiên trước khi code.
> Kế hoạch chi tiết: [docs/architecture-plan.md](docs/architecture-plan.md).
> **Các bước triển khai (giao cho agent implement): [docs/implementation-steps.md](docs/implementation-steps.md).**
> Đề bài gốc: [docs/requirement.md](docs/requirement.md). Phân tích nền: [docs/solution.md](docs/solution.md).

## 1. Mục tiêu sản phẩm

Website "Phòng truyền thống số" cho lễ kỷ niệm **50 năm thành lập công ty**. Khách mở web là tham quan được một bảo tàng số tổ chức **theo thời kỳ (timeline)**; mỗi thời kỳ có một/vài **phòng 3D**; trên tường mỗi phòng có các **slot (khung cố định)** để treo ảnh/nội dung lịch sử. Tham khảo UX: phòng truyền thống số BIDV (giàu hình ảnh, có hotspot, chuyển phòng, modal thông tin).

Yêu cầu cốt lõi (đừng làm sai 4 điều này):
1. **Chạy mượt trên web desktop + mobile**, mở được trên trình duyệt thường.
2. **Người làm nội dung chỉ cần "thả ảnh vào slot cố định"** — không phá layout, không cần biết code.
3. **Có chiều sâu 3D thật** (đẹp hơn ảnh 360 phẳng), nhưng **KHÔNG nặng** (đừng gánh cả engine game).
4. **Chi phí gần 0**, deploy tĩnh (server nội bộ 4–8GB RAM vẫn chạy được).

## 2. Quyết định kiến trúc đã chốt (KHÔNG tự đổi nếu chưa hỏi user)

| Hạng mục | Lựa chọn | Lý do |
|---|---|---|
| Render | **React Three Fiber** (R3F + drei), 3D nhẹ | Phòng sinh bằng code (không cần Blender); slot = mặt phẳng 3D thật → đổi ảnh chỉ sửa JSON; có chiều sâu; agent dựng được toàn bộ. |
| Public site | **Vite + React + TypeScript**, 100% **static** | Server chỉ phục vụ file → RAM server vô can; bài toán perf nằm ở GPU client + kích thước ảnh. |
| Quản lý nội dung | **Trang Admin riêng** (form upload → gán item vào slot → preview → publish) | User chọn. Thân thiện cho team nội dung không rành kỹ thuật. |
| Media storage | **Cloudflare R2** | Free 10GB, không tính phí egress; hợp với 100–200 ảnh. |
| Hosting | **Cloudflare Pages** (web + admin) | Free tier mạnh, custom domain. |
| Auth admin | **Cloudflare Access** (hoặc Worker JWT) | Bảo vệ /admin, không cần tự viết auth phức tạp. |
| Backend nhẹ | **Cloudflare Worker** | Cấp presigned URL upload R2 + xử lý "Publish" snapshot. |
| Content store (v1) | **JSON-in-R2** (`content.draft.json` → publish ra `content.json`) | Đơn giản nhất cho team nhỏ. Nâng lên **D1 (SQLite)** khi cần đa người sửa đồng thời. |

**Điểm mấu chốt về hiệu năng** (lý do không sợ server yếu): cả 3D lẫn panorama đều deploy **tĩnh** → server chỉ trả file, RAM không phải nút thắt. "3D nặng" chỉ xảy ra ở **GPU máy người xem** khi có shadow real-time / post-processing / mesh PBR nặng. Ta cấm những thứ đó (xem §6).

## 3. Cấu trúc thư mục (monorepo, pnpm workspaces)

```
virtual_museum/
├── apps/
│   ├── web/            # Public 3D museum (Vite + R3F) — site khách xem
│   └── admin/          # Admin SPA: upload ảnh, gán slot, preview, publish
├── packages/
│   ├── shared/         # Types + zod schema của data model, hằng số, util validate
│   └── viewer/         # "Engine" bảo tàng R3F dùng chung cho web & admin-preview
├── workers/
│   └── api/            # Cloudflare Worker: R2 presign upload + publish snapshot
├── content/            # Seed content.json mẫu + textures tường/sàn mẫu
├── infra/              # wrangler.toml, script deploy
├── docs/
└── AGENTS.md
```

`packages/viewer` là engine tái sử dụng: cả site public và nút "Preview" trong admin đều render qua cùng một engine → đảm bảo "preview giống hệt sản phẩm thật".

## 4. Data model (period → room → slot → item)

```ts
Period { id, slug, title, yearStart, yearEnd, order, description, themeColor }
Room   { id, periodId, slug, title, order,
         template,            // preset hình phòng: 'hall'|'gallery'|'corridor'|'honor'
         wallTextureId, floorTextureId, ceilingTextureId,
         lightingPreset,      // 'warm'|'neutral'|'cool' (KHÔNG dùng shadow real-time)
         entryViewpointId, viewpoints: Viewpoint[], slots: Slot[] }
Viewpoint { id, name, position:[x,y,z], lookAt:[x,y,z] }   // điểm dừng camera (on-rails)
Slot   { id, roomId, name,
         type,                // 'image'|'cluster'|'poster'|'video'|'text'
         transform: { position:[x,y,z], rotation:[x,y,z], size:[w,h] },  // trên tường
         frameStyle, itemId|null, visible }                 // itemId = ảnh đang treo
Item   { id, title, year, periodId, shortDesc, longDesc, tags[],
         mediaType,           // 'image'|'video'|'audio'
         thumbUrl, fullUrl,   // R2 URLs (đã resize sẵn ở admin)
         source, approvedBy, priority, status }             // status: 'draft'|'approved'
```

`content.json` = snapshot denormalized (đã ghép item vào slot) cho site public đọc 1 phát. Validate bằng zod ở `packages/shared` trước khi publish.

## 5. Input / Output

**Input:** ảnh lịch sử 50 năm (raw) + metadata (năm, caption, nguồn, người duyệt); texture tường/sàn (agent tạo bằng AI hoặc tải sẵn); preset phòng (định nghĩa trong code).
**Output:** (1) website bảo tàng tĩnh; (2) `content.json` + media tối ưu trên R2; (3) trang admin để sửa nội dung lâu dài.

## 6. NGÂN SÁCH HIỆU NĂNG — luật cứng, vi phạm là bug

- **CẤM** trong v1: real-time shadows, post-processing (bloom/SSAO/DOF), physics "đi bộ" nặng, mesh PBR nhiều polygon, GI.
- **Ánh sáng:** chỉ ambient + vài directional/point đơn giản; bóng đổ nếu cần thì **bake vào texture**, không tính real-time.
- **Texture ảnh:** ưu tiên **KTX2/Basis** (hoặc WebP/JPG đã resize). Bật mipmap. Thumb cho duyệt, full chỉ load khi mở modal.
- **Lazy load:** chỉ load texture của slot **trong tầm nhìn / gần camera**; LRU cache, giải phóng khi rời phòng. Chỉ preload phòng hiện tại + phòng kề.
- **Geometry:** phòng = hộp đơn giản, merge geometry; **instancing** cho khung/vật lặp lại.
- **Canvas:** `dpr={[1, 1.5]}` desktop, `dpr={1}` mobile; bật frustum culling; `frameloop="demand"` khi tĩnh nếu khả thi.
- **Điều hướng v1:** point-to-point giữa các `viewpoint` + xoay/nhìn quanh (không free-walk vô định để tránh lạc và tải nặng). Mobile: nút bật **DeviceOrientation** (cảm biến xoay).
- **PerfGuard:** phát hiện GPU yếu → giảm dpr/tắt hiệu ứng → cùng lắm fallback **gallery 2D** (lưới ảnh + modal) dùng chung data model.
- **Mục tiêu:** 60fps desktop / ≥30fps mobile; < ~150 draw calls/phòng; texture GPU đồng thời < ~50MB.

## 7. Module chính

**packages/viewer (engine):** `SceneCanvas` (cấu hình perf) · `RoomScene` (tường/sàn/trần/đèn từ preset) · `SlotFrame` (plane + khung, click → modal) · `Portal` (hotspot chuyển phòng) · `NavController` (viewpoint + orbit + gyro mobile) · `TextureManager` (lazy + LRU + KTX2) · `PerfGuard`.

**apps/web:** `ContentProvider` (fetch content.json) · `LandingPage` (giới thiệu 50 năm) · `TimelineNav` (chọn thời kỳ) · `Minimap` · `InfoModal` (chi tiết item) · `AutoTour` (kiosk) · `Gallery2DFallback`.

**apps/admin:** `Auth` · `PeriodManager` · `RoomManager` (chọn template + texture, đặt/sửa slot bằng form hoặc editor trực quan) · `ItemLibrary` (upload + **resize client-side** tạo thumb/full + form metadata) · `AssignItemToSlot` (thao tác lõi: chọn ảnh thả vào slot) · `PreviewPane` (render qua packages/viewer với content draft) · `PublishButton` (gọi Worker snapshot ra content.json).

**workers/api:** `POST /upload-url` (presigned PUT lên R2) · `POST /publish` (validate draft → ghi content.json) · gate bằng Cloudflare Access.

## 8. Lộ trình (xây theo pha, không "big bang")

- **Pha 0 — Scaffold (đang ở đây):** monorepo, data model + zod, 1 phòng seed mẫu trong `content/`.
- **Pha 1 — Engine POC (~1 tuần):** `packages/viewer` render 1 phòng, ~8–12 slot, nav viewpoint, modal, fullscreen, gyro toggle, minimap. Mục tiêu: so trực tiếp với BIDV / demo ReactVR, **khóa kiến trúc + đạt ngân sách perf**.
- **Pha 2 — Content pipeline + Admin (~1–2 tuần):** upload R2 + resize, gán item→slot, preview, publish. Chuẩn hóa form metadata ảnh đầu vào.
- **Pha 3 — Sản xuất + hardening (~2–4 tuần):** đủ mọi thời kỳ, auto-tour, analytics tối thiểu, SEO landing, deploy Cloudflare Pages+R2, kiểm thử mobile thật, bàn giao team nội dung.

## 9. Lệnh (sẽ điền khi scaffold xong)

```
pnpm install
pnpm --filter web dev          # public site
pnpm --filter admin dev        # admin
pnpm --filter @vm/viewer build
pnpm wrangler deploy           # worker (trong workers/api)
pnpm --filter web build && wrangler pages deploy apps/web/dist
```

## 10. Quy ước & lưu ý cho agent

- **TypeScript strict**, dùng zod để validate content ở ranh giới (publish, load). Type dùng chung đặt ở `packages/shared`, đừng định nghĩa trùng.
- **Mọi tính năng phải kiểm chứng theo §6** — nếu thêm gì đụng tới render, tự hỏi "có vi phạm ngân sách perf không?".
- **Slot phải cố định trong v1** (không kéo-thả tự do ngoài admin) để người không rành kỹ thuật vẫn đổi ảnh được mà không vỡ layout.
- **Tách 3 tầng ảnh ngay từ đầu:** thumbnail (duyệt) / full (modal) / texture-trên-tường (KTX2 hoặc resize vừa). Đừng treo ảnh gốc nặng lên tường.
- **Giữ kiến trúc deploy-agnostic:** code static phải copy được sang Nginx nội bộ mà không phải viết lại (phòng khi công ty đổi ý không cho dùng cloud).
- **KHÔNG** đưa secret/khóa R2 vào client; mọi thao tác ghi đi qua Worker.
- Khi build app dùng Codex/Anthropic API (nếu có khâu agent tạo texture/nội dung), dùng model mới nhất; tham chiếu skill `Codex-api`.
- Platform dev: **Windows + PowerShell**. Lệnh shell viết cho PowerShell (hoặc dùng Bash tool với cú pháp POSIX).
```
