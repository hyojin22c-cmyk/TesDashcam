// Licence plate localisation, ported from the desktop application's PrivacyFilter
// (core/privacy_filter.py). A plate is accepted only inside a detected vehicle, or in the road
// band of the frame, and only when it passes the Korean plate profile or digit-row checks.
import {
  adaptiveThresholdInv, clipRect, closeRect, connectedComponents, countNonZero, cropGray, cropHsv,
  GrayImage, HsvImage, inRangeHsv, nonMaxSuppression, otsuThreshold, percentile, Rect, RgbaImage,
  sobel3, subGray, subHsv,
} from './imageOps';

const int = Math.trunc;

function orMasks(...masks: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(masks[0].length);
  for (const mask of masks) for (let i = 0; i < out.length; i++) if (mask[i]) out[i] = 1;
  return out;
}

function redRatio(hsv: HsvImage, total: number): number {
  const red = orMasks(inRangeHsv(hsv, [0, 35, 45], [14, 255, 255]), inRangeHsv(hsv, [165, 35, 45], [180, 255, 255]));
  return countNonZero(red) / total;
}

/** A plate is a flat rectangle: it has horizontal top/bottom edges and an even background. */
export function verifyPlateGeometry(gray: GrayImage): boolean {
  const { width: w, height: h, data } = gray;
  if (h < 8 || w < 24) return false;

  const sobelY = sobel3(gray, false);
  const meanAbsRows = (from: number, to: number) => {
    let sum = 0;
    for (let i = from * w; i < to * w; i++) sum += Math.abs(sobelY[i]);
    return sum / Math.max(1, (to - from) * w);
  };
  const topEdge = meanAbsRows(0, Math.max(2, int(h * 0.25)));
  const bottomEdge = meanAbsRows(Math.min(h - 1, int(h * 0.75)), h);
  if (topEdge + bottomEdge < 18.0) return false;

  const brightThreshold = percentile(data, 45);
  let n = 0, sum = 0, sumSq = 0;
  for (let i = 0; i < data.length; i++) {
    if (data[i] >= brightThreshold) { n++; sum += data[i]; sumSq += data[i] * data[i]; }
  }
  if (n > 0) {
    const mean = sum / n;
    if (Math.sqrt(Math.max(0, sumSq / n - mean * mean)) > 42.0) return false;
  }
  return true;
}

/** Looks for a row of three or more evenly sized, upright, stroke-like glyphs. */
export function verifyDigitSequence(gray: GrayImage): boolean {
  const { width: w, height: h, data } = gray;
  if (h < 8 || w < 24) return false;

  let min = 255, max = 0;
  for (let i = 0; i < data.length; i++) { if (data[i] < min) min = data[i]; if (data[i] > max) max = data[i]; }
  if (max - min < 38) return false;

  const binary = adaptiveThresholdInv(gray, h >= 16 ? 15 : 9, 6);
  const components = connectedComponents(binary, w, h);
  // OpenCV counts the background as a label, hence the +1.
  const labels = components.length + 1;
  if (labels < 4 || labels > 35) return false;

  const digits = components.filter((c) => {
    if (!(0.20 * h <= c.h && c.h <= 0.95 * h)) return false;
    const aspect = c.w / Math.max(1, c.h);
    if (!(0.15 <= aspect && aspect <= 0.90)) return false;
    const fill = c.area / Math.max(1, c.w * c.h);
    return 0.15 <= fill && fill <= 0.85;
  });
  if (digits.length < 3) return false;

  digits.sort((a, b) => a.x - b.x);
  for (let i = 0; i < digits.length; i++) {
    const first = digits[i];
    const row = [first];
    const firstCenterY = first.y + first.h / 2;
    for (let j = i + 1; j < digits.length; j++) {
      const next = digits[j];
      if (Math.abs(firstCenterY - (next.y + next.h / 2)) <= Math.max(3.0, first.h * 0.35)) {
        const last = row[row.length - 1];
        const gap = next.x - (last.x + last.w);
        if (gap >= 1 && gap <= Math.max(45, int(first.h * 2.5))) row.push(next);
      }
    }
    if (row.length < 3) continue;

    const heights = row.map((d) => d.h).sort((a, b) => a - b);
    let uniform = false;
    for (let k = 0; k + 2 < heights.length; k++) {
      const lo = heights[k], hi = heights[k + 2];
      if (hi <= lo * 1.45 || hi - lo <= 2) { uniform = true; break; }
    }
    if (!uniform) continue;

    const last = row[row.length - 1];
    if (last.x + last.w - row[0].x >= Math.max(14, int(w * 0.25))) return true;
  }
  return false;
}

/** Background colour, text contrast and digit-row check for the Korean plate formats. */
export function verifyKoreanPlateProfile(hsv: HsvImage, gray: GrayImage, aspect: number): boolean {
  const total = gray.width * gray.height;
  if (total <= 0) return false;
  if (!verifyPlateGeometry(gray)) return false;
  if (redRatio(hsv, total) >= 0.55) return false;
  if (!(1.45 <= aspect && aspect <= 6.8)) return false;

  const data = gray.data;
  const standardBackground = orMasks(
    inRangeHsv(hsv, [0, 0, 50], [180, 65, 255]),      // white
    inRangeHsv(hsv, [13, 35, 50], [42, 255, 255]),    // commercial yellow
    inRangeHsv(hsv, [88, 25, 75], [132, 255, 255]),   // EV blue
    inRangeHsv(hsv, [45, 35, 90], [85, 255, 255]),    // lime
  );
  if (countNonZero(standardBackground) / total >= 0.26) {
    const textThreshold = percentile(data, 85) - 16;
    let dark = 0, darkSum = 0, bg = 0, bgSum = 0;
    for (let i = 0; i < data.length; i++) {
      if (data[i] < textThreshold) { dark++; darkSum += data[i]; }
      if (standardBackground[i]) { bg++; bgSum += data[i]; }
    }
    const darkRatio = dark / total;
    if (darkRatio >= 0.03 && darkRatio <= 0.80 && bgSum / bg - darkSum / dark >= 8 && verifyDigitSequence(gray)) {
      return true;
    }
  }

  // Older green plates: dark green background with white characters, two-row proportions.
  if (aspect >= 1.30 && aspect <= 2.40) {
    const darkGreen = inRangeHsv(hsv, [48, 80, 30], [82, 255, 120]);
    if (countNonZero(darkGreen) / total >= 0.45) {
      const whiteThreshold = percentile(data, 20) + 20;
      let white = 0;
      for (let i = 0; i < data.length; i++) if (data[i] > whiteThreshold) white++;
      const whiteRatio = white / total;
      if (whiteRatio >= 0.04 && whiteRatio <= 0.50 && verifyDigitSequence(gray)) return true;
    }
  }
  return false;
}

/**
 * Candidate rectangles from character edge texture and from plate background colours.
 * The desktop filter additionally feeds MSER regions into this list; that source is not ported,
 * so plates seen at a steep angle or on a body of the same colour are found less often here.
 */
function findCandidates(gray: GrayImage, hsv: HsvImage, kw: number, kh: number): Rect[] {
  const { width: w, height: h } = gray;
  const gradX = sobel3(gray, true);
  const absX = new Uint8Array(gradX.length);
  for (let i = 0; i < gradX.length; i++) absX[i] = Math.min(255, Math.abs(gradX[i]));
  const threshold = otsuThreshold(absX);
  const edges = new Uint8Array(absX.length);
  for (let i = 0; i < absX.length; i++) if (absX[i] > threshold) edges[i] = 1;
  const candidates: Rect[] = connectedComponents(closeRect(edges, w, h, kw, kh), w, h);

  const colour = orMasks(
    inRangeHsv(hsv, [0, 0, 70], [180, 50, 255]),
    inRangeHsv(hsv, [13, 30, 70], [38, 255, 255]),
    inRangeHsv(hsv, [85, 20, 70], [130, 255, 255]),
  );
  candidates.push(...connectedComponents(closeRect(colour, w, h, kw, kh + 2), w, h));
  return candidates;
}

function padPlate(rect: Rect, padXRatio: number, padYRatio: number, minPad: number, width: number, height: number): Rect {
  const padX = Math.max(minPad, int(rect.w * padXRatio));
  const padY = Math.max(minPad, int(rect.h * padYRatio));
  const x = Math.max(0, rect.x - padX);
  const y = Math.max(0, rect.y - padY);
  return { x, y, w: Math.min(width - x, rect.w + padX * 2), h: Math.min(height - y, rect.h + padY * 2) };
}

function platesInVehicle(frame: RgbaImage, vehicle: Rect): Rect | null {
  const { width: ow, height: oh } = frame;
  const { x: vx, y: vy, w: vw, h: vh } = vehicle;
  // A car seen from the side shows no plate: skip partial cars at the frame edge and long profiles.
  if ((vx <= 8 && vw < 280) || (vx + vw >= ow - 8 && vw < 280)) return null;
  if (vw / vh > 2.2) return null;

  // Search the centre 60% (no tail lamps) from the boot lid down to the bumper.
  const roi = clipRect({
    x: vx + int(vw * 0.20), y: vy + int(vh * 0.28),
    w: int(vw * 0.80) - int(vw * 0.20), h: int(vh * 0.96) - int(vh * 0.28),
  }, ow, oh);
  if (!roi || roi.w < 18 || roi.h < 8) return null;

  const roiGray = cropGray(frame, roi);
  const roiHsv = cropHsv(frame, roi);
  const kw = Math.max(7, Math.min(23, int(vw * 0.06) | 1));
  const kh = Math.max(3, Math.min(7, int(vh * 0.02) | 1));
  const carCenterX = vx + vw / 2;

  let best: Rect | null = null;
  let bestScore = -1;
  for (const cand of findCandidates(roiGray, roiHsv, kw, kh)) {
    if (cand.w < 14 || cand.h < 4) continue;
    const gx = roi.x + cand.x;
    let gy = roi.y + cand.y;
    const offsetX = Math.abs(gx + cand.w / 2 - carCenterX) / vw;
    if (offsetX > 0.14) continue;
    const widthRatio = cand.w / vw;
    if (!(widthRatio >= 0.15 && widthRatio <= 0.33)) continue;

    const pw = cand.w;
    let ph = cand.h;
    let aspect = pw / ph;
    // Only a text line or margin was found: extend to the plate's 3.8:1 proportions.
    if (aspect > 5.2) {
      ph = int(pw / 3.8);
      gy = Math.max(0, gy - int(ph * 0.4));
      aspect = pw / ph;
    }
    if (!(aspect >= 1.8 && aspect <= 5.8)) continue;

    const patchRect = clipRect({ x: gx, y: gy, w: pw, h: ph }, ow, oh);
    if (!patchRect) continue;
    const patchGray = cropGray(frame, patchRect);
    const patchHsv = cropHsv(frame, patchRect);
    const isProfile = verifyKoreanPlateProfile(patchHsv, patchGray, aspect);
    const isDigits = verifyDigitSequence(patchGray);
    if (!isProfile && !isDigits) continue;
    if (redRatio(patchHsv, pw * ph) > 0.40) continue;

    const score = pw * ph * (1.0 - offsetX * 2.5) * (isProfile && isDigits ? 2.5 : 1.0);
    if (score > bestScore) {
      bestScore = score;
      best = { x: gx, y: gy, w: pw, h: ph };
    }
  }
  return best ? padPlate(best, 0.03, 0.08, 1, ow, oh) : null;
}

/** Used when no vehicle yields a plate: scan the road band of the frame for plate-like regions. */
function platesInRoadBand(frame: RgbaImage): Rect[] {
  const { width: ow, height: oh } = frame;
  const top = int(oh * 0.365);
  const band = clipRect({ x: 0, y: top, w: ow, h: int(oh * 0.90) - top }, ow, oh);
  if (!band) return [];
  const gray = cropGray(frame, band);
  const hsv = cropHsv(frame, band);

  const minW = Math.max(20, int(ow * 0.015)), maxW = Math.max(220, int(ow * 0.20));
  const minH = Math.max(6, int(oh * 0.007)), maxH = Math.max(65, int(oh * 0.075));
  const frameArea = ow * oh;

  const passed: Rect[] = [];
  for (const cand of findCandidates(gray, hsv, 13, 3)) {
    if (cand.w < minW || cand.w > maxW || cand.h < minH || cand.h > maxH) continue;
    const aspect = cand.w / cand.h;
    if (!(aspect >= 1.45 && aspect <= 6.8)) continue;
    if (cand.w * cand.h > frameArea * 0.040) continue;
    if (!verifyKoreanPlateProfile(subHsv(hsv, cand), subGray(gray, cand), aspect)) continue;
    passed.push(padPlate({ x: cand.x, y: cand.y + top, w: cand.w, h: cand.h }, 0.06, 0.10, 2, ow, oh));
  }
  if (passed.length === 0) return [];

  const kept = nonMaxSuppression(passed, passed.map(() => 1), 0.5, 0.3).map((i) => passed[i]);
  // Drop a box that merely surrounds a clearly smaller accepted box.
  return kept.filter((a, i) => !kept.some((b, j) =>
    i !== j && a.w * a.h > b.w * b.h * 1.5 &&
    a.x <= b.x && a.y <= b.y && a.x + a.w >= b.x + b.w && a.y + a.h >= b.y + b.h));
}

/**
 * Finds licence plates in a frame. `vehicles` are vehicle boxes in the same pixel coordinates.
 * Returns padded plate rectangles; never invents a plate for a vehicle without a verified one.
 */
export function detectPlates(frame: RgbaImage, vehicles: Rect[]): Rect[] {
  const plates: Rect[] = [];
  for (const vehicle of vehicles) {
    const plate = platesInVehicle(frame, vehicle);
    if (plate) plates.push(plate);
  }
  if (plates.length > 0) {
    return nonMaxSuppression(plates, plates.map(() => 1), 0.5, 0.3).map((i) => plates[i]);
  }
  return platesInRoadBand(frame);
}
