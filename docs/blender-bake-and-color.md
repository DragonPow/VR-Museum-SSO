# Bake ánh sáng & thêm màu (dado/niche) — Phòng Truyền Thống VR

> Đọc kỹ trước khi bake lại hoặc "thêm màu / nền" cho phòng. Đa số lỗi (tường
> loang mảng xám, đèn vỡ, seam đen) đến từ việc bake lại sai cách.

## 0. Nguyên tắc cốt lõi
- Ánh sáng/bóng/GI được **bake sẵn** (Cycles) vào **atlas** (`*_combined.webp`,
  `*_props.webp`). Web hiển thị **unlit 1:1** bằng `MeshBasicMaterial` (`toneMapped:false`),
  sample qua **UV2 (TEXCOORD_1)**. → web = giống hệt bake, không tính sáng lại.
- **Màu/độ sáng tinh chỉnh (dado, độ sáng tường) = CODE viewer**, KHÔNG phải bake.
  (Ví dụ `ATLAS_BRIGHTEN`, và khối `TT_Dado` trong `RoomModel.tsx`.)

## 1. ⚠️ Cạm bẫy chí mạng: UV Lightmap PACKED không nằm trong .blend
- Mỗi atlas gộp nhiều mesh, mỗi mesh chiếm **một vùng UV2 riêng (packed, không chồng)**.
- **Layout packed này KHÔNG được lưu trong file .blend.** Nó chỉ còn trong
  `TEXCOORD_1` của file `.glb` đã export. Trong .blend, UV `Lightmap` có thể đang
  chồng full 0–1.
- HỆ QUẢ: nếu bake lại atlas, bạn **BẮT BUỘC phải tạo lại atlas VÀ export lại GLB
  CÙNG MỘT LẦN** (UV2 mới khớp atlas mới). Nếu atlas mới nhưng GLB vẫn UV2 cũ (hoặc
  ngược lại) → shell sample **sai vùng atlas** → **tường loang mảng xám/unlit, seam đen**
  (đúng lỗi hay gặp). → glb + webp phải đi thành một cặp.

## 2. Bake lại atlas (chỉ khi đổi hình học/đèn thật)
1. Repack UV `Lightmap` từng nhóm (shell / props) thành atlas **không chồng** — chia
   theo tỉ lệ diện tích (mesh lớn như `TT_Architecture` được vùng lớn hơn). Atlas
   **4096×4096** (2048 nhìn kém nét rõ).
2. Bake `COMBINED` (Cycles, ~200 samples, denoise, `render.bake.margin=16`,
   `use_clear=True`). Set UV `Lightmap` = `active_render`, gán 1 image atlas làm active
   node ở MỌI material của MỌI mesh trong nhóm, select cả nhóm rồi bake 1 lần.
3. Tone map trước khi lưu: **Reinhard theo luminance** (giữ hue, tránh ngả cam),
   `white=3.5`: `scale=(1+L/w²)/(1+L)`, `rgb*=scale`, clip [0,1].

### ⚠️ Bug lưu ảnh của Blender 5.1
- `image.save()` / `save_as` / `save_render` **ghi ra file ĐEN / hằng số** (bất kể pixel).
  Đọc file thì OK, chỉ ghi hỏng.
- Cách lưu tin cậy: ghi qua **compositor + render pipeline**:
  - Ghi pixel vào **image MỚI** bằng `image.pixels.foreach_set(np_array)` (KHÔNG
    `pixels[:]=list` ở 4096²; và **ghi đè lên image vừa bake sẽ làm nó về 0** → luôn tạo image fresh).
  - Blender 5.1: compositor = `scene.compositing_node_group` (`CompositorNodeTree`):
    `CompositorNodeImage` → `NodeGroupOutput`. Render scene tạm (WORKBENCH, res=4096) ra `.webp`.
  - View transform khi render: `Standard` (linear→sRGB) nếu input là giá trị tonemapped-**linear**;
    `Raw` (identity) nếu input đã **sRGB** sẵn (dùng khi vá ảnh trực tiếp, giữ nguyên pixel khác).

## 3. THÊM MÀU / nền / dado (vd nền xanh) — ĐỪNG bake lại toàn phòng
Bake lại toàn phòng = rủi ro cao (mất fix niche, dễ dính lỗi mảng xám mục 1). Ưu tiên:

- **Mesh MỚI (dado, nẹp, v.v.):** inject thẳng vào **GLB gốc** (GLB surgery) — giữ
  nguyên 100% UV2/atlas của shell; mesh mới **không cần lightmap**. Sau đó trong viewer:
  route theo tên (vd `obj.name.startsWith('TT_Dado')`) → `MeshBasicMaterial` **phẳng unlit**,
  màu lấy từ material của mesh, `toneMapped:false`. Tinh chỉnh sắc độ bằng `SAT/LIFT`
  **trong code**. (Đây là cách đã dùng cho nền xanh — không bake lại.)
- **Đổi màu một vùng trên atlas (vd làm sáng/vá niche đỏ):** sửa **trực tiếp trên ảnh
  atlas gốc** (image-space): load atlas ở Non-Color, đổi pixel đúng vùng (mask theo màu —
  vd chỉ pixel đỏ bão hoà cho niche), lưu **identity** (`Raw`), giữ nguyên pixel khác.
  KHÔNG rebake. Vì UV2 không đổi nên GLB không cần export lại.

## 4. Chẩn đoán lỗi "mảng xám / đèn vỡ / seam đen"
Gần như luôn là một trong:
1. **UV2 GLB ≠ packing atlas** (rebake lệch pha, hoặc chỉ đổi 1 trong 2) → shell sample
   sai vùng → mảng xám. Sửa: regenerate atlas + GLB **cùng lúc**.
2. **Atlas bị hỏng khi lưu** (bug `image.save` → đen). Sửa: lưu qua compositor (mục 2).
3. **Ghi đè image vừa bake** làm buffer về 0 → luôn ghi vào image fresh.
4. Atlas **2048** thay vì 4096 → nét kém, dễ seam.

## 5. Deploy (đừng nhầm 2 đường)
- **CODE** (màu dado, độ sáng, logic render) → nằm trong bundle JS → **push `main` →
  Cloudflare Pages tự build**. KHÔNG phải upload R2.
- **ASSET** (`.glb`, atlas `.webp`, `content.json`): web production chạy **R2 mode**
  (`VITE_ASSET_BASE_URL` = domain R2) → phải **upload lên R2** + **purge/đổi version**
  (URL R2 public cache mạnh, ghi đè cùng key KHÔNG tự xoá cache).
- localhost = **sample mode** (file repo) ≠ Cloudflare = **R2 mode** (file R2). Muốn giống
  nhau: file R2 phải bằng đúng file repo, và code đã deploy đúng commit.
