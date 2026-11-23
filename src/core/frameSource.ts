// Frame-accurate export source: demuxes a clip's H.264 track and decodes it with WebCodecs,
// so the exporter does not have to seek an HTML video element once per output frame.
import { BlobFileHandle, RealTeslaSEIDecoder } from './seiDecoder';
import { parseVideoSampleTimes } from './sampleTiming';

export interface VideoSample {
  offset: number;
  size: number;
  /** Presentation time in the clip's own timeline, in microseconds. */
  ptsMicros: number;
  isKey: boolean;
}

export interface VideoTrackInfo {
  codec: string;
  codedWidth: number;
  codedHeight: number;
  description: Uint8Array;
  /** Samples in decode order. */
  samples: VideoSample[];
  durationSec: number;
}

type Box = { type: string; start: number; end: number };

function listBoxes(data: Uint8Array, view: DataView, start: number, end: number): Box[] {
  const result: Box[] = [];
  for (let p = start; p + 8 <= end;) {
    let size = view.getUint32(p);
    let header = 8;
    if (size === 1) {
      if (p + 16 > end) break;
      size = Number(view.getBigUint64(p + 8));
      header = 16;
    }
    if (size === 0) size = end - p;
    if (!Number.isSafeInteger(size) || size < header || p + size > end) throw new Error('Invalid MP4 box');
    result.push({ type: String.fromCharCode(...data.subarray(p + 4, p + 8)), start: p + header, end: p + size });
    p += size;
  }
  return result;
}

const hex2 = (n: number) => n.toString(16).padStart(2, '0');

/**
 * Parses the payload of a `moov` box into a decodable description of its video track.
 * Only AVC (avc1/avc3) is handled; anything else throws so the caller can use another path.
 */
export function parseVideoTrack(moov: Uint8Array): VideoTrackInfo {
  const view = new DataView(moov.buffer, moov.byteOffset, moov.byteLength);
  const child = (box: Box, type: string) => listBoxes(moov, view, box.start, box.end).find((b) => b.type === type);
  const need = (box: Box | undefined, name: string): Box => {
    if (!box) throw new Error(`Missing ${name} box`);
    return box;
  };

  const track = listBoxes(moov, view, 0, moov.length).find((box) => {
    if (box.type !== 'trak') return false;
    const media = child(box, 'mdia');
    const handler = media && child(media, 'hdlr');
    return Boolean(handler) && String.fromCharCode(...moov.subarray(handler!.start + 8, handler!.start + 12)) === 'vide';
  });
  const media = need(child(need(track, 'video trak'), 'mdia'), 'mdia');
  const table = need(child(need(child(media, 'minf'), 'minf'), 'stbl'), 'stbl');

  // Sample entry: 8 bytes of stsd header, then the first entry box.
  const stsd = need(child(table, 'stsd'), 'stsd');
  const entry = listBoxes(moov, view, stsd.start + 8, stsd.end)[0];
  if (!entry || (entry.type !== 'avc1' && entry.type !== 'avc3')) {
    throw new Error(`Unsupported video codec: ${entry ? entry.type : 'none'}`);
  }
  const codedWidth = view.getUint16(entry.start + 24);
  const codedHeight = view.getUint16(entry.start + 26);
  // A VisualSampleEntry has 78 bytes of fixed fields before its child boxes.
  const avcC = listBoxes(moov, view, entry.start + 78, entry.end).find((b) => b.type === 'avcC');
  if (!avcC || avcC.end - avcC.start < 7) throw new Error('Missing avcC box');
  const description = moov.slice(avcC.start, avcC.end);
  const codec = `avc1.${hex2(description[1])}${hex2(description[2])}${hex2(description[3])}`;

  const stsz = need(child(table, 'stsz'), 'stsz');
  const uniformSize = view.getUint32(stsz.start + 4);
  const sampleCount = view.getUint32(stsz.start + 8);
  if (sampleCount <= 0 || sampleCount > 500000) throw new Error('Invalid sample count');
  if (!uniformSize && stsz.start + 12 + sampleCount * 4 > stsz.end) throw new Error('Truncated stsz box');

  const chunkOffsets: number[] = [];
  const stco = child(table, 'stco');
  if (stco) {
    const n = view.getUint32(stco.start + 4);
    for (let i = 0; i < n; i++) chunkOffsets.push(view.getUint32(stco.start + 8 + i * 4));
  } else {
    const co64 = need(child(table, 'co64'), 'stco/co64');
    const n = view.getUint32(co64.start + 4);
    for (let i = 0; i < n; i++) chunkOffsets.push(Number(view.getBigUint64(co64.start + 8 + i * 8)));
  }

  const stsc = need(child(table, 'stsc'), 'stsc');
  const stscCount = view.getUint32(stsc.start + 4);
  const runs: { firstChunk: number; samplesPerChunk: number }[] = [];
  for (let i = 0; i < stscCount; i++) {
    runs.push({
      firstChunk: view.getUint32(stsc.start + 8 + i * 12),
      samplesPerChunk: view.getUint32(stsc.start + 12 + i * 12),
    });
  }
  if (runs.length === 0) throw new Error('Empty stsc box');

  const times = parseVideoSampleTimes(moov);
  if (!times || times.length !== sampleCount) throw new Error('Unreadable sample timing');

  let keySet: Set<number> | null = null;
  const stss = child(table, 'stss');
  if (stss) {
    keySet = new Set<number>();
    const n = view.getUint32(stss.start + 4);
    for (let i = 0; i < n; i++) keySet.add(view.getUint32(stss.start + 8 + i * 4) - 1);
  }

  const samples: VideoSample[] = [];
  let runIdx = 0;
  let sampleIdx = 0;
  for (let chunk = 0; chunk < chunkOffsets.length && sampleIdx < sampleCount; chunk++) {
    while (runIdx + 1 < runs.length && chunk + 1 >= runs[runIdx + 1].firstChunk) runIdx++;
    let offset = chunkOffsets[chunk];
    for (let i = 0; i < runs[runIdx].samplesPerChunk && sampleIdx < sampleCount; i++) {
      const size = uniformSize || view.getUint32(stsz.start + 12 + sampleIdx * 4);
      samples.push({
        offset,
        size,
        ptsMicros: Math.round(times[sampleIdx] * 1_000_000),
        isKey: keySet ? keySet.has(sampleIdx) : true,
      });
      offset += size;
      sampleIdx++;
    }
  }
  if (samples.length !== sampleCount) throw new Error('Sample table does not cover every sample');
  if (!samples[0].isKey) throw new Error('Track does not start with a key frame');

  // Track duration = end of the last presented sample.
  let lastPts = 0;
  let prevPts = 0;
  for (const s of samples) {
    if (s.ptsMicros > lastPts) { prevPts = lastPts; lastPts = s.ptsMicros; }
  }
  const lastDelta = samples.length > 1 ? Math.max(1, lastPts - prevPts) : 33_333;
  return { codec, codedWidth, codedHeight, description, samples, durationSec: (lastPts + lastDelta) / 1_000_000 };
}

/** Decode-order index of the key frame to start from so that `timeMicros` can be presented. */
export function findStartSample(samples: VideoSample[], timeMicros: number): number {
  let start = 0;
  for (let i = 0; i < samples.length; i++) {
    if (samples[i].isKey && samples[i].ptsMicros <= timeMicros) start = i;
  }
  return start;
}

const READ_AHEAD_BYTES = 4 * 1024 * 1024;
const MAX_PENDING_DECODES = 8;
const MAX_READY_FRAMES = 6;
const STALL_TIMEOUT_MS = 6000;
// Same boundary tolerance the seek-based exporter uses when it compares currentTime.
const TIME_EPSILON_MICROS = 2000;

/**
 * Presents the frames of one clip file in forward order. `frameAt` must be called with
 * non-decreasing times; the returned frame stays owned by this reader.
 */
export class DecodedFrameReader {
  readonly durationSec: number;
  readonly width: number;
  readonly height: number;

  private decoder: VideoDecoder | null = null;
  private ready: VideoFrame[] = [];
  private current: VideoFrame | null = null;
  private feedIdx = 0;
  private started = false;
  private flushed = false;
  private flushing = false;
  private error: Error | null = null;
  private wake: (() => void) | null = null;
  private buffer: Uint8Array | null = null;
  private bufferStart = 0;

  private constructor(private file: Blob, private track: VideoTrackInfo) {
    this.durationSec = track.durationSec;
    this.width = track.codedWidth;
    this.height = track.codedHeight;
  }

  static isSupported(): boolean {
    return typeof VideoDecoder !== 'undefined' && typeof EncodedVideoChunk !== 'undefined';
  }

  static async open(file: Blob): Promise<DecodedFrameReader> {
    if (!DecodedFrameReader.isSupported()) throw new Error('WebCodecs VideoDecoder is unavailable');
    const moov = await RealTeslaSEIDecoder.findAtom(new BlobFileHandle(file), 'moov');
    if (!moov || moov.size <= 0 || moov.size > 64 * 1024 * 1024) throw new Error('moov box not found');
    const moovBytes = new Uint8Array(await file.slice(moov.offset, moov.offset + moov.size).arrayBuffer());
    const track = parseVideoTrack(moovBytes);
    const config: VideoDecoderConfig = {
      codec: track.codec,
      codedWidth: track.codedWidth,
      codedHeight: track.codedHeight,
      description: track.description,
      optimizeForLatency: true,
    };
    const support = await VideoDecoder.isConfigSupported(config);
    if (!support.supported) throw new Error(`Decoder does not support ${track.codec}`);

    const reader = new DecodedFrameReader(file, track);
    reader.decoder = new VideoDecoder({
      output: (frame) => {
        reader.ready.push(frame);
        reader.notify();
      },
      error: (e) => {
        reader.error = e instanceof Error ? e : new Error(String(e));
        reader.notify();
      },
    });
    reader.decoder.addEventListener('dequeue', () => reader.notify());
    reader.decoder.configure(config);
    return reader;
  }

  private notify(): void {
    const wake = this.wake;
    this.wake = null;
    if (wake) wake();
  }

  private waitForProgress(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.wake = null;
        reject(new Error('Video decoder stalled'));
      }, STALL_TIMEOUT_MS);
      this.wake = () => {
        clearTimeout(timer);
        resolve();
      };
    });
  }

  private async readSample(sample: VideoSample): Promise<Uint8Array> {
    const end = sample.offset + sample.size;
    if (!this.buffer || sample.offset < this.bufferStart || end > this.bufferStart + this.buffer.length) {
      const length = Math.max(sample.size, READ_AHEAD_BYTES);
      this.buffer = new Uint8Array(await this.file.slice(sample.offset, sample.offset + length).arrayBuffer());
      this.bufferStart = sample.offset;
      if (this.buffer.length < sample.size) throw new Error('Clip file ended inside a video sample');
    }
    const from = sample.offset - this.bufferStart;
    return this.buffer.subarray(from, from + sample.size);
  }

  /** Returns the frame an HTML video element would show at `timeSec`. */
  async frameAt(timeSec: number): Promise<VideoFrame | null> {
    const decoder = this.decoder;
    if (!decoder) throw new Error('Frame reader is closed');
    const samples = this.track.samples;
    const targetMicros = Math.round(timeSec * 1_000_000) + TIME_EPSILON_MICROS;

    if (!this.started) {
      this.started = true;
      this.feedIdx = findStartSample(samples, targetMicros);
    }

    for (;;) {
      if (this.error) throw this.error;

      while (this.ready.length > 0 && this.ready[0].timestamp <= targetMicros) {
        if (this.current) this.current.close();
        this.current = this.ready.shift()!;
      }
      // A later frame is already waiting, so `current` is the one on screen at this time.
      if (this.ready.length > 0 && this.current) return this.current;
      // Asked for a time before the first presented frame: show that first frame.
      if (this.ready.length > 0 && !this.current) return this.ready[0];
      if (this.flushed) return this.current;

      if (this.feedIdx < samples.length) {
        if (decoder.decodeQueueSize < MAX_PENDING_DECODES && this.ready.length < MAX_READY_FRAMES) {
          const sample = samples[this.feedIdx++];
          const data = await this.readSample(sample);
          if (this.error) throw this.error;
          decoder.decode(new EncodedVideoChunk({
            type: sample.isKey ? 'key' : 'delta',
            timestamp: sample.ptsMicros,
            data,
          }));
          continue;
        }
      } else if (!this.flushing) {
        this.flushing = true;
        decoder.flush().then(
          () => { this.flushed = true; this.notify(); },
          (e) => { this.error = e instanceof Error ? e : new Error(String(e)); this.notify(); },
        );
      }
      await this.waitForProgress();
    }
  }

  close(): void {
    for (const frame of this.ready) frame.close();
    this.ready = [];
    if (this.current) this.current.close();
    this.current = null;
    this.buffer = null;
    const decoder = this.decoder;
    this.decoder = null;
    if (decoder && decoder.state !== 'closed') {
      try { decoder.close(); } catch { /* already closed */ }
    }
    this.notify();
  }
}
