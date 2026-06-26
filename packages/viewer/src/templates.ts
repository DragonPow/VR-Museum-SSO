import type { RoomTemplate } from '@vm/shared'
import { ROOM_DIMENSIONS } from '@vm/shared'

export interface RoomDimensions {
  width: number
  height: number
  depth: number
}

export function getRoomDimensions(template: RoomTemplate): RoomDimensions {
  return ROOM_DIMENSIONS[template] ?? ROOM_DIMENSIONS['gallery']!
}

export interface WallConfig {
  position: [number, number, number]
  rotation: [number, number, number]
  size: [number, number]
  name: string
}

/** Returns the 5 surfaces (4 walls + floor/ceiling) for a given template */
export function getRoomSurfaces(template: RoomTemplate): {
  walls: WallConfig[]
  floor: WallConfig
  ceiling: WallConfig
} {
  const { width, height, depth } = getRoomDimensions(template)
  const hw = width / 2
  const hd = depth / 2

  return {
    walls: [
      // Front wall (Z-)
      { name: 'front', position: [0, height / 2, -hd], rotation: [0, 0, 0], size: [width, height] },
      // Back wall (Z+)
      { name: 'back', position: [0, height / 2, hd], rotation: [0, Math.PI, 0], size: [width, height] },
      // Left wall (X-)
      { name: 'left', position: [-hw, height / 2, 0], rotation: [0, Math.PI / 2, 0], size: [depth, height] },
      // Right wall (X+)
      { name: 'right', position: [hw, height / 2, 0], rotation: [0, -Math.PI / 2, 0], size: [depth, height] },
    ],
    floor: { name: 'floor', position: [0, 0, 0], rotation: [-Math.PI / 2, 0, 0], size: [width, depth] },
    ceiling: { name: 'ceiling', position: [0, height, 0], rotation: [Math.PI / 2, 0, 0], size: [width, depth] },
  }
}
