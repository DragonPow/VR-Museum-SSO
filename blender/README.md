# Phòng triển lãm 3D — Bàn giao từ Blender

Bộ này gồm 2 phòng dựng sẵn trong Blender, đã tối ưu cực nhẹ để chạy tốt trên server yếu (4–8GB RAM) và mobile.

## File trong gói

| File | Mô tả |
|---|---|
| `hall.glb` | Hội trường chính 24×16×5m — 56 slot tranh, có đài kỷ niệm trung tâm |
| `side.glb` | Phòng chuyên đề 12×9×4m — 18 slot tranh |
| `slots.json` | Danh sách toàn bộ slot (ID + toạ độ + hướng) cho cả 2 phòng |
| `content.sample.json` | Content mẫu đã ráp sẵn theo schema period→room→slot→item |
| `virtual_museum_rooms.blend` | File Blender gốc để chỉnh sửa sau |

> Các file `.glb` / `.blend` đang nằm trên máy chạy Blender tại:
> `C:\Users\Admin\AppData\Local\Temp\vm_out\`
> Hãy copy chúng vào repo: `content/models/hall.glb`, `content/models/side.glb`.

## Thông số kỹ thuật (rất nhẹ)

- Tổng hình học cả 2 phòng: ~906 vertex / 380 polygon.
- `hall.glb` ≈ 46 KB, `side.glb` ≈ 15 KB (chưa Draco; bật Draco còn nhỏ hơn).
- Material phẳng (flat color), KHÔNG texture PBR nặng, KHÔNG bake shadow trong model.
- Ánh sáng KHÔNG nhúng trong GLB — set trong R3F (ambient + ít point light) theo ngân sách perf ở `architecture-plan.md §5`.

## Hệ toạ độ — ĐỌC KỸ

- Toạ độ slot trong `slots.json` / `content.sample.json` lấy theo **Blender Z-up** (sàn `z=0`, tâm phòng `(0,0,0)`, tầm mắt `z≈1.6`).
- GLB được export **Y-up** (chuẩn three.js) nên khi load model vào R3F, hình học tự đúng chiều.
- Khi đặt khung tranh (SlotFrame) lên slot, viewer cần thống nhất 1 quy ước. Gợi ý đơn giản nhất:
  - Map toạ độ Blender `(x, y, z)` → three.js `(x, z, -y)` (xoay Z-up→Y-up).
  - Trường `normal` cho biết tranh quay về hướng nào (`+X/-X/+Y/-Y` trong hệ Blender); `rotationYdeg` là gợi ý góc xoay quanh trục đứng.
  - Nếu thấy tranh "úp mặt vào tường", lật normal 180°.
- `width`/`height` của slot là kích thước vùng canvas (mét) — dùng để scale plane ảnh cho khớp khung.

## Slot — quy ước ID

- Hội trường: `HALL-S-*` (tường sau), `HALL-N-*` (trước), `HALL-W-*` (trái), `HALL-E-*` (phải), `HALL-BG-*` (phông sau tượng), `HALL-PNLx-A/B` (panel tự đứng, 2 mặt).
- Phòng phụ: `SIDE-S/N/W/E-*`.
- Mỗi slot giữ tối đa 1 item. Đổi ảnh = đổi `thumbUrl/wallTextureUrl/fullUrl` của item, KHÔNG đụng toạ độ slot → không vỡ layout.

## Ráp vào viewer (tóm tắt)

1. Copy `hall.glb`, `side.glb` vào `content/models/`.
2. Copy `content.sample.json` vào `content/` (hoặc merge vào file content hiện có).
3. Trong `@vm/viewer`, load `room.modelUrl` bằng `useGLTF`, rồi với mỗi `slot` render 1 `SlotFrame` ở `transform.position` (đã chuyển hệ toạ độ) với plane kích thước `width×height`, dán `item.wallTextureUrl`.
4. Đặt camera/nav theo `room.viewpoints`; portal theo `room.portals`.

## Muốn chỉnh phòng

Mở `virtual_museum_rooms.blend`. Mỗi phòng nằm trong 1 collection (`Hall`, `Side`). Slot được sinh bằng code parametric — muốn thêm/bớt slot, sửa lại số lượng trong các hàm `row(...)`/`add_panel(...)` rồi export lại. Danh sách slot lưu trong custom property `slot_registry` của object `Hall_Slots` / `Side_Slots`.
