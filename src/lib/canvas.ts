/**
 * Konstanta dan helper geometri kanvas denah.
 *
 * Nilai-nilai ini dipakai oleh editor (drag-and-drop) dan pengujian unit.
 * Sebelumnya helper hidup di dalam BlueprintWorkspace sehingga sulit diuji.
 */

export const CANVAS_WIDTH = 1000
export const CANVAS_HEIGHT = 640
export const GRID_SIZE = 20

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export function snapToGrid(value: number, gridSize: number = GRID_SIZE) {
  return Math.round(value / gridSize) * gridSize
}
