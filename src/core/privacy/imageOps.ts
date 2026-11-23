// Small image-processing primitives for the privacy filter. They follow OpenCV's 8-bit
// conventions (grayscale weights, HSV with H in 0..179, inclusive ranges) because the plate
// heuristics were tuned against OpenCV in the desktop application.

export interface RgbaImage {
  data: Uint8ClampedArray | Uint8Array;
  width: number;
  height: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface GrayImage {
  data: Uint8Array;
  width: number;
  height: number;
}

export interface HsvImage {
  h: Uint8Array;
  s: Uint8Array;
  v: Uint8Array;
  width: number;
  height: number;
}

export interface ComponentStat extends Rect {
  area: number;
}

/** Clamps a rectangle to the image and returns null when nothing is left. */
export function clipRect(rect: Rect, width: number, height: number): Rect | null {
  const x1 = Math.max(0, Math.trunc(rect.x));
  const y1 = Math.max(0, Math.trunc(rect.y));
  const x2 = Math.min(width, Math.trunc(rect.x + rect.w));
  const y2 = Math.min(height, Math.trunc(rect.y + rect.h));
  return x2 > x1 && y2 > y1 ? { x: x1, y: y1, w: x2 - x1, h: y2 - y1 } : null;
}

export function cropGray(image: RgbaImage, rect: Rect): GrayImage {
  const out = new Uint8Array(rect.w * rect.h);
  const src = image.data;
  for (let y = 0; y < rect.h; y++) {
    let p = ((rect.y + y) * image.width + rect.x) * 4;
    const row = y * rect.w;
    for (let x = 0; x < rect.w; x++, p += 4) {
      out[row + x] = (src[p] * 0.299 + src[p + 1] * 0.587 + src[p + 2] * 0.114 + 0.5) | 0;
    }
  }
  return { data: out, width: rect.w, height: rect.h };
}

export function cropHsv(image: RgbaImage, rect: Rect): HsvImage {
  const n = rect.w * rect.h;
  const hOut = new Uint8Array(n);
  const sOut = new Uint8Array(n);
  const vOut = new Uint8Array(n);
  const src = image.data;
  for (let y = 0; y < rect.h; y++) {
    let p = ((rect.y + y) * image.width + rect.x) * 4;
    let i = y * rect.w;
    for (let x = 0; x < rect.w; x++, p += 4, i++) {
      const r = src[p], g = src[p + 1], b = src[p + 2];
      const max = r > g ? (r > b ? r : b) : (g > b ? g : b);
      const min = r < g ? (r < b ? r : b) : (g < b ? g : b);
      const diff = max - min;
      vOut[i] = max;
      sOut[i] = max === 0 ? 0 : Math.round((255 * diff) / max);
      if (diff !== 0) {
        let hue: number;
        if (max === r) hue = (60 * (g - b)) / diff;
        else if (max === g) hue = 120 + (60 * (b - r)) / diff;
        else hue = 240 + (60 * (r - g)) / diff;
        if (hue < 0) hue += 360;
        const half = Math.round(hue / 2);
        hOut[i] = half >= 180 ? half - 180 : half;
      }
    }
  }
  return { h: hOut, s: sOut, v: vOut, width: rect.w, height: rect.h };
}

/** Returns the sub-image of a grayscale image (copy). */
export function subGray(image: GrayImage, rect: Rect): GrayImage {
  const out = new Uint8Array(rect.w * rect.h);
  for (let y = 0; y < rect.h; y++) {
    const from = (rect.y + y) * image.width + rect.x;
    out.set(image.data.subarray(from, from + rect.w), y * rect.w);
  }
  return { data: out, width: rect.w, height: rect.h };
}

export function subHsv(image: HsvImage, rect: Rect): HsvImage {
  const cut = (plane: Uint8Array) => subGray({ data: plane, width: image.width, height: image.height }, rect).data;
  return { h: cut(image.h), s: cut(image.s), v: cut(image.v), width: rect.w, height: rect.h };
}

/** 1 where every channel lies inside its inclusive range, else 0. */
export function inRangeHsv(image: HsvImage, lo: [number, number, number], hi: [number, number, number]): Uint8Array {
  const n = image.width * image.height;
  const out = new Uint8Array(n);
  const { h, s, v } = image;
  for (let i = 0; i < n; i++) {
    if (h[i] >= lo[0] && h[i] <= hi[0] && s[i] >= lo[1] && s[i] <= hi[1] && v[i] >= lo[2] && v[i] <= hi[2]) out[i] = 1;
  }
  return out;
}

export function countNonZero(mask: Uint8Array): number {
  let count = 0;
  for (let i = 0; i < mask.length; i++) if (mask[i]) count++;
  return count;
}

// Mirrored border index without repeating the edge pixel (OpenCV BORDER_REFLECT_101).
function reflect(i: number, n: number): number {
  if (n === 1) return 0;
  if (i < 0) return -i;
  if (i >= n) return 2 * n - 2 - i;
  return i;
}

/** 3x3 Sobel derivative; `dx` selects the horizontal derivative, otherwise vertical. Signed result. */
export function sobel3(image: GrayImage, dx: boolean): Int16Array {
  const { width: w, height: h, data } = image;
  const out = new Int16Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = reflect(y - 1, h) * w, y1 = y * w, y2 = reflect(y + 1, h) * w;
    for (let x = 0; x < w; x++) {
      const x0 = reflect(x - 1, w), x2 = reflect(x + 1, w);
      out[y1 + x] = dx
        ? (data[y0 + x2] + 2 * data[y1 + x2] + data[y2 + x2]) - (data[y0 + x0] + 2 * data[y1 + x0] + data[y2 + x0])
        : (data[y2 + x0] + 2 * data[y2 + x] + data[y2 + x2]) - (data[y0 + x0] + 2 * data[y0 + x] + data[y0 + x2]);
    }
  }
  return out;
}

/** Otsu's threshold over 8-bit values; pixels strictly above it are foreground. */
export function otsuThreshold(values: Uint8Array): number {
  const hist = new Float64Array(256);
  for (let i = 0; i < values.length; i++) hist[values[i]]++;
  const total = values.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0, wB = 0, best = 0, bestVar = -1;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const diff = sumB / wB - (sum - sumB) / wF;
    const between = wB * wF * diff * diff;
    if (between > bestVar) { bestVar = between; best = t; }
  }
  return best;
}

function morph1d(src: Uint8Array, w: number, h: number, k: number, horizontal: boolean, dilate: boolean): Uint8Array {
  const out = new Uint8Array(w * h);
  const r = k >> 1;
  const len = horizontal ? w : h;
  const lines = horizontal ? h : w;
  const step = horizontal ? 1 : w;
  // Pixels outside the image never win (they neither set a dilation nor clear an erosion).
  const prefix = new Int32Array(len + 1);
  for (let line = 0; line < lines; line++) {
    const base = horizontal ? line * w : line;
    for (let i = 0; i < len; i++) prefix[i + 1] = prefix[i] + (src[base + i * step] ? 1 : 0);
    for (let i = 0; i < len; i++) {
      const a = Math.max(0, i - r), b = Math.min(len, i + r + 1);
      const ones = prefix[b] - prefix[a];
      out[base + i * step] = dilate ? (ones > 0 ? 1 : 0) : (ones === b - a ? 1 : 0);
    }
  }
  return out;
}

/** Morphological closing of a binary mask with a kw x kh rectangle. */
export function closeRect(mask: Uint8Array, w: number, h: number, kw: number, kh: number): Uint8Array {
  const dilated = morph1d(morph1d(mask, w, h, kw, true, true), w, h, kh, false, true);
  return morph1d(morph1d(dilated, w, h, kw, true, false), w, h, kh, false, false);
}

/** 8-connected components of a binary mask, with bounding box and pixel count. */
export function connectedComponents(mask: Uint8Array, w: number, h: number): ComponentStat[] {
  const seen = new Uint8Array(w * h);
  const stack = new Int32Array(w * h);
  const stats: ComponentStat[] = [];
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || seen[start]) continue;
    let top = 0;
    stack[top++] = start;
    seen[start] = 1;
    let minX = w, minY = h, maxX = 0, maxY = 0, area = 0;
    while (top > 0) {
      const p = stack[--top];
      const y = (p / w) | 0, x = p - y * w;
      area++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      const ya = y > 0 ? y - 1 : y, yb = y < h - 1 ? y + 1 : y;
      const xa = x > 0 ? x - 1 : x, xb = x < w - 1 ? x + 1 : x;
      for (let ny = ya; ny <= yb; ny++) {
        for (let nx = xa; nx <= xb; nx++) {
          const q = ny * w + nx;
          if (mask[q] && !seen[q]) { seen[q] = 1; stack[top++] = q; }
        }
      }
    }
    stats.push({ x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1, area });
  }
  return stats;
}

function gaussianKernel(size: number): Float64Array {
  const sigma = 0.3 * ((size - 1) * 0.5 - 1) + 0.8;
  const kernel = new Float64Array(size);
  const c = (size - 1) / 2;
  let sum = 0;
  for (let i = 0; i < size; i++) { kernel[i] = Math.exp(-((i - c) * (i - c)) / (2 * sigma * sigma)); sum += kernel[i]; }
  for (let i = 0; i < size; i++) kernel[i] /= sum;
  return kernel;
}

/** Gaussian-weighted adaptive threshold, inverted: 1 where a pixel is at least `c` darker than its surroundings. */
export function adaptiveThresholdInv(image: GrayImage, blockSize: number, c: number): Uint8Array {
  const { width: w, height: h, data } = image;
  const kernel = gaussianKernel(blockSize);
  const r = blockSize >> 1;
  const tmp = new Float64Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let k = -r; k <= r; k++) {
        const xx = x + k < 0 ? 0 : x + k >= w ? w - 1 : x + k;
        acc += data[y * w + xx] * kernel[k + r];
      }
      tmp[y * w + x] = acc;
    }
  }
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let k = -r; k <= r; k++) {
        const yy = y + k < 0 ? 0 : y + k >= h ? h - 1 : y + k;
        acc += tmp[yy * w + x] * kernel[k + r];
      }
      if (data[y * w + x] - Math.round(acc) <= -c) out[y * w + x] = 1;
    }
  }
  return out;
}

/** Percentile with linear interpolation between closest ranks (numpy's default). */
export function percentile(values: Uint8Array, p: number): number {
  if (values.length === 0) return 0;
  const hist = new Uint32Array(256);
  for (let i = 0; i < values.length; i++) hist[values[i]]++;
  const rank = (p / 100) * (values.length - 1);
  const lo = Math.floor(rank), hi = Math.ceil(rank);
  let loVal = 0, hiVal = 0, seen = 0, gotLo = false;
  for (let v = 0; v < 256; v++) {
    seen += hist[v];
    if (!gotLo && seen > lo) { loVal = v; gotLo = true; }
    if (seen > hi) { hiVal = v; break; }
  }
  return loVal + (hiVal - loVal) * (rank - lo);
}

export function iou(a: Rect, b: Rect): number {
  const ix1 = Math.max(a.x, b.x), iy1 = Math.max(a.y, b.y);
  const ix2 = Math.min(a.x + a.w, b.x + b.w), iy2 = Math.min(a.y + a.h, b.y + b.h);
  if (ix2 <= ix1 || iy2 <= iy1) return 0;
  const inter = (ix2 - ix1) * (iy2 - iy1);
  const union = a.w * a.h + b.w * b.h - inter;
  return union > 0 ? inter / union : 0;
}

/** Greedy non-maximum suppression; returns the kept indices, best score first. */
export function nonMaxSuppression(boxes: Rect[], scores: number[], scoreThreshold: number, iouThreshold: number): number[] {
  const order = boxes.map((_, i) => i).filter((i) => scores[i] > scoreThreshold).sort((a, b) => scores[b] - scores[a]);
  const kept: number[] = [];
  for (const i of order) {
    if (kept.every((k) => iou(boxes[i], boxes[k]) <= iouThreshold)) kept.push(i);
  }
  return kept;
}
