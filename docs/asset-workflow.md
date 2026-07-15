# Quy trình dựng phòng bằng asset bên ngoài

Mục tiêu của repo này là để phần web chỉ làm viewer, timeline, hotspot, modal và content JSON. Phần dựng hình 3D nên làm ở công cụ ngoài như Blender, sau đó export thành GLB/GLTF rồi đưa vào thư mục `content/models`.

## Cách làm đề xuất

1. Dựng hoặc tải một phòng triển lãm/museum/gallery trong Blender.
2. Đặt hệ tọa độ gần giống MVP hiện tại:
   - Tâm phòng ở gần `(0, 0, 0)`.
   - Sàn ở `y = 0`.
   - Camera/người xem ở khoảng `y = 1.6`.
   - Tường trước ở khoảng `z = -8`.
   - Tường trái/phải ở khoảng `x = -6` và `x = 6`.
3. Export model ra `.glb` hoặc `.gltf`.
4. Đặt file vào `content/models`, ví dụ `content/models/company-gallery.glb`.
5. Cập nhật `content/content.sample.json`:

```json
{
  "rooms": [
    {
      "modelUrl": "/content/models/company-gallery.glb"
    }
  ]
}
```

## Cách thay ảnh trưng bày

Các ảnh trên tường vẫn được quản lý bằng `items` và `slots` trong JSON. Khi có ảnh thật, chỉ cần thay các trường:

```json
{
  "thumbUrl": "/content/images/ten-anh-thumb.webp",
  "wallTextureUrl": "/content/images/ten-anh-wall.webp",
  "fullUrl": "/content/images/ten-anh-full.webp"
}
```

## Nguồn asset nên thử

- BlenderKit: tiện vì tìm asset trực tiếp trong Blender.
- Sketchfab: nhiều model gallery/museum, nhưng phải kiểm tra license từng model.
- Poly Haven và ambientCG: hợp để lấy texture tường, sàn, HDRI/ánh sáng.

Ưu tiên asset có license rõ ràng, dung lượng nhẹ, ít polygon, texture không quá lớn. Với MVP web, nên giữ model phòng dưới khoảng vài MB trước khi tối ưu thêm.

## Model chính thức

Repo đang dùng model thật của dự án tại:

```txt
content/models/truyenthong.glb
```

**Chỉ có đúng MỘT phòng: `room-truyenthong`.** File `.blend` nguồn
(`virtual_museum_rooms.blend`) còn các collection **`Hall`, `Side`, `Control`** nhưng đó là
**phòng cũ đã bỏ** — không export, không có trên R2, không có trong `content.sample.json`.
Chỉ các slot `VM_Slot_TT_*` là thật; `VM_Slot_HALL_*` / `VM_Slot_SIDE_*` / `VM_Slot_CTRL_*`
bỏ qua. (Chi tiết + bẫy material `CR_*`: xem [blender-bake-and-color.md](blender-bake-and-color.md) §0.0.)

Slot ảnh được nhúng sẵn trong model qua các mesh `VM_Slot_*` (đi kèm material
`SlotCanvas`/`CR_SlotCanvas` cho mặt phẳng treo ảnh) — viewer tự quét mesh này để lấy
vị trí/kích thước, không cần khai báo `transform` tay trong content JSON. Khi cần đổi model,
chỉ cần thay file và cập nhật `modelUrl`, không cần viết lại viewer.

Đi kèm GLB còn **5 file `.webp`** (atlas ánh sáng + texture detail) — đây là một bộ,
phải upload đủ cùng nhau. Xem [cloudflare.md](cloudflare.md).
