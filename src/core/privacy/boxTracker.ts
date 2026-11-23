// Keeps detected boxes stable between detections. Ported from the desktop application's
// BoxTracker: detections update a track's position, size and velocity; between detections a
// track follows its own image patch by template matching, or coasts on its velocity.
import { GrayImage, iou, Rect } from './imageOps';

interface Track {
  rect: Rect;
  center: [number, number];
  velocity: [number, number];
  size: [number, number];
  hits: number;
  ttl: number;
  confirmed: boolean;
  template: GrayImage | null;
}

const int = Math.trunc;
const clampVelocity = (v: number) => Math.max(-45, Math.min(45, v));

function centerDistance(a: Rect, b: Rect): number {
  return Math.hypot(a.x + a.w / 2 - (b.x + b.w / 2), a.y + a.h / 2 - (b.y + b.h / 2));
}

function cutTemplate(gray: GrayImage, rect: Rect): GrayImage | null {
  const x1 = Math.max(0, rect.x), y1 = Math.max(0, rect.y);
  const x2 = Math.min(gray.width, rect.x + rect.w), y2 = Math.min(gray.height, rect.y + rect.h);
  const w = x2 - x1, h = y2 - y1;
  if (w < 8 || h < 6) return null;
  const data = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const from = (y1 + y) * gray.width + x1;
    data.set(gray.data.subarray(from, from + w), y * w);
  }
  return { data, width: w, height: h };
}

// Matching cost grows with template area times search area, so a large box (a nearby face is
// tens of thousands of pixels) is first located on a reduced copy of the image and then pinned
// down at full resolution around that position. The second step matters: a position that is only
// accurate to the reduction factor makes the stored template creep off its target frame by frame.
const COARSE_MAX_TEMPLATE_SIDE = 48;
const REFINE_MAX_SAMPLES = 900;

/** Box-averages a region of `gray` by an integer factor. */
function shrinkRegion(gray: GrayImage, x0: number, y0: number, w: number, h: number, factor: number): GrayImage {
  const ow = Math.floor(w / factor), oh = Math.floor(h / factor);
  const data = new Uint8Array(ow * oh);
  const area = factor * factor;
  for (let y = 0; y < oh; y++) {
    for (let x = 0; x < ow; x++) {
      let sum = 0;
      for (let dy = 0; dy < factor; dy++) {
        let p = (y0 + y * factor + dy) * gray.width + x0 + x * factor;
        for (let dx = 0; dx < factor; dx++) sum += gray.data[p++];
      }
      data[y * ow + x] = (sum / area + 0.5) | 0;
    }
  }
  return { data, width: ow, height: oh };
}

/**
 * Zero-mean normalised cross-correlation over every position in the window. `step` samples every
 * Nth template pixel in both directions, which keeps large templates affordable.
 */
function matchInWindow(
  gray: GrayImage, template: GrayImage, sx1: number, sy1: number, sx2: number, sy2: number, step = 1,
): { x: number; y: number; score: number } | null {
  const tw = template.width, th = template.height;
  if (sx2 - sx1 < tw || sy2 - sy1 < th) return null;
  let n = 0, tSum = 0, tSumSq = 0;
  for (let ty = 0; ty < th; ty += step) {
    for (let tx = 0; tx < tw; tx += step) {
      const v = template.data[ty * tw + tx];
      n++; tSum += v; tSumSq += v * v;
    }
  }
  const tMean = tSum / n;
  const tVar = tSumSq - tSum * tMean;
  if (tVar <= 0) return null;

  let best = { x: sx1, y: sy1, score: -Infinity };
  for (let y = sy1; y + th <= sy2; y++) {
    for (let x = sx1; x + tw <= sx2; x++) {
      let sum = 0, sumSq = 0, cross = 0;
      for (let ty = 0; ty < th; ty += step) {
        let g = (y + ty) * gray.width + x;
        let t = ty * tw;
        for (let tx = 0; tx < tw; tx += step, g += step, t += step) {
          const v = gray.data[g];
          sum += v;
          sumSq += v * v;
          cross += v * template.data[t];
        }
      }
      const variance = sumSq - (sum * sum) / n;
      if (variance <= 0) continue;
      const score = (cross - sum * tMean) / Math.sqrt(variance * tVar);
      if (score > best.score) best = { x, y, score };
    }
  }
  return best.score === -Infinity ? null : best;
}

/**
 * Best match of `template` inside the search window: top-left position and correlation score.
 */
export function matchTemplate(
  gray: GrayImage, template: GrayImage, sx1: number, sy1: number, sx2: number, sy2: number,
): { x: number; y: number; score: number } | null {
  const tw = template.width, th = template.height;
  if (sx2 - sx1 < tw || sy2 - sy1 < th) return null;
  const factor = Math.ceil(Math.max(tw, th) / COARSE_MAX_TEMPLATE_SIDE);
  if (factor <= 1) return matchInWindow(gray, template, sx1, sy1, sx2, sy2);

  const smallTemplate = shrinkRegion(template, 0, 0, tw, th, factor);
  const smallSearch = shrinkRegion(gray, sx1, sy1, sx2 - sx1, sy2 - sy1, factor);
  if (smallTemplate.width < 2 || smallTemplate.height < 2) return null;
  const coarse = matchInWindow(smallSearch, smallTemplate, 0, 0, smallSearch.width, smallSearch.height);
  if (!coarse) return null;

  // Full-resolution search around the coarse position, clamped to the original window.
  const cx = sx1 + coarse.x * factor, cy = sy1 + coarse.y * factor;
  const rx1 = Math.max(sx1, cx - factor), ry1 = Math.max(sy1, cy - factor);
  const rx2 = Math.min(sx2, cx + factor + tw + 1), ry2 = Math.min(sy2, cy + factor + th + 1);
  const step = Math.max(1, Math.ceil(Math.sqrt((tw * th) / REFINE_MAX_SAMPLES)));
  return matchInWindow(gray, template, rx1, ry1, rx2, ry2, step);
}

export class BoxTracker {
  private tracks: Track[] = [];

  constructor(private minHits = 1, private maxTtl = 48) {}

  private age(): void {
    this.tracks = this.tracks.filter((t) => t.ttl - 1 > 0);
    for (const t of this.tracks) t.ttl -= 1;
  }

  private confirmedRects(): Rect[] {
    return this.tracks.filter((t) => t.confirmed).map((t) => ({ ...t.rect }));
  }

  /** Feeds a fresh set of detections. Returns the boxes to blur for this frame. */
  update(detections: Rect[], gray: GrayImage | null): Rect[] {
    this.age();
    const used = new Set<number>();

    for (const t of this.tracks) {
      const [tw, th] = [t.rect.w, t.rect.h];
      const maxDist = Math.max(tw * 3.0, th * 4.5, 120.0);
      const predicted = { x: t.rect.x + t.velocity[0], y: t.rect.y + t.velocity[1], w: tw, h: th };
      let bestScore = 0, bestIdx = -1;
      detections.forEach((d, i) => {
        if (used.has(i)) return;
        const overlap = Math.max(iou(t.rect, d), iou(predicted, d));
        const dist = Math.min(centerDistance(t.rect, d), centerDistance(predicted, d));
        if (overlap >= 0.08 || (dist < maxDist && overlap > 0.01)) {
          const score = overlap + Math.max(0, 1 - dist / maxDist);
          if (score > bestScore) { bestScore = score; bestIdx = i; }
        }
      });

      if (bestIdx >= 0) {
        used.add(bestIdx);
        const d = detections[bestIdx];
        const dcx = d.x + d.w / 2, dcy = d.y + d.h / 2;
        const [cx, cy] = t.center;
        const shift = Math.hypot(dcx - cx, dcy - cy);
        // Small jitter is smoothed heavily; a real move is followed almost immediately.
        const a = shift < 4 ? 0.25 : shift < 20 ? 0.60 : 0.85;
        const gain = shift < 4 ? 0 : shift < 20 ? 0.6 : 1;
        t.center = [a * dcx + (1 - a) * cx, a * dcy + (1 - a) * cy];
        t.velocity = [
          0.65 * clampVelocity((dcx - cx) * gain) + 0.35 * t.velocity[0],
          0.65 * clampVelocity((dcy - cy) * gain) + 0.35 * t.velocity[1],
        ];
        t.size = [int(0.40 * d.w + 0.60 * t.size[0]), int(0.40 * d.h + 0.60 * t.size[1])];
        this.place(t);
        t.hits += 1;
        if (t.hits >= this.minHits) {
          t.confirmed = true;
          t.ttl = this.maxTtl;
        } else {
          t.ttl = 10;
        }
        if (gray) t.template = cutTemplate(gray, t.rect) || t.template;
      } else {
        this.coast(t, 0.80);
      }
    }

    detections.forEach((d, i) => {
      if (used.has(i)) return;
      this.tracks.push({
        rect: { ...d },
        center: [d.x + d.w / 2, d.y + d.h / 2],
        velocity: [0, 0],
        size: [d.w, d.h],
        hits: 1,
        ttl: 8,
        confirmed: this.minHits <= 1,
        template: gray ? cutTemplate(gray, d) : null,
      });
    });
    return this.confirmedRects();
  }

  /** Advances the tracks on a frame without detections. */
  trackInterframe(gray: GrayImage | null): Rect[] {
    if (this.tracks.length === 0) return [];
    this.age();
    if (!gray) return this.confirmedRects();

    for (const t of this.tracks) {
      if (!t.confirmed) continue;
      const template = t.template;
      let matched = false;
      if (template && template.width >= 8 && template.height >= 6) {
        const tw = template.width, th = template.height;
        const predX = t.center[0] + t.velocity[0], predY = t.center[1] + t.velocity[1];
        const padX = Math.max(25, int(tw * 0.6)), padY = Math.max(18, int(th * 0.8));
        const sx1 = Math.max(0, int(predX - tw / 2 - padX)), sy1 = Math.max(0, int(predY - th / 2 - padY));
        const sx2 = Math.min(gray.width, int(predX + tw / 2 + padX)), sy2 = Math.min(gray.height, int(predY + th / 2 + padY));
        const hit = matchTemplate(gray, template, sx1, sy1, sx2, sy2);
        if (hit && hit.score >= 0.50) {
          matched = true;
          const mcx = hit.x + tw / 2, mcy = hit.y + th / 2;
          t.velocity = [
            0.70 * clampVelocity(mcx - t.center[0]) + 0.30 * t.velocity[0],
            0.70 * clampVelocity(mcy - t.center[1]) + 0.30 * t.velocity[1],
          ];
          t.center = [mcx, mcy];
          this.place(t);
          const refreshed = cutTemplate(gray, { x: hit.x, y: hit.y, w: tw, h: th });
          if (refreshed && refreshed.width === tw && refreshed.height === th) t.template = refreshed;
        }
      }
      if (!matched) this.coast(t, 0.90);
    }
    return this.confirmedRects();
  }

  private place(t: Track): void {
    t.rect = { x: int(t.center[0] - t.size[0] / 2), y: int(t.center[1] - t.size[1] / 2), w: int(t.size[0]), h: int(t.size[1]) };
  }

  private coast(t: Track, damping: number): void {
    let [vx, vy] = t.velocity;
    if (Math.abs(vx) < 1 && Math.abs(vy) < 1) { vx = 0; vy = 0; }
    t.center = [t.center[0] + vx, t.center[1] + vy];
    t.velocity = [vx * damping, vy * damping];
    this.place(t);
  }

  reset(): void {
    this.tracks = [];
  }
}
