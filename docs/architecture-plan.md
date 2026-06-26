# Kế hoạch kiến trúc chi tiết — Phòng Truyền Thống Ảo 50 Năm

Tài liệu này mở rộng từ [CLAUDE.md](../CLAUDE.md). Đề bài: [requirement.md](requirement.md). Phân tích nền: [solution.md](solution.md).

---

## 1. Phương án đã chọn & vì sao

**Chọn: 3D nhẹ bằng React Three Fiber (R3F)**, deploy tĩnh lên Cloudflare Pages + R2, có trang admin riêng để quản nội dung.

So sánh nhanh các phương án từng cân nhắc:

| Tiêu chí | 3D nhẹ R3F (CHỌN) | Panorama (Marzipano) | ReactVR demo | Artsteps |
|---|---|---|---|---|
| Chiều sâu 3D thật | ✅ | ⚠️ (giả lập) | ❌ phẳng | ✅ |
| Agent dựng phòng bằng code | ✅ | ❌ cần Blender | ✅ | ❌ SaaS |
| Đổi vị trí slot dễ | ✅ sửa JSON | ❌ render lại | ⚠️ | ⚠️ |
| Tải runtime | nhẹ (nếu giữ luật perf) | rất nhẹ | nhẹ | nặng/phụ thuộc |
| Chi phí | ~0 (tĩnh) | ~0 (tĩnh) | ~0 | rủi ro phí |
| Tự chủ nội dung/giao diện | ✅ | ✅ | ✅ | ❌ |

**Tại sao không panorama (dù solution.md đề xuất):** panorama an toàn runtime nhất nhưng kẹt ở khâu **dựng phòng phải dùng Blender** — kỹ năng agent làm không đáng tin và team có thể thiếu; lại khó đổi vị trí "block trắng" (phải render lại ảnh 360). Với R3F, phòng là code parametric (agent giỏi), slot là mặt phẳng 3D thật (đổi ảnh = sửa 1 dòng).

**Giải tỏa nỗi sợ "server yếu":** nỗi lo trộn 2 thứ. Tải **server** = 0 vì site tĩnh (chỉ trả file HTML/JS/ảnh) → server 4–8GB dư sức. Tải **GPU client** chỉ nặng khi bật shadow real-time / post-FX / mesh nặng — ta **cấm** (xem §5). Yếu tố quyết định perf thực sự: kích thước ảnh, chia tầng ảnh, lazy-load, cache, GPU máy khách.

---

## 2. Sơ đồ hệ thống

```
[Khách]  ─HTTP─►  Cloudflare Pages (apps/web, tĩnh)
                         │ fetch content.json + ảnh
                         ▼
                   Cloudflare R2  ◄── publish snapshot ──┐
                    (media + content.json)               │
                                                         │
[Team nội dung] ─►  Cloudflare Pages (apps/admin)        │
   (qua Cloudflare Access)   │                           │
                             ├─ upload ảnh ─► presigned PUT ─► R2
                             └─ Publish ─► Worker (workers/api) ─┘
                                            validate → ghi content.json
```

- **Public** hoàn toàn tĩnh, không backend khi xem → nhanh, rẻ, copy được sang Nginx nội bộ.
- **Admin** mới cần Worker để ghi (upload, publish). Khách xem không bao giờ chạm Worker.

---

## 3. Cấu trúc monorepo

```
virtual_museum/
├── apps/
│   ├── web/                 # Public museum
│   │   ├── src/
│   │   │   ├── pages/        # Landing, Tour, Period
│   │   │   ├── ui/           # TimelineNav, Minimap, InfoModal, AutoTour, Gallery2DFallback
│   │   │   └── content/      # ContentProvider (fetch + cache content.json)
│   │   └── vite.config.ts
│   └── admin/               # Content editor SPA
│       └── src/
│           ├── auth/        ├── periods/   ├── rooms/
│           ├── items/        (upload + resize + metadata)
│           ├── assign/       (gán item → slot — thao tác lõi)
│           ├── preview/      (dùng packages/viewer)
│           └── publish/
├── packages/
│   ├── shared/              # types.ts, schema.ts (zod), constants.ts, validate.ts
│   └── viewer/              # Engine R3F tái sử dụng (web + admin preview)
│       └── src/
│           ├── SceneCanvas.tsx     RoomScene.tsx     SlotFrame.tsx
│           ├── Portal.tsx          NavController.tsx  TextureManager.ts
│           ├── PerfGuard.ts        templates/         lighting/
├── workers/
│   └── api/                 # src/index.ts: /upload-url, /publish
├── content/                 # seed: content.sample.json + textures mẫu
├── infra/                   # wrangler.toml, scripts deploy, headers/redirects
└── docs/
```

Stack cụ thể: React 18, TypeScript (strict), Vite, @react-three/fiber, @react-three/drei, zustand (state), zod (validate), Cloudflare Workers + R2 + Pages, wrangler. pnpm workspaces.

---

## 4. Data model & content.json (xem thêm CLAUDE.md §4)

Nguyên tắc:
- **period → room → slot → item** là 4 tầng. Slot có **ID cố định + toạ độ trên tường**; item là nội dung treo vào.
- Một slot tại một thời điểm chỉ giữ **một item** → đổi ảnh không phá layout.
- `content.json` là snapshot **đã ghép** (denormalized) để site public đọc một lần, không cần join.
- Validate bằng zod ở `packages/shared/schema.ts` tại 2 ranh giới: **publish** (admin ghi) và **load** (web đọc).

3 tầng ảnh bắt buộc tách ngay từ đầu:
| Tầng | Dùng ở đâu | Kích thước gợi ý |
|---|---|---|
| `thumbUrl` | duyệt trong admin / minimap | ~200–400px |
| wall texture | treo trên tường 3D | KTX2 hoặc ~1024px, nén |
| `fullUrl` | mở trong modal chi tiết | ~1600–2048px |

Resize thực hiện **client-side trong admin** (canvas) trước khi upload → không cần server xử lý ảnh (giữ free).

---

## 5. Ngân sách hiệu năng (luật cứng — chi tiết)

Xem checklist đầy đủ ở [CLAUDE.md §6]. Tóm tắt:
- Cấm: real-time shadows, post-processing, GI, physics đi-bộ, mesh PBR nặng.
- Ánh sáng: ambient + ít directional; bóng đổ bake vào texture.
- Texture: KTX2/WebP, mipmap, lazy-load theo tầm nhìn, LRU cache, preload chỉ phòng kề.
- Geometry: hộp đơn giản + merge + instancing.
- Canvas: `dpr=[1,1.5]` desktop / `1` mobile; frustum culling; `frameloop="demand"` khi tĩnh.
- Nav: point-to-point viewpoint + orbit; mobile có toggle DeviceOrientation.
- PerfGuard: GPU yếu → degrade → fallback Gallery 2D.
- Đích: 60fps desktop / ≥30fps mobile; <150 draw calls/phòng; <50MB texture GPU đồng thời.

---

## 6. Luồng người dùng

**Khách:** Landing (giới thiệu 50 năm) → Timeline chọn thời kỳ → vào Phòng 3D → di chuyển giữa viewpoint, nhìn quanh → click khung ảnh → Modal chi tiết (ảnh full, năm, mô tả, tag) → Portal sang phòng khác. Mobile: bật cảm biến xoay. Kiosk: AutoTour tự chạy.

**Team nội dung (admin):** Đăng nhập (Cloudflare Access) → mở Phòng → chọn Slot → chọn/Upload ảnh (tự resize) → nhập metadata → Preview (giống site thật) → **Publish** → snapshot ra R2, site public cập nhật.

**Người thiết kế phòng:** chọn template phòng + texture tường/sàn + đặt viewpoint + đặt/sửa vị trí slot (qua form hoặc editor trực quan trong admin). Texture có thể nhờ agent tạo bằng AI.

---

## 7. Hosting & deploy

- **apps/web** + **apps/admin** → 2 project Cloudflare Pages (hoặc 1 project, admin ở subpath bảo vệ bằng Access).
- **R2 bucket**: `media/` (ảnh) + `content.json`. Custom domain qua Cloudflare.
- **workers/api**: deploy bằng `wrangler deploy`; binding tới R2.
- **Auth admin**: Cloudflare Access (free ≤50 user) đặt trước /admin và Worker.
- **Phương án nội bộ kín:** cùng bộ static build copy sang **Nginx** trên server 4–8GB; content.json + ảnh đặt trên object storage/thư mục nội bộ. Không phải viết lại app.

Ước lượng dung lượng (tham khảo, không phải benchmark): 8 phòng + ~200 ảnh tối ưu ≈ vài trăm MB — nằm gọn trong free tier R2 (10GB) và không tốn egress.

---

## 8. Rủi ro & giảm thiểu

| Rủi ro | Giảm thiểu |
|---|---|
| 3D giật trên mobile đời thấp | Ngân sách perf §5 + PerfGuard + fallback Gallery 2D |
| Ảnh nặng làm chậm tải | Tách 3 tầng ảnh, resize ở admin, lazy-load, R2 cache |
| Công ty không cho dùng cloud ngoài | Kiến trúc tĩnh → deploy Nginx nội bộ không đổi code |
| Team nội dung làm vỡ layout | Slot cố định, admin chỉ cho gán item, không kéo-thả tự do v1 |
| Đa người sửa đồng thời (JSON store) | v1 team nhỏ chấp nhận; nâng D1 (SQLite) khi cần |
| Agent dựng phòng xấu | Bắt đầu từ preset template + texture, lặp dần qua Preview |

---

## 9. Việc tiếp theo (Pha 0 → Pha 1)

1. Scaffold monorepo pnpm: `apps/web`, `apps/admin`, `packages/shared`, `packages/viewer`, `workers/api`.
2. Định nghĩa `packages/shared`: types + zod schema cho period/room/slot/item.
3. Tạo `content/content.sample.json`: 1 thời kỳ, 1 phòng, ~8–12 slot mẫu.
4. Dựng `packages/viewer` POC: render phòng mẫu, slot, nav viewpoint, modal, gyro toggle, minimap — đạt ngân sách perf.
5. Demo so sánh với BIDV / ReactVR để chốt kiến trúc trước khi làm content pipeline.

> Khi bắt đầu Pha 1, cập nhật mục "Lệnh" trong CLAUDE.md §9 cho khớp scaffold thực tế.
