import { GridParams } from "./rendererTypes";

// Vertex shader program

const vsSource = `
 attribute vec4 aVertexPosition;

 void main() {
   gl_Position = aVertexPosition;
 }
`;

const fsSource = `
  precision highp float;

  uniform vec2 uGridBottomLeft;
  uniform vec2 uGridCellSize;
  uniform vec2 uGridCellCount;

  void main() {
    vec2 coordInGridSpace = vec2(gl_FragCoord.x, gl_FragCoord.y) - uGridBottomLeft;
    vec2 uGridTopRightInGridSpace = uGridCellSize * uGridCellCount;

    float gridArea =
      step(0.0, coordInGridSpace.x) * (1.0 - step(uGridTopRightInGridSpace.x + 1.0, coordInGridSpace.x)) *
      step(0.0, coordInGridSpace.y) * (1.0 - step(uGridTopRightInGridSpace.y + 1.0, coordInGridSpace.y));
    
    float gridInnerArea =
      step(1.0, coordInGridSpace.x) * (1.0 - step(uGridTopRightInGridSpace.x, coordInGridSpace.x)) *
      step(1.0, coordInGridSpace.y) * (1.0 - step(uGridTopRightInGridSpace.y, coordInGridSpace.y));

    float gridLine = (
      mod(coordInGridSpace.x, uGridCellSize.x) <= 1.0 ||
      mod(coordInGridSpace.y, uGridCellSize.y) <= 1.0
    )
    ? gridArea
    : 0.0;
    
    float dashPhase = mod(coordInGridSpace.x + coordInGridSpace.y, 2.0) < 1.0 ? 1.0 : 0.0;

    float lum = gridLine * dashPhase;

    gl_FragColor = vec4(lum * gridInnerArea, lum, lum, gridLine);
  }
`;

export class WebGLError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebGLError";
  }
}

/** Compile a shader program of the given type */
function loadShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new WebGLError("Failed to create shader.");
  }

  // Send the source to the shader object
  gl.shaderSource(shader, source);

  // Compile the shader program
  gl.compileShader(shader);

  // See if it compiled successfully
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    // Shader failed to compile
    const shaderInfoLog = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);

    throw new WebGLError(
      `An error occurred compiling the shaders: ${shaderInfoLog}.`
    );
  }

  return shader;
}

function createShaderProgram(
  gl: WebGLRenderingContext,
  vertexShaderSource: string,
  fragmentShaderSource: string
): WebGLProgram {
  // Load vertex and fragment shaders
  const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
  const fragmentShader = loadShader(
    gl,
    gl.FRAGMENT_SHADER,
    fragmentShaderSource
  );

  // Cretae the shader program
  const shaderProgram = gl.createProgram();
  if (!shaderProgram) {
    throw new WebGLError("Failed to create shader program.");
  }

  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);

  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  gl.linkProgram(shaderProgram);

  // Check if creating the shader program failed
  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    // Shader failed to compile
    const programInfoLog = gl.getProgramInfoLog(shaderProgram);
    gl.deleteProgram(shaderProgram);

    throw new WebGLError(
      `Unable to initialize the shader program: ${programInfoLog}.`
    );
  }

  return shaderProgram;
}

interface GridRendererProgramInfo {
  program: WebGLProgram;
  attribLocations: {
    vertexPosition: number;
  };
  uniformLocations: {
    gridBottomLeft: WebGLUniformLocation;
    gridCellSize: WebGLUniformLocation;
    gridCellCount: WebGLUniformLocation;
  };
}

function createGridRendererProgram(
  gl: WebGLRenderingContext
): GridRendererProgramInfo {
  const shaderProgram = createShaderProgram(gl, vsSource, fsSource);

  return {
    program: shaderProgram,
    attribLocations: {
      vertexPosition: gl.getAttribLocation(shaderProgram, "aVertexPosition")
    },
    uniformLocations: {
      gridBottomLeft: gl.getUniformLocation(shaderProgram, "uGridBottomLeft")!,
      gridCellSize: gl.getUniformLocation(shaderProgram, "uGridCellSize")!,
      gridCellCount: gl.getUniformLocation(shaderProgram, "uGridCellCount")!
    }
  };
}

interface GridRendererBuffers {
  position: WebGLBuffer;
}

// Create the buffers we need for the grid renderer
function createGridRendererBuffers(
  gl: WebGLRenderingContext
): GridRendererBuffers {
  // Create buffer in GPU for a simple quad
  const positionBuffer = gl.createBuffer();

  if (!positionBuffer) {
    throw new WebGLError("Failed to create position buffer");
  }

  // Assign buffer to target "register"
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

  // prettier-ignore
  const bufferVerts = [
     1.0,  1.0,
    -1.0,  1.0,
     1.0, -1.0,
    -1.0, -1.0
  ];

  // Copy buffer vertices into GL buffer
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(bufferVerts), gl.STATIC_DRAW);

  return {
    position: positionBuffer
  };
}

function drawGridScene(
  gl: WebGLRenderingContext,
  programInfo: GridRendererProgramInfo,
  gridRendererBuffers: GridRendererBuffers,
  { canvasSize, maxCells, cellSize, gridOffset, renderScale }: GridParams
) {
  gl.clearColor(0.0, 0.0, 0.0, 0.0); // Clear to black, fully transparent
  gl.clearDepth(1.0); // Clear everything
  gl.enable(gl.DEPTH_TEST); // Enable depth testing
  gl.depthFunc(gl.LEQUAL); // Near things obscure far things

  // Clear the canvas
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // Map buffer to vertexPosition attribute
  {
    const numComponents = 2;
    const type = gl.FLOAT;
    const normalize = false;
    const stride = 0;
    const offset = 0;

    // Set our position buffer as the active buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, gridRendererBuffers.position);

    gl.vertexAttribPointer(
      programInfo.attribLocations.vertexPosition,
      numComponents,
      type,
      normalize,
      stride,
      offset
    );

    gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);
  }

  // Calculate grid uniforms
  const gridCellSize = [cellSize[0] * renderScale, cellSize[1] * renderScale];

  // prettier-ignore
  const gridCellCount = [
    Math.min(maxCells[0], Math.floor((canvasSize[0] - gridOffset[0]) / cellSize[0])),
    Math.min(maxCells[1], Math.floor((canvasSize[1] - gridOffset[1]) / cellSize[1]))
  ];

  // prettier-ignore
  const gridBottomLeft = [
    renderScale * gridOffset[0],
    renderScale * (canvasSize[1] - gridOffset[1] - gridCellCount[1] * cellSize[1])
  ];

  gl.uniform2fv(programInfo.uniformLocations.gridBottomLeft, gridBottomLeft);
  gl.uniform2fv(programInfo.uniformLocations.gridCellSize, gridCellSize);
  gl.uniform2fv(programInfo.uniformLocations.gridCellCount, gridCellCount);

  // Set active shader program
  gl.useProgram(programInfo.program);

  // Set viewport to cover the entire render target
  gl.viewport(0, 0, canvasSize[0] * renderScale, canvasSize[1] * renderScale);

  // Make draw call
  {
    const offset = 0;
    const vertexCount = 4;
    gl.drawArrays(gl.TRIANGLE_STRIP, offset, vertexCount);
  }
}

// We're relying on garbage collection to free WebGL resources. This
// is probably bad.
export class GridRenderer {
  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext;
  private gridRendererProgramInfo: GridRendererProgramInfo;
  private gridRendererBuffers: GridRendererBuffers;

  public constructor(canvas: HTMLCanvasElement) {
    // Initialize the GL context
    const gl = canvas.getContext("webgl");

    // Only continue if WebGL is available and working
    if (gl === null) {
      throw new WebGLError("Can't get WebGL context.");
    }

    this.canvas = canvas;
    this.gl = gl;
    this.gridRendererProgramInfo = createGridRendererProgram(gl);
    this.gridRendererBuffers = createGridRendererBuffers(gl);
  }

  public gridCanvas() {
    return this.canvas;
  }

  public render(gridParams: GridParams) {
    const { canvasSize, renderScale } = gridParams;

    // Update canvas size
    this.canvas.width = canvasSize[0] * renderScale;
    this.canvas.height = canvasSize[1] * renderScale;

    drawGridScene(
      this.gl,
      this.gridRendererProgramInfo,
      this.gridRendererBuffers,
      gridParams
    );
  }
}
