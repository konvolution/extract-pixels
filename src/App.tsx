import * as React from "react";
import { useState } from "react";
import "./styles.css";

import {
  GridRenderer,
  renderGrid as renderGridWebGL
} from "./GridRenderer/webGLRenderer";
import { renderGrid } from "./GridRenderer/canvas2DRenderer";
import { Coord, GridParams } from "./GridRenderer/rendererTypes";

/**
 *
 * @param accept Comma-delimited list of mime types or extensions
 * @param multiple Allow multiple files to be selected
 */
async function pickFile(
  accept: string,
  multiple: boolean
): Promise<FileList | null> {
  return new Promise((resolve, _reject) => {
    const inputElement = document.createElement("input");
    // Set its type to file
    inputElement.type = "file";

    inputElement.accept = accept;
    inputElement.multiple = multiple;

    const onSelectFile = () => resolve(inputElement.files);

    // set onchange event to call callback when user has selected file
    inputElement.addEventListener("change", onSelectFile);

    // set onblur event to call callback when user has selected file on Safari
    inputElement.addEventListener("blur", onSelectFile);

    // dispatch a click event to open the file dialog
    inputElement.dispatchEvent(new MouseEvent("click"));
  });
}

function saveObjectToFile(objectToSave: any, filename: string) {
  const url = URL.createObjectURL(objectToSave);

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.dispatchEvent(new MouseEvent("click"));

  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export default function App() {
  const [imageUrl, setImageUrl] = useState<string | undefined>();

  const updateImage = React.useCallback((file: File | undefined) => {
    setImageUrl((imageUrl) => {
      if (imageUrl !== undefined) {
        URL.revokeObjectURL(imageUrl);
      }

      return file !== undefined ? URL.createObjectURL(file) : undefined;
    });
  }, []);

  React.useEffect(() => {
    // Cleanup on unmount
    return () => updateImage(undefined);
  }, [updateImage]);

  const onBrowse = async () => {
    const files = await pickFile("image/png, image/jpeg, image/bmp", false);

    updateImage(files ? files[0] : undefined);
  };

  const [dragInfo, setDragInfo] = React.useState({
    on: false,
    size: false,
    gridCoordinate: [0, 0]
  });

  const [imageScale, setImageScale] = React.useState(2);
  const [gridOffset, setGridOffset] = React.useState<Coord>([0, 0]);
  const [gridSize, setGridSize] = React.useState<Coord>([8, 8]);
  const [gridMaxPixelsRaw, setGridMaxPixelsRaw] = React.useState<Coord>([
    500,
    500
  ]);
  const [webGLGrid, setWebGLGrid] = React.useState(false);

  const gridMaxPixels = React.useMemo<Coord>(
    () => [
      isNaN(gridMaxPixelsRaw[0]) ? 1 : gridMaxPixelsRaw[0],
      isNaN(gridMaxPixelsRaw[1]) ? 1 : gridMaxPixelsRaw[1]
    ],
    [gridMaxPixelsRaw]
  );

  const [gridCanvasSize, setGridCanvasSize] = React.useState<Coord>([0, 0]);
  const [imageIteration, setImageIteration] = React.useState(0);

  const refImageCanvas = React.useRef<HTMLCanvasElement>(null);
  const refGridCanvas = React.useRef<HTMLCanvasElement>(null);
  const refWebGLGridRenderer = React.useRef<GridRenderer | undefined>(
    undefined
  );

  const onChangeScale = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setImageScale(Math.min(10, Math.max(event.target.valueAsNumber, 1)));
    },
    []
  );

  const onMouseDown = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const rect = refGridCanvas.current!.getBoundingClientRect();
      const x = (event.clientX - rect.left) / imageScale;
      const y = (event.clientY - rect.top) / imageScale;

      const size = event.shiftKey;
      let gridCoordinate: number[] = [];

      const gridPixels = [
        Math.min(
          gridMaxPixels[0],
          Math.floor((gridCanvasSize[0] - gridOffset[0]) / gridSize[0])
        ),
        Math.min(
          gridMaxPixels[1],
          Math.floor((gridCanvasSize[1] - gridOffset[1]) / gridSize[1])
        )
      ];

      if (!size) {
        gridCoordinate = [
          Math.min(
            gridPixels[0],
            Math.max(0, Math.round((x - gridOffset[0]) / gridSize[0]))
          ),
          Math.min(
            gridPixels[1],
            Math.max(0, Math.round((y - gridOffset[1]) / gridSize[1]))
          )
        ];

        setGridOffset([
          Math.max(0, x - gridCoordinate[0] * gridSize[0]),
          Math.max(0, y - gridCoordinate[1] * gridSize[1])
        ]);
      } else {
        gridCoordinate = [
          Math.max(1, Math.abs(Math.round((x - gridOffset[0]) / gridSize[0]))),
          Math.max(1, Math.abs(Math.round((y - gridOffset[1]) / gridSize[1])))
        ];

        setGridSize([
          Math.max(1, Math.abs((x - gridOffset[0]) / gridCoordinate[0])),
          Math.max(1, Math.abs((y - gridOffset[1]) / gridCoordinate[1]))
        ]);
      }

      setDragInfo({
        on: true,
        size,
        gridCoordinate
      });
    },
    [gridOffset, gridMaxPixels, gridCanvasSize, gridSize, imageScale]
  );

  const onMouseMove = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!dragInfo.on) {
        return;
      }

      const rect = refGridCanvas.current!.getBoundingClientRect();
      const x = (event.clientX - rect.left) / imageScale;
      const y = (event.clientY - rect.top) / imageScale;

      if (!dragInfo.size) {
        setGridOffset([
          Math.max(0, x - dragInfo.gridCoordinate[0] * gridSize[0]),
          Math.max(0, y - dragInfo.gridCoordinate[1] * gridSize[1])
        ]);
      } else {
        setGridSize([
          Math.max(
            1,
            Math.abs((x - gridOffset[0]) / dragInfo.gridCoordinate[0])
          ),
          Math.max(
            1,
            Math.abs((y - gridOffset[1]) / dragInfo.gridCoordinate[1])
          )
        ]);
      }
    },
    [dragInfo, gridSize, gridOffset, imageScale]
  );

  const onMouseUp = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      setDragInfo({
        on: false,
        size: false,
        gridCoordinate: []
      });
    },
    []
  );

  const onChangeMaxWidth = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const maxWidthRaw = Math.min(
        500,
        Math.max(event.target.valueAsNumber, 1)
      );
      setGridMaxPixelsRaw((gridMaxPixelsRaw) => [
        maxWidthRaw,
        gridMaxPixelsRaw[1]
      ]);
    },
    []
  );

  const onChangeMaxHeight = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const maxHeightRaw = Math.min(
        500,
        Math.max(event.target.valueAsNumber, 1)
      );
      setGridMaxPixelsRaw((gridMaxPixelsRaw) => [
        gridMaxPixelsRaw[0],
        maxHeightRaw
      ]);
    },
    []
  );

  // Whenever the image changes, update the image
  React.useEffect(() => {
    const imageCanvas = refImageCanvas.current;

    if (!imageCanvas) {
      // This shouldn't happen
      return;
    }

    if (imageUrl === undefined) {
      imageCanvas.width = 0;
      imageCanvas.height = 0;
      setGridCanvasSize([0, 0]);
      return;
    }

    const image = new Image();

    // Signal to cancel drawing image when url changes or on unmount
    let cancelImageDraw = false;

    image.src = imageUrl;
    image.onload = () => {
      if (cancelImageDraw) {
        return;
      }
      imageCanvas.width = image.naturalWidth;
      imageCanvas.height = image.naturalHeight;
      setGridCanvasSize([image.naturalWidth, image.naturalHeight]);

      const ctx = imageCanvas.getContext("2d");

      ctx?.drawImage(image, 0, 0);

      setImageIteration((iteration) => ++iteration);
    };

    return () => {
      cancelImageDraw = true;
    };
  }, [imageUrl]);

  // Whenever the grid parameters change, update the grid
  React.useEffect(() => {
    const gridCanvas = refGridCanvas.current;

    if (!gridCanvas) {
      // This shouldn't happen
      return;
    }

    const gridParams: GridParams = {
      canvasSize: gridCanvasSize,
      maxCells: gridMaxPixels,
      cellSize: gridSize,
      gridOffset,
      renderScale: imageScale
    };

    if (webGLGrid) {
      let gridRenderer = refWebGLGridRenderer.current;

      // Create a new grid renderer if we don't have a grid renderer, or if
      // the canvas changed
      if (!gridRenderer || gridRenderer.gridCanvas() !== gridCanvas) {
        gridRenderer = new GridRenderer(gridCanvas);
        refWebGLGridRenderer.current = gridRenderer;
      }

      gridRenderer.render(gridParams);
    } else {
      renderGrid(gridCanvas, gridParams);
    }
  }, [
    webGLGrid,
    gridOffset,
    gridSize,
    gridMaxPixels,
    gridCanvasSize,
    imageScale
  ]);

  const refExtractedImage = React.useRef<HTMLCanvasElement>(null);

  // Whenever the grid or image data changes, recalculate extracted pixels
  React.useEffect(() => {
    const pixelsCanvas = refExtractedImage.current;
    const imageCanvas = refImageCanvas.current;

    if (!pixelsCanvas || !imageCanvas) {
      return;
    }

    const pixelsWidth = Math.min(
      gridMaxPixels[0],
      Math.floor((gridCanvasSize[0] - gridOffset[0]) / gridSize[0])
    );

    const pixelsHeight = Math.min(
      gridMaxPixels[1],
      Math.floor((gridCanvasSize[1] - gridOffset[1]) / gridSize[1])
    );

    pixelsCanvas.width = pixelsWidth * imageScale;
    pixelsCanvas.height = pixelsHeight * imageScale;

    if (pixelsWidth === 0 || pixelsHeight === 0) {
      return;
    }

    // Resize image data
    const ctxPixels = pixelsCanvas.getContext("2d");
    if (!ctxPixels) {
      return;
    }

    const pixelData = ctxPixels.createImageData(pixelsWidth, pixelsHeight);

    const ctxSource = imageCanvas.getContext("2d");
    if (!ctxSource) {
      return;
    }

    const sourceImageData = ctxSource.getImageData(
      0,
      0,
      imageCanvas.width,
      imageCanvas.height
    );

    for (let y = 0; y < pixelsHeight; ++y) {
      for (let x = 0; x < pixelsWidth; ++x) {
        const sx = Math.round(gridOffset[0] + x * gridSize[0]);
        const ex = Math.round(sx + gridSize[0]);
        const sy = Math.round(gridOffset[1] + y * gridSize[1]);
        const ey = Math.round(sy + gridSize[1]);

        let rsum = 0,
          gsum = 0,
          bsum = 0;
        let count = 0;

        for (let iy = sy; iy < ey; ++iy) {
          for (let ix = sx; ix < ex; ++ix) {
            const sourcePixelIndex = (iy * sourceImageData.width + ix) * 4;
            rsum += sourceImageData.data[sourcePixelIndex];
            gsum += sourceImageData.data[sourcePixelIndex + 1];
            bsum += sourceImageData.data[sourcePixelIndex + 2];
            ++count;
          }
        }

        let on = false;

        if (count > 0) {
          on = rsum / count > 127 || gsum / count > 127 || bsum / count > 127;
        }

        const pixelIndex = (y * pixelData.width + x) * 4;
        const value = on ? 255 : 0;
        pixelData.data[pixelIndex] = value;
        pixelData.data[pixelIndex + 1] = value;
        pixelData.data[pixelIndex + 2] = value;
        pixelData.data[pixelIndex + 3] = 255;
      }
    }

    const newCanvas = document.createElement("canvas");
    newCanvas.width = pixelData.width;
    newCanvas.height = pixelData.height;
    const ctx = newCanvas.getContext("2d")!;
    ctx.putImageData(pixelData, 0, 0);

    ctxPixels.imageSmoothingEnabled = false;
    ctxPixels.scale(imageScale, imageScale);
    ctxPixels.drawImage(newCanvas, 0, 0);
  }, [
    imageIteration,
    gridOffset,
    gridMaxPixels,
    gridCanvasSize,
    gridSize,
    imageScale
  ]);

  const onSaveToFile = React.useCallback(() => {
    if (!refExtractedImage.current) {
      return;
    }

    refExtractedImage.current.toBlob(
      (blob) => blob && saveObjectToFile(blob, "image.bmp"),
      "image/bmp"
    );
  }, []);

  const toggleWebGLGrid = React.useCallback(() => {
    setWebGLGrid((value) => !value);
  }, []);

  return (
    <div className="App">
      <button onClick={onBrowse}>Choose image ...</button>
      <div className="ScaleBar">
        <div>
          <div className="ScaleBar">
            <div className="ScaleInfo">
              <div>Scale:&nbsp;</div>
              <input
                type="number"
                min={1}
                max={10}
                step={1}
                value={imageScale}
                onChange={onChangeScale}
              />
            </div>
            <button onClick={onSaveToFile}>Save bitmap to file</button>
          </div>
          <div className="ScaleBar">
            <div className="ScaleInfo">
              <div>Max width:&nbsp;</div>
              <input
                type="number"
                min={1}
                max={500}
                step={1}
                value={gridMaxPixelsRaw[0]}
                onChange={onChangeMaxWidth}
              />
              <div className="ScaleInfo">
                <div>Max height:&nbsp;</div>
                <input
                  type="number"
                  min={1}
                  max={500}
                  step={1}
                  value={gridMaxPixelsRaw[1]}
                  onChange={onChangeMaxHeight}
                />
              </div>
            </div>
          </div>
          <label>
            <input
              type="checkbox"
              checked={webGLGrid}
              onChange={toggleWebGLGrid}
            />
            WebGL grid
          </label>
        </div>
        <div className="ExtractedImageHolder">
          <div className="ExtractedImagePlaceholder">
            <canvas ref={refExtractedImage} width={0} height={0} />
          </div>
        </div>
      </div>
      <div
        className="ImageBox"
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
      >
        {/* Image */}
        {imageUrl && (
          <canvas
            style={{ transform: `scale(${imageScale})` }}
            ref={refImageCanvas}
            className="ImageCanvas"
          />
        )}

        {/* Grid overlay */}
        <canvas
          key={webGLGrid ? "WebGLGrid" : "Canvas2DGrid"}
          ref={refGridCanvas}
          className="ImageCanvas"
        />
      </div>
    </div>
  );
}
