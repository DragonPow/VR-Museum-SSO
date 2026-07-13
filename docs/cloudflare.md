# Cloudflare — hạ tầng dự án (Phòng Truyền Thống VR)

GitHub repo: **DragonPow/VR-Museum-SSO**. Cả 3 project Cloudflare đều **nối Git**
với repo này, nhánh production = `main`, **push là tự build + deploy**.

## 3 project trên Cloudflare

### 1. `virtual-museum-web` — Cloudflare Pages (site công khai)
- Build: `pnpm --filter @vm/shared build && pnpm --filter @vm/viewer build && pnpm --filter web build`
- Output: `apps/web/dist`
- **Chạy R2 MODE**: `VITE_ASSET_BASE_URL = https://pub-45a113bbee6b43d58d9cc91bd6e1189c.r2.dev`
  → app đọc **TỪ R2** (không dùng asset trong Pages build):
  - `<R2>/content.json`
  - `<R2>/content/models/truyenthong.glb`, `truyenthong_combined.webp`, `truyenthong_props.webp`
  - `<R2>/media/*`

### 2. `virtual-museum-admin` — Cloudflare Pages (admin CMS)
- Build: `... pnpm --filter admin build` · Output: `apps/admin/dist`
- `VITE_API_URL = https://virtual-museum-api.vungocthach1112.workers.dev` (gọi Worker: draft/upload/publish)

### 3. `virtual-museum-api` — Cloudflare Worker (API)
- URL: `https://virtual-museum-api.vungocthach1112.workers.dev`
- Build: `pnpm --filter @vm/shared build` · Deploy: `pnpm --filter api-worker run deploy`
- R2 binding: `MEDIA_BUCKET` → bucket **`virtual-museum-media`**
- Env vars: `ALLOWED_ORIGIN` (origin admin), `PUBLIC_R2_URL = https://pub-45a113bbee6b43d58d9cc91bd6e1189c.r2.dev`
- Routes: `GET /api/health` · `GET/POST /api/draft` · `GET /api/content` · `POST /api/upload` ·
  `POST /api/publish` · `GET /media/*` + `/content/models/*` (phục vụ file từ R2)
- Build cache: **Enabled**

## R2 bucket `virtual-museum-media`
- Public URL: `https://pub-45a113bbee6b43d58d9cc91bd6e1189c.r2.dev`
- Chứa: `content.json`, `draft.json`, `content/models/*.glb` + `*.webp`, `media/<itemId>/{thumb,wall,full}.webp`

## HAI ĐƯỜNG CẬP NHẬT (rất hay nhầm)
- **CODE** (viewer render, UI, màu dado, độ sáng, logic) → nằm trong **bundle JS** →
  **push `main` → Pages tự build**. (KHÔNG phải upload R2.)
- **ASSET ở R2 mode** (`.glb`, atlas `.webp`, `content.json`) → phải **upload lên R2**
  (qua admin hoặc `wrangler r2 object put`), KHÔNG phải deploy code. Và **PHẢI xoá cache /
  đổi tên version** vì URL R2 public cache mạnh — ghi đè cùng key KHÔNG tự xoá cache.

## Kích thước file repo (để đối chiếu với R2)
- `truyenthong.glb` = 1,084,500 B
- `truyenthong_combined.webp` = 445,930 B
- `truyenthong_props.webp` = 309,630 B
(Nếu file trên R2 khác các số này → R2 đang giữ bản cũ/khác → upload lại.)

## Local dev
- Web `:5173` — **sample mode** (đọc `content.sample.json` + `content/models` trong repo).
- Admin `:5174` — proxy `/api` → 8787, `/media` → 8787. `apps/admin/.env.local`: `VITE_API_URL=http://localhost:8787`.
- Worker `:8787` — `cd workers/api && pnpm dev` (wrangler dev, R2 giả lập miniflare).
  `.dev.vars`: `JWT_SECRET`, `PUBLIC_R2_URL=http://localhost:8787`, `ALLOWED_ORIGIN=http://localhost:5174`.

## Vì sao localhost ≠ Cloudflare (dù code giống)
- localhost = **sample mode** → dùng file repo (working).
- Cloudflare web = **R2 mode** → dùng file **trên R2**.
→ Muốn giống nhau: file R2 phải **bằng đúng** file repo, VÀ **không bị cache stale**.
  Chênh độ sáng tường = atlas R2 cũ/khác. Màu dado (màu phẳng do code) chỉ khác nếu
  GLB trên R2 khác, hoặc do cảm nhận vì tường tối hơn.