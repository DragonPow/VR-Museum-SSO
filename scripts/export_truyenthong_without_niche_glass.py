from pathlib import Path

import bpy


SOURCE = Path(r"C:\Users\Admin\AppData\Local\Temp\vm_out\virtual_museum_rooms.blend")
OUTPUT = Path(r"C:\Users\Admin\AppData\Local\Temp\vm_out\truyenthong.no_backdrop_glass.glb")
KEEP_COLLECTION = "TruyenThong"
REMOVE_OBJECTS = {
    "TT_Niche_Glass",
    "TT_Hero_Cabinet_Glass",
}


def collect_objects(collection: bpy.types.Collection) -> set[bpy.types.Object]:
    objects = set(collection.objects)
    for child in collection.children:
        objects.update(collect_objects(child))
    return objects


def main() -> None:
    if not SOURCE.exists():
        raise FileNotFoundError(SOURCE)

    bpy.ops.wm.open_mainfile(filepath=str(SOURCE))

    removed = []
    for name in sorted(REMOVE_OBJECTS):
        obj = bpy.data.objects.get(name)
        if obj is not None:
            bpy.data.objects.remove(obj, do_unlink=True)
            removed.append(name)

    keep_collection = bpy.data.collections.get(KEEP_COLLECTION)
    if keep_collection is None:
        raise RuntimeError(f"Missing collection: {KEEP_COLLECTION}")

    keep_objects = collect_objects(keep_collection)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in bpy.context.scene.objects:
        obj.select_set(obj in keep_objects)

    bpy.ops.export_scene.gltf(
        filepath=str(OUTPUT),
        export_format="GLB",
        use_selection=True,
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

    mesh_count = sum(1 for obj in keep_objects if obj.type == "MESH")
    tri_count = 0
    for obj in keep_objects:
        if obj.type != "MESH":
            continue
        for polygon in obj.data.polygons:
            tri_count += max(1, len(polygon.vertices) - 2)

    print(f"VM_EXPORT source={SOURCE}")
    print(f"VM_EXPORT removed_objects={','.join(removed) if removed else '(none)'}")
    print(f"VM_EXPORT collection={KEEP_COLLECTION}")
    print(f"VM_EXPORT selected_objects={len(keep_objects)} selected_meshes={mesh_count}")
    print(f"VM_EXPORT tris={tri_count}")
    print(f"VM_EXPORT output={OUTPUT}")
    print(f"VM_EXPORT output_bytes={OUTPUT.stat().st_size}")


if __name__ == "__main__":
    main()
