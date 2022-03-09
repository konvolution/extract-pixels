import { GridParams } from "./rendererTypes";

export function renderGrid(
  canvas: HTMLCanvasElement,
  { canvasSize, maxCells, cellSize, gridOffset, renderScale }: GridParams
) {
  canvas.width = canvasSize[0] * renderScale;
  canvas.height = canvasSize[1] * renderScale;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    // This shouldn't happen
    return;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.lineWidth = 1;

  const gridPixels = [
    Math.min(
      maxCells[0],
      Math.floor((canvasSize[0] - gridOffset[0]) / cellSize[0])
    ),
    Math.min(
      maxCells[1],
      Math.floor((canvasSize[1] - gridOffset[1]) / cellSize[1])
    )
  ];

  const gridEnd = [
    gridOffset[0] + cellSize[0] * gridPixels[0],
    gridOffset[1] + cellSize[1] * gridPixels[1]
  ];

  ctx.beginPath();

  for (
    let x = renderScale * gridOffset[0], ix = 0;
    x < canvas.width && ix <= gridPixels[0];
    x += renderScale * cellSize[0], ++ix
  ) {
    ctx.moveTo(x + 0.5, renderScale * gridOffset[1]);
    ctx.lineTo(x + 0.5, renderScale * gridEnd[1]);
  }

  for (
    let y = renderScale * gridOffset[1], iy = 0;
    y < canvas.height && iy <= gridPixels[1];
    y += renderScale * cellSize[1], ++iy
  ) {
    ctx.moveTo(renderScale * gridOffset[0], y + 0.5);
    ctx.lineTo(renderScale * gridEnd[0], y + 0.5);
  }

  ctx.strokeStyle = "black";
  ctx.stroke();

  ctx.strokeStyle = "white";
  ctx.setLineDash([1, 1]);
  ctx.stroke();

  ctx.beginPath();
  const x = renderScale * gridOffset[0];
  ctx.moveTo(x + 0.5, renderScale * gridOffset[1]);
  ctx.lineTo(x + 0.5, renderScale * gridEnd[1]);

  const y = renderScale * gridOffset[1];
  ctx.moveTo(renderScale * gridOffset[0], y + 0.5);
  ctx.lineTo(renderScale * gridEnd[0], y + 0.5);

  ctx.strokeStyle = "cyan";
  ctx.setLineDash([1, 1]);
  ctx.stroke();
}
