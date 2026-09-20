/**
 * Applies a parsed `.cube` to pixels.
 *
 * Two backends behind one interface. WebGL2 uploads the cube as a `TEXTURE_3D`
 * and lets the sampler do the trilinear interpolation — the whole reason to
 * reach for the GPU here, since that interpolation is the expensive part and
 * hardware does it for free. The CPU path does the same maths by hand for
 * browsers without WebGL2, and is deliberately the plainer of the two.
 *
 * The split is `setSource` / `setLut` / `draw` rather than one call because the
 * intensity slider re-runs only the last of the three. Re-uploading a 24MP
 * texture on every frame of a drag is the difference between a preview that
 * tracks the pointer and one that stutters.
 *
 * Colour management, stated plainly: the LUT is applied to the image's *encoded*
 * sRGB values, which is what display-referred `.cube` files expect. A log LUT
 * (S-Log, LogC, V-Log) assumes log-encoded input and will look wrong here —
 * that is a property of the file, not a bug in this code.
 */

import type { CubeLut } from "./cube";

export type LutBackend = "webgl2" | "cpu";

export interface LutRenderer {
  /** Owned by the renderer, sized by `setSource`. Attach it, or draw from it. */
  readonly canvas: HTMLCanvasElement;
  readonly backend: LutBackend;
  /**
   * Sizes the canvas to the bitmap and uploads it. Always re-uploads.
   *
   * Create the bitmap with `premultiplyAlpha: "none"`. WebGL ignores
   * `UNPACK_PREMULTIPLY_ALPHA_WEBGL` for an `ImageBitmap`, so a premultiplied
   * one grades the pixel's faded-toward-black value rather than its colour —
   * visible wherever the image is partly transparent.
   */
  setSource(source: ImageBitmap): void;
  /** `null` renders the source untouched, which is what intensity 0 means too. */
  setLut(lut: CubeLut | null): void;
  /** `intensity` 0–1: a linear mix between the source and the graded result. */
  draw(intensity: number): void;
  dispose(): void;
}

/** Per-channel domain normalisation, shared by both backends. */
const domainScaleOf = (lut: CubeLut): [number, number, number] => [
  1 / (lut.domainMax[0] - lut.domainMin[0]),
  1 / (lut.domainMax[1] - lut.domainMin[1]),
  1 / (lut.domainMax[2] - lut.domainMin[2]),
];

const clamp01 = (value: number) => (value < 0 ? 0 : value > 1 ? 1 : value);

/* -------------------------------------------------------------------------- */
/* WebGL2                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * No attributes: `gl_VertexID` spans one oversized triangle covering the clip
 * volume, so there is no buffer to allocate, bind or tear down.
 *
 * `v` is inverted because the texture is not. WebGL ignores
 * `UNPACK_FLIP_Y_WEBGL` for an `ImageBitmap` source — the bitmap's orientation
 * is fixed when it is created, and the unpack parameter cannot override it —
 * so row 0 of the texture is the top of the photo while clip `y = -1` is the
 * bottom of the canvas. Flipping here is the one place that cannot be ignored.
 */
const VERTEX_SHADER = `#version 300 es
out vec2 vUv;
void main() {
  vec2 corner = vec2(float((gl_VertexID & 1) << 2), float((gl_VertexID & 2) << 1));
  vUv = vec2(corner.x * 0.5, 1.0 - corner.y * 0.5);
  gl_Position = vec4(corner - 1.0, 0.0, 1.0);
}`;

/**
 * `#define LUT_1D` switches the cube for three curve lookups. One source with a
 * define, rather than two files, because everything except the sampling line is
 * identical and two copies would drift.
 *
 * The half-texel inset matters: texture coordinate 0 sits on the *edge* of the
 * first texel, not its centre, so sampling the raw 0–1 range reads half a texel
 * of clamped edge at both ends and flattens the darkest and brightest steps.
 */
const FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp sampler3D;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uImage;
#ifdef LUT_1D
uniform sampler2D uLut;
#else
uniform sampler3D uLut;
#endif
uniform float uSize;
uniform float uIntensity;
uniform vec3 uDomainMin;
uniform vec3 uDomainScale;

void main() {
  vec4 src = texture(uImage, vUv);

  vec3 normalized = clamp((src.rgb - uDomainMin) * uDomainScale, 0.0, 1.0);
  vec3 coord = normalized * ((uSize - 1.0) / uSize) + (0.5 / uSize);

#ifdef LUT_1D
  vec3 graded = vec3(
    texture(uLut, vec2(coord.r, 0.5)).r,
    texture(uLut, vec2(coord.g, 0.5)).g,
    texture(uLut, vec2(coord.b, 0.5)).b
  );
#else
  vec3 graded = texture(uLut, coord).rgb;
#endif

  fragColor = vec4(mix(src.rgb, graded, uIntensity), src.a);
}`;

const UNIFORM_NAMES = [
  "uImage",
  "uLut",
  "uSize",
  "uIntensity",
  "uDomainMin",
  "uDomainScale",
] as const;

type Uniforms = Record<
  (typeof UNIFORM_NAMES)[number],
  WebGLUniformLocation | null
>;

interface Pipeline {
  program: WebGLProgram;
  uniforms: Uniforms;
}

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("The GPU refused to create a shader.");

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader failed to compile: ${log ?? "no reason given"}`);
  }

  return shader;
}

function link(gl: WebGL2RenderingContext, fragmentSource: string): Pipeline {
  const program = gl.createProgram();
  if (!program) throw new Error("The GPU refused to create a program.");

  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentSource);

  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  // Attached shaders stay alive until the program is deleted; flagging them
  // here is what lets the driver reclaim them with it.
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Shader program failed to link: ${log ?? "no reason given"}`);
  }

  const uniforms = {} as Uniforms;
  for (const name of UNIFORM_NAMES) {
    uniforms[name] = gl.getUniformLocation(program, name);
  }

  return { program, uniforms };
}

/**
 * Float table to the 8-bit texture the GPU samples.
 *
 * 8 bits per node is not the precision loss it looks like. The quantisation
 * error is at most 1/255 of the output's own scale, and the values between
 * nodes are still interpolated in float by the sampler — so the result differs
 * from a float table by at most one unit in a byte we are about to write as a
 * byte anyway. What it does cost is range: a LUT with values outside 0–1 gets
 * clamped. Display-referred LUTs, which is what this supports, have none.
 */
function toTextureBytes(data: Float32Array, entries: number) {
  const bytes = new Uint8Array(entries * 4);

  for (let index = 0; index < entries; index += 1) {
    bytes[index * 4] = Math.round(clamp01(data[index * 3]) * 255);
    bytes[index * 4 + 1] = Math.round(clamp01(data[index * 3 + 1]) * 255);
    bytes[index * 4 + 2] = Math.round(clamp01(data[index * 3 + 2]) * 255);
    bytes[index * 4 + 3] = 255;
  }

  return bytes;
}

/** Unit 0 holds the photo, unit 1 the LUT — fixed, because a `sampler3D` and a
 *  `sampler2D` resolving to the *same* unit is an error at draw time, which is
 *  exactly what happens if `uLut` is left at its default of 0. */
const IMAGE_UNIT = 0;
const LUT_UNIT = 1;

function createWebglRenderer(canvas: HTMLCanvasElement): LutRenderer | null {
  const gl = canvas.getContext("webgl2", {
    // The source bitmap is uploaded with straight alpha so the LUT grades the
    // real colour of a transparent pixel rather than its premultiplied ghost;
    // the drawing buffer has to agree or compositing undoes it.
    premultipliedAlpha: false,
    // The canvas is read back (drawImage, toBlob) outside the frame that drew
    // it, which is exactly the case a cleared buffer would silently break.
    preserveDrawingBuffer: true,
    antialias: false,
    depth: false,
    stencil: false,
  });

  if (!gl) return null;

  const pipelines = new Map<1 | 3, Pipeline>();
  const imageTexture = gl.createTexture();
  let lutTexture: WebGLTexture | null = null;
  let lutTarget: number = gl.TEXTURE_3D;
  let lutDimensions: 1 | 3 = 3;
  let lutSize = 2;
  let domainMin: [number, number, number] = [0, 0, 0];
  let domainScale: [number, number, number] = [1, 1, 1];

  // No `UNPACK_FLIP_Y_WEBGL` or `UNPACK_PREMULTIPLY_ALPHA_WEBGL` here: both are
  // ignored for an `ImageBitmap`. Orientation is handled in the vertex shader,
  // and alpha is the caller's to set — see `setSource`.
  gl.activeTexture(gl.TEXTURE0 + IMAGE_UNIT);
  gl.bindTexture(gl.TEXTURE_2D, imageTexture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const pipelineFor = (dimensions: 1 | 3) => {
    const existing = pipelines.get(dimensions);
    if (existing) return existing;

    const pipeline = link(
      gl,
      dimensions === 1
        ? FRAGMENT_SHADER.replace(
            "#version 300 es",
            "#version 300 es\n#define LUT_1D"
          )
        : FRAGMENT_SHADER
    );

    pipelines.set(dimensions, pipeline);
    return pipeline;
  };

  return {
    canvas,
    backend: "webgl2",

    setSource(source) {
      canvas.width = source.width;
      canvas.height = source.height;

      gl.activeTexture(gl.TEXTURE0 + IMAGE_UNIT);
      gl.bindTexture(gl.TEXTURE_2D, imageTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    },

    setLut(lut) {
      if (lutTexture) {
        gl.activeTexture(gl.TEXTURE0 + LUT_UNIT);
        gl.bindTexture(lutTarget, null);
        gl.deleteTexture(lutTexture);
        lutTexture = null;
      }

      if (!lut) return;

      lutDimensions = lut.dimensions;
      lutSize = lut.size;
      lutTarget = lut.dimensions === 3 ? gl.TEXTURE_3D : gl.TEXTURE_2D;
      domainMin = lut.domainMin;
      domainScale = domainScaleOf(lut);

      const entries = lut.dimensions === 3 ? lut.size ** 3 : lut.size;
      const bytes = toTextureBytes(lut.data, entries);

      lutTexture = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0 + LUT_UNIT);
      gl.bindTexture(lutTarget, lutTexture);
      gl.texParameteri(lutTarget, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(lutTarget, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(lutTarget, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(lutTarget, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      if (lut.dimensions === 3) {
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
        gl.texImage3D(
          gl.TEXTURE_3D,
          0,
          gl.RGBA,
          lut.size,
          lut.size,
          lut.size,
          0,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          bytes
        );
      } else {
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          lut.size,
          1,
          0,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          bytes
        );
      }

      gl.activeTexture(gl.TEXTURE0 + IMAGE_UNIT);
    },

    draw(intensity) {
      // With no LUT the cube program still runs, with intensity pinned to 0:
      // unit 1 is then simply empty, which samples as black and is mixed out.
      const { program, uniforms } = pipelineFor(lutTexture ? lutDimensions : 3);

      gl.useProgram(program);
      gl.viewport(0, 0, canvas.width, canvas.height);

      gl.activeTexture(gl.TEXTURE0 + IMAGE_UNIT);
      gl.bindTexture(gl.TEXTURE_2D, imageTexture);
      gl.uniform1i(uniforms.uImage, IMAGE_UNIT);

      gl.activeTexture(gl.TEXTURE0 + LUT_UNIT);
      gl.bindTexture(lutTarget, lutTexture);
      gl.uniform1i(uniforms.uLut, LUT_UNIT);

      gl.uniform1f(uniforms.uSize, lutSize);
      gl.uniform1f(uniforms.uIntensity, lutTexture ? clamp01(intensity) : 0);
      gl.uniform3fv(uniforms.uDomainMin, domainMin);
      gl.uniform3fv(uniforms.uDomainScale, domainScale);

      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },

    dispose() {
      gl.deleteTexture(imageTexture);
      if (lutTexture) gl.deleteTexture(lutTexture);
      for (const { program } of pipelines.values()) gl.deleteProgram(program);
      pipelines.clear();
      // Without this the context lingers until GC, and browsers cap how many
      // may exist at once — a handful of opened previews would exhaust it.
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}

/* -------------------------------------------------------------------------- */
/* CPU                                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Trilinear interpolation between the eight cube nodes around a colour — the
 * same thing the GPU sampler does, written out. Writes into `out` rather than
 * allocating a triple per pixel.
 */
function sampleCube(
  lut: CubeLut,
  r: number,
  g: number,
  b: number,
  out: Float32Array
) {
  const { data, size } = lut;
  const last = size - 1;
  const plane = size * size;

  const fr = r * last;
  const fg = g * last;
  const fb = b * last;

  const r0 = Math.floor(fr);
  const g0 = Math.floor(fg);
  const b0 = Math.floor(fb);
  const r1 = r0 < last ? r0 + 1 : last;
  const g1 = g0 < last ? g0 + 1 : last;
  const b1 = b0 < last ? b0 + 1 : last;

  const dr = fr - r0;
  const dg = fg - g0;
  const db = fb - b0;

  // The eight corners, resolved once as base offsets into the flat table.
  const c000 = (r0 + g0 * size + b0 * plane) * 3;
  const c100 = (r1 + g0 * size + b0 * plane) * 3;
  const c010 = (r0 + g1 * size + b0 * plane) * 3;
  const c110 = (r1 + g1 * size + b0 * plane) * 3;
  const c001 = (r0 + g0 * size + b1 * plane) * 3;
  const c101 = (r1 + g0 * size + b1 * plane) * 3;
  const c011 = (r0 + g1 * size + b1 * plane) * 3;
  const c111 = (r1 + g1 * size + b1 * plane) * 3;

  for (let channel = 0; channel < 3; channel += 1) {
    const x00 = data[c000 + channel] + (data[c100 + channel] - data[c000 + channel]) * dr;
    const x10 = data[c010 + channel] + (data[c110 + channel] - data[c010 + channel]) * dr;
    const x01 = data[c001 + channel] + (data[c101 + channel] - data[c001 + channel]) * dr;
    const x11 = data[c011 + channel] + (data[c111 + channel] - data[c011 + channel]) * dr;

    const y0 = x00 + (x10 - x00) * dg;
    const y1 = x01 + (x11 - x01) * dg;

    out[channel] = y0 + (y1 - y0) * db;
  }
}

/**
 * A curve has only 256 possible inputs per channel, so the whole transform
 * collapses to three byte tables computed once — no per-pixel interpolation at
 * all, and the result is exact rather than approximate.
 */
function buildCurveTables(lut: CubeLut, intensity: number) {
  const tables = [new Uint8Array(256), new Uint8Array(256), new Uint8Array(256)];
  const scale = domainScaleOf(lut);
  const last = lut.size - 1;

  for (let channel = 0; channel < 3; channel += 1) {
    for (let value = 0; value < 256; value += 1) {
      const source = value / 255;
      const position =
        clamp01((source - lut.domainMin[channel]) * scale[channel]) * last;
      const low = Math.floor(position);
      const high = low < last ? low + 1 : last;
      const fraction = position - low;

      const graded =
        lut.data[low * 3 + channel] +
        (lut.data[high * 3 + channel] - lut.data[low * 3 + channel]) * fraction;

      tables[channel][value] = Math.round(
        clamp01(source + (graded - source) * intensity) * 255
      );
    }
  }

  return tables;
}

/**
 * The CPU path, exported on its own because it is the useful half of this
 * module for anything that already holds pixels — a worker, a test, the
 * compression pipeline — and has no use for a canvas.
 *
 * Mutates and returns `image`. Alpha is left alone: a LUT grades colour, and
 * nothing in the format describes what it would mean to grade transparency.
 */
export function applyLutToImageData(
  image: ImageData,
  lut: CubeLut,
  intensity: number
): ImageData {
  if (intensity <= 0) return image;

  const { data } = image;

  if (lut.dimensions === 1) {
    const [red, green, blue] = buildCurveTables(lut, intensity);

    for (let index = 0; index < data.length; index += 4) {
      data[index] = red[data[index]];
      data[index + 1] = green[data[index + 1]];
      data[index + 2] = blue[data[index + 2]];
    }

    return image;
  }

  const scale = domainScaleOf(lut);
  const graded = new Float32Array(3);

  /** The domain maps a byte to a 0–1 lookup position; there are 256 of them
   *  per channel, so normalising is a table read rather than three divisions
   *  and three clamps per pixel. */
  const normalized = [
    new Float32Array(256),
    new Float32Array(256),
    new Float32Array(256),
  ];

  for (let channel = 0; channel < 3; channel += 1) {
    for (let value = 0; value < 256; value += 1) {
      normalized[channel][value] = clamp01(
        (value / 255 - lut.domainMin[channel]) * scale[channel]
      );
    }
  }

  for (let index = 0; index < data.length; index += 4) {
    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];

    sampleCube(
      lut,
      normalized[0][r],
      normalized[1][g],
      normalized[2][b],
      graded
    );

    data[index] = Math.round(clamp01(r / 255 + (graded[0] - r / 255) * intensity) * 255);
    data[index + 1] = Math.round(clamp01(g / 255 + (graded[1] - g / 255) * intensity) * 255);
    data[index + 2] = Math.round(clamp01(b / 255 + (graded[2] - b / 255) * intensity) * 255);
  }

  return image;
}

function createCpuRenderer(canvas: HTMLCanvasElement): LutRenderer | null {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;

  /** The ungraded pixels, read once. Grading is destructive and every draw
   *  starts from the original, so keeping them is what makes the intensity
   *  slider reversible — and it lets the caller close the bitmap immediately,
   *  which matters because a decoded 24MP photo is 96MB held open. */
  let pristine: ImageData | null = null;
  let lut: CubeLut | null = null;

  return {
    canvas,
    backend: "cpu",

    setSource(source) {
      canvas.width = source.width;
      canvas.height = source.height;
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(source, 0, 0);
      pristine = context.getImageData(0, 0, canvas.width, canvas.height);
    },

    setLut(next) {
      lut = next;
    },

    draw(intensity) {
      if (!pristine) return;

      if (!lut || intensity <= 0) {
        context.putImageData(pristine, 0, 0);
        return;
      }

      const working = new ImageData(
        new Uint8ClampedArray(pristine.data),
        pristine.width,
        pristine.height
      );

      applyLutToImageData(working, lut, clamp01(intensity));
      context.putImageData(working, 0, 0);
    },

    dispose() {
      pristine = null;
      lut = null;
    },
  };
}

/* -------------------------------------------------------------------------- */

/**
 * WebGL2 when the browser has it, the CPU when it does not. The caller gets to
 * know which — a preview that is about to be slow should say so rather than
 * feel broken.
 *
 * Throws only if neither backend can be created, which means the browser has
 * no working canvas at all.
 */
export function createLutRenderer(
  options: { forceCpu?: boolean } = {}
): LutRenderer {
  if (!options.forceCpu) {
    try {
      const webgl = createWebglRenderer(document.createElement("canvas"));
      if (webgl) return webgl;
    } catch {
      // A context that exists but cannot compile the shader is a driver
      // problem, not a reason to fail. The canvas above is discarded with it:
      // a canvas that has held a WebGL context cannot hand out a 2D one.
    }
  }

  const cpu = createCpuRenderer(document.createElement("canvas"));
  if (cpu) return cpu;

  throw new Error("This browser cannot create a canvas to apply a LUT.");
}
