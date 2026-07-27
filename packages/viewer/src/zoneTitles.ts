/**
 * Zone title strings for the Phòng Truyền Thống room.
 * Previously baked into the GLB as TT_TitlePill_* geometry; now rendered in code
 * (drei <Text> + auto-sizing pill, see ZoneTitle.tsx). Baked pill/text are hidden
 * at runtime in RoomModel, so editing a title is a pure code change — no Blender,
 * no re-bake, no R2 upload. K6 niche and K9 hero have no editable pill.
 * TODO(content): migrate into content.json once the schema has a per-zone title.
 */
export const ZONE_TITLES: Record<string, string> = {
  K1: 'GIAI ĐOẠN 1 (1976-1986)',
  K2: 'GIAI ĐOẠN 2 (1986-1999)',
  K3: 'GIAI ĐOẠN 3 (1999-2024)',
  K4: 'GIAI ĐOẠN 4 (2024 - ĐẾN NAY)',
  K5: '',
  K7: 'HOẠT ĐỘNG PHONG TRÀO',
  K8: 'TRƯNG BÀY HIỆN VẬT',
  K10: 'TRUYỀN THÔNG SỐ',
  K11: 'BIÊN NIÊN SỬ',
}
