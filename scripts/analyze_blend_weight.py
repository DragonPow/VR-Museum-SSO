from collections import Counter, defaultdict
from pathlib import Path

import bpy


SOURCE = Path(r"C:\Users\Admin\AppData\Local\Temp\vm_out\virtual_museum_rooms.blend")


def collection_path_for_object(obj: bpy.types.Object) -> str:
    paths = []
    for collection in obj.users_collection:
        names = [collection.name]
        parent = find_parent_collection(bpy.context.scene.collection, collection)
        while parent:
            names.append(parent.name)
            parent = find_parent_collection(bpy.context.scene.collection, parent)
        paths.append("/".join(reversed(names)))
    return " | ".join(paths) or "(no collection)"


def find_parent_collection(
    root: bpy.types.Collection, target: bpy.types.Collection
) -> bpy.types.Collection | None:
    for child in root.children:
        if child == target:
            return root
        found = find_parent_collection(child, target)
        if found:
            return found
    return None


def mesh_stats(obj: bpy.types.Object) -> tuple[int, int, int]:
    if obj.type != "MESH" or not obj.data:
        return (0, 0, 0)
    mesh = obj.data
    tris = 0
    for polygon in mesh.polygons:
        tris += max(1, len(polygon.vertices) - 2)
    return (len(mesh.vertices), len(mesh.polygons), tris)


def main() -> None:
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE))

    objects = list(bpy.data.objects)
    type_counts = Counter(obj.type for obj in objects)
    prefix_counts = Counter(obj.name.split("_", 1)[0] for obj in objects)

    print("SOURCE", SOURCE)
    print("OBJECTS_TOTAL", len(objects))
    print("OBJECT_TYPES", dict(type_counts))
    print("PREFIX_COUNTS", dict(prefix_counts.most_common(20)))
    print()

    print("COLLECTION_TREE")
    def walk_collection(collection: bpy.types.Collection, depth: int = 0) -> None:
        direct_objects = list(collection.objects)
        mesh_objects = [obj for obj in direct_objects if obj.type == "MESH"]
        verts = sum(mesh_stats(obj)[0] for obj in mesh_objects)
        tris = sum(mesh_stats(obj)[2] for obj in mesh_objects)
        print(
            f"{'  ' * depth}- {collection.name}: "
            f"objects={len(direct_objects)} meshes={len(mesh_objects)} verts={verts} tris={tris}"
        )
        for child in collection.children:
            walk_collection(child, depth + 1)

    walk_collection(bpy.context.scene.collection)
    print()

    grouped = defaultdict(lambda: {"count": 0, "verts": 0, "tris": 0, "examples": []})
    for obj in objects:
        key = collection_path_for_object(obj)
        verts, _polys, tris = mesh_stats(obj)
        grouped[key]["count"] += 1
        grouped[key]["verts"] += verts
        grouped[key]["tris"] += tris
        if len(grouped[key]["examples"]) < 6:
            grouped[key]["examples"].append(obj.name)

    print("COLLECTION_OBJECT_WEIGHT")
    for key, value in sorted(grouped.items(), key=lambda item: item[1]["tris"], reverse=True):
        print(
            f"{key}: objects={value['count']} verts={value['verts']} "
            f"tris={value['tris']} examples={', '.join(value['examples'])}"
        )
    print()

    print("TOP_MESH_OBJECTS")
    mesh_rows = []
    for obj in objects:
        verts, polys, tris = mesh_stats(obj)
        if tris:
            mesh_rows.append((tris, verts, polys, obj.name, collection_path_for_object(obj)))
    for tris, verts, polys, name, collection_path in sorted(mesh_rows, reverse=True)[:80]:
        print(f"{name}: verts={verts} polys={polys} tris={tris} collection={collection_path}")
    print()

    print("IMAGES")
    image_rows = []
    for image in bpy.data.images:
        width, height = image.size
        pixels_bytes = width * height * 4 if width and height else 0
        packed_bytes = len(image.packed_file.data) if image.packed_file else 0
        filepath = bpy.path.abspath(image.filepath) if image.filepath else ""
        image_rows.append((max(pixels_bytes, packed_bytes), image.name, width, height, packed_bytes, filepath))
    for _weight, name, width, height, packed_bytes, filepath in sorted(image_rows, reverse=True):
        print(
            f"{name}: {width}x{height} raw_rgba={width * height * 4} "
            f"packed={packed_bytes} path={filepath}"
        )


if __name__ == "__main__":
    main()
