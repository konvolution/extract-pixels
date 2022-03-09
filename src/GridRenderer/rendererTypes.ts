export type Coord = [number, number];

// The extent of the grid (in cells) is first calculated by
// counting how many cells will fit in the canvas. If the calculated
// extent exceeds maxCells, then the extent is reduced to maxCells.
export interface GridParams {
  // Grid parameters in unscaled coordinates
  canvasSize: Coord;
  maxCells: Coord;
  cellSize: Coord; // Desired size of a grid cell
  gridOffset: Coord; // Offset to start of grid within canvas

  // The entire grid is scaled by the renderScale
  renderScale: number; // Integer
}
