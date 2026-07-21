import math
from pathlib import Path

import bpy


SOURCE = Path(r"C:\Users\Admin\AppData\Local\Temp\vm_out\virtual_museum_rooms.blend")
OUTPUT = Path(r"C:\Users\Admin\AppData\Local\Temp\vm_out\truyenthong.optimized.glb")

MAX_TEXTURE_SIZE = 1024
DECIMATE_RATIO = 0.72
MIN_VERTS_TO_DECIMATE = 120


def is_protected_object(obj: bpy.types.Object) -> bool:
    name = obj.name.lower()
    return (
        name.startswith("vm_slot")
        or "slot" in name
        or "placeholder" in name
        or name.endswith("_glass")
    )


def resize_images() -> tuple[int, int]:
    changed = 0
    before_bytes = 0
    for image in bpy.data.images:
        if image.type != "IMAGE" or not image.has_data:
            continue

        width, height = image.size
        if width <= MAX_TEXTURE_SIZE and height <= MAX_TEXTURE_SIZE:
            continue

        before_bytes += width * height * 4
        scale = min(MAX_TEXTURE_SIZE / width, MAX_TEXTURE_SIZE / height)
        new_width = max(1, int(math.ceil(width * scale)))
        new_height = max(1, int(math.ceil(height * scale)))
        image.scale(new_width, new_height)
        changed += 1

    return changed, before_bytes


def decimate_meshes() -> tuple[int, int, int]:
    changed = 0
    verts_before = 0
    verts_after = 0

    bpy.ops.object.select_all(action="DESELECT")
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH" or is_protected_object(obj):
            continue

        vert_count = len(obj.data.vertices)
        verts_before += vert_count
        if vert_count < MIN_VERTS_TO_DECIMATE:
            verts_after += vert_count
            continue

        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        modifier = obj.modifiers.new("VM_export_decimate", "DECIMATE")
        modifier.ratio = DECIMATE_RATIO
        modifier.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        obj.select_set(False)
        changed += 1
        verts_after += len(obj.data.vertices)

    return changed, verts_before, verts_after


def main() -> None:
    if not SOURCE.exists():
        raise FileNotFoundError(SOURCE)

    bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
    resized, image_bytes_before = resize_images()
    decimated, verts_before, verts_after = decimate_meshes()

    bpy.ops.export_scene.gltf(
        filepath=str(OUTPUT),
        export_format="GLB",
        export_image_format="JPEG",
        export_jpeg_quality=68,
        export_apply=True,
        export_texcoords=True,
        export_normals=True,
        export_materials="EXPORT",
        export_extras=True,
        export_cameras=False,
        export_lights=False,
        export_yup=True,
    )

    print(f"VM_EXPORT source={SOURCE}")
    print(f"VM_EXPORT output={OUTPUT}")
    print(f"VM_EXPORT resized_images={resized} image_rgba_bytes_before={image_bytes_before}")
    print(f"VM_EXPORT decimated_meshes={decimated} verts_before={verts_before} verts_after={verts_after}")
    print(f"VM_EXPORT output_bytes={OUTPUT.stat().st_size}")


if __name__ == "__main__":
    main()
