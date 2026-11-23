// Runs the privacy detectors on camera frames in the browser and reports what to mosaic.
// Everything happens on the device: the models are loaded from this site and run in WebAssembly.
import type { CameraKey } from '../constants';
import { BoxTracker } from './boxTracker';
import { decodeFaces, decodeVehicles, FACE_INPUT_SIZE, FaceOutputs, toPlanarFloat, VEHICLE_INPUT_SIZE } from './detectors';
import { cropGray, GrayImage, Rect, RgbaImage } from './imageOps';
import { detectPlates } from './plateDetector';

export interface PrivacySettings {
  blurPlate: boolean;
  blurFace: boolean;
}

/** A rectangle in fractions (0..1) of the camera frame it belongs to. */
export interface NormalizedRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type PrivacyBoxes = Partial<Record<CameraKey, NormalizedRect[]>>;

/** What the exporter needs from a privacy filter. */
export interface FramePrivacyFilter {
  analyze(frames: Partial<Record<CameraKey, CanvasImageSource | null>>): Promise<PrivacyBoxes>;
  reset(): void;
}

// The plate heuristics use pixel thresholds tuned on 1280-wide dashcam frames.
const ANALYSIS_MAX_WIDTH = 1280;
// Run the detectors on every Nth analysed frame and follow the boxes in between.
const DEFAULT_DETECT_INTERVAL = 4;
const DEFAULT_TRACK_TTL = 48;

type OrtModule = typeof import('onnxruntime-web/wasm');
type Session = import('onnxruntime-web/wasm').InferenceSession;

interface Models {
  ort: OrtModule;
  vehicles: Session | null;
  faces: Session | null;
}

let ortPromise: Promise<OrtModule> | null = null;
const sessionPromises = new Map<string, Promise<Session>>();

function assetUrl(path: string): string {
  return new URL(path, new URL(import.meta.env.BASE_URL, window.location.href)).href;
}

function loadOrt(): Promise<OrtModule> {
  if (!ortPromise) {
    ortPromise = import('onnxruntime-web/wasm').then((ort) => {
      // GitHub Pages cannot send the headers that multi-threaded WebAssembly requires.
      ort.env.wasm.numThreads = 1;
      ort.env.wasm.wasmPaths = assetUrl('ort/');
      return ort;
    });
    ortPromise.catch(() => { ortPromise = null; });
  }
  return ortPromise;
}

function loadSession(ort: OrtModule, file: string): Promise<Session> {
  let promise = sessionPromises.get(file);
  if (!promise) {
    promise = fetch(assetUrl(`models/${file}`))
      .then((response) => {
        if (!response.ok) throw new Error(`${file}: HTTP ${response.status}`);
        return response.arrayBuffer();
      })
      .then((bytes) => ort.InferenceSession.create(bytes, { executionProviders: ['wasm'] }));
    sessionPromises.set(file, promise);
    promise.catch(() => sessionPromises.delete(file));
  }
  return promise;
}

async function loadModels(settings: PrivacySettings): Promise<Models> {
  const ort = await loadOrt();
  const [vehicles, faces] = await Promise.all([
    settings.blurPlate ? loadSession(ort, 'yolov8n.onnx') : null,
    settings.blurFace ? loadSession(ort, 'face_detection_yunet.onnx') : null,
  ]);
  return { ort, vehicles, faces };
}

function sourceSize(source: CanvasImageSource): { width: number; height: number } {
  const s = source as any;
  return {
    width: s.videoWidth || s.displayWidth || s.naturalWidth || s.width || 0,
    height: s.videoHeight || s.displayHeight || s.naturalHeight || s.height || 0,
  };
}

function makeCanvas(width: number, height: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('2D canvas is unavailable');
  return { canvas, ctx };
}

class CameraFilter {
  private frameCount = 0;
  private plateTracker: BoxTracker;
  private faceTracker: BoxTracker;

  constructor(trackTtl: number) {
    this.plateTracker = new BoxTracker(1, trackTtl);
    this.faceTracker = new BoxTracker(1, trackTtl);
  }

  reset(): void {
    this.frameCount = 0;
    this.plateTracker.reset();
    this.faceTracker.reset();
  }

  async analyze(
    frame: RgbaImage, gray: GrayImage, settings: PrivacySettings, detectInterval: number,
    detectVehicles: () => Promise<Rect[]>, detectFaces: () => Promise<Rect[]>,
  ): Promise<Rect[]> {
    this.frameCount += 1;
    const shouldDetect = detectInterval <= 1 || this.frameCount % detectInterval === 1;
    const boxes: Rect[] = [];
    if (settings.blurFace) {
      boxes.push(...(shouldDetect ? this.faceTracker.update(await detectFaces(), gray) : this.faceTracker.trackInterframe(gray)));
    }
    if (settings.blurPlate) {
      boxes.push(...(shouldDetect
        ? this.plateTracker.update(detectPlates(frame, await detectVehicles()), gray)
        : this.plateTracker.trackInterframe(gray)));
    }
    return boxes;
  }
}

export class PrivacyEngine implements FramePrivacyFilter {
  private models: Promise<Models> | null = null;
  private cameras = new Map<CameraKey, CameraFilter>();
  private analysis: ReturnType<typeof makeCanvas> | null = null;
  private vehicleInput: ReturnType<typeof makeCanvas> | null = null;
  private faceInput: ReturnType<typeof makeCanvas> | null = null;
  /** Time spent analysing, for diagnostics and tests. */
  readonly stats = { frames: 0, totalMs: 0 };

  /**
   * @param detectInterval run the detectors on every Nth analysed frame
   * @param trackTtl analysed frames a box is kept after its last detection (errs towards covering)
   */
  constructor(
    readonly settings: PrivacySettings,
    private detectInterval = DEFAULT_DETECT_INTERVAL,
    private trackTtl = DEFAULT_TRACK_TTL,
  ) {}

  get enabled(): boolean {
    return this.settings.blurPlate || this.settings.blurFace;
  }

  /** Downloads and initialises the models. Rejects if they cannot be used on this device. */
  async prepare(): Promise<void> {
    if (!this.enabled) return;
    if (!this.models) {
      this.models = loadModels(this.settings);
      this.models.catch(() => { this.models = null; });
    }
    await this.models;
  }

  reset(): void {
    for (const camera of this.cameras.values()) camera.reset();
  }

  /** Returns the regions to mosaic for each camera frame. Throws rather than return a partial answer. */
  async analyze(frames: Partial<Record<CameraKey, CanvasImageSource | null>>): Promise<PrivacyBoxes> {
    const result: PrivacyBoxes = {};
    if (!this.enabled) return result;
    await this.prepare();
    const models = await this.models!;

    const started = performance.now();
    for (const key of Object.keys(frames) as CameraKey[]) {
      const source = frames[key];
      if (!source) continue;
      const { width: sw, height: sh } = sourceSize(source);
      if (sw <= 0 || sh <= 0) continue;

      const width = Math.min(sw, ANALYSIS_MAX_WIDTH);
      const height = Math.max(1, Math.round((sh * width) / sw));
      if (!this.analysis) this.analysis = makeCanvas(width, height);
      const { canvas, ctx } = this.analysis;
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
      ctx.drawImage(source, 0, 0, width, height);
      const frame: RgbaImage = ctx.getImageData(0, 0, width, height);
      const gray = cropGray(frame, { x: 0, y: 0, w: width, h: height });

      let camera = this.cameras.get(key);
      if (!camera) { camera = new CameraFilter(this.trackTtl); this.cameras.set(key, camera); }
      const boxes = await camera.analyze(
        frame, gray, this.settings, this.detectInterval,
        () => this.runVehicles(models, canvas, width, height),
        () => this.runFaces(models, canvas, width, height),
      );
      result[key] = boxes.map((b) => ({ x: b.x / width, y: b.y / height, w: b.w / width, h: b.h / height }));
    }
    this.stats.frames += 1;
    this.stats.totalMs += performance.now() - started;
    return result;
  }

  private async runVehicles(models: Models, frame: HTMLCanvasElement, width: number, height: number): Promise<Rect[]> {
    if (!models.vehicles) return [];
    if (!this.vehicleInput) this.vehicleInput = makeCanvas(VEHICLE_INPUT_SIZE, VEHICLE_INPUT_SIZE);
    const { ctx } = this.vehicleInput;
    // The frame is stretched to the square input, as in the desktop filter.
    ctx.drawImage(frame, 0, 0, VEHICLE_INPUT_SIZE, VEHICLE_INPUT_SIZE);
    const pixels = ctx.getImageData(0, 0, VEHICLE_INPUT_SIZE, VEHICLE_INPUT_SIZE).data;
    const input = new models.ort.Tensor('float32', toPlanarFloat(pixels, VEHICLE_INPUT_SIZE, 1 / 255, false), [1, 3, VEHICLE_INPUT_SIZE, VEHICLE_INPUT_SIZE]);
    const session = models.vehicles;
    const output = (await session.run({ [session.inputNames[0]]: input }))[session.outputNames[0]];
    return decodeVehicles(output.data as Float32Array, output.dims[2], width, height);
  }

  private async runFaces(models: Models, frame: HTMLCanvasElement, width: number, height: number): Promise<Rect[]> {
    if (!models.faces) return [];
    if (!this.faceInput) this.faceInput = makeCanvas(FACE_INPUT_SIZE, FACE_INPUT_SIZE);
    const { ctx } = this.faceInput;
    const scale = Math.min(FACE_INPUT_SIZE / width, FACE_INPUT_SIZE / height);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, FACE_INPUT_SIZE, FACE_INPUT_SIZE);
    ctx.drawImage(frame, 0, 0, Math.round(width * scale), Math.round(height * scale));
    const pixels = ctx.getImageData(0, 0, FACE_INPUT_SIZE, FACE_INPUT_SIZE).data;
    const input = new models.ort.Tensor('float32', toPlanarFloat(pixels, FACE_INPUT_SIZE, 1, true), [1, 3, FACE_INPUT_SIZE, FACE_INPUT_SIZE]);
    const session = models.faces;
    const outputs = await session.run({ [session.inputNames[0]]: input });
    return decodeFaces(outputs as unknown as FaceOutputs, scale, width, height);
  }
}
