// Ported & adapted from core/exporter.py (ExportWorker) using Mediabunny
import { compact, sumBy } from 'es-toolkit';
import {
  MP4,
  BlobSource,
  BufferTarget,
  CanvasSink,
  CanvasSource,
  canEncodeVideo,
  Input,
  Mp4OutputFormat,
  Output,
  Quality,
  type VideoEncodingConfig,
} from 'mediabunny';

import { i18n } from '@/i18n';
import { isAndroid, isIOSOrAndroid } from '@/lib/platform';

import { type ClipItem, ensureClipFiles } from './clip-scanner';
import { clampSegmentToMedia } from './clip-timing';
import { RESOLUTIONS, type CameraKey } from './constants';
import { OverlayRenderer, type RenderOptions } from './renderer';
import { DEFAULT_TELEMETRY, type RealTeslaSEIDecoder } from './sei-decoder';

export interface ExportClipSegment {
  clip: ClipItem;
  startSec: number;
  endSec: number;
  baseTimeStr: string;
}

export interface MultiClipExportConfig {
  segments: ExportClipSegment[];
  getClipDecoder: (clip: ClipItem) => Promise<RealTeslaSEIDecoder | null>;
  sourceFps: number;
  targetFps: number;
  exportSpeed: number;
  resolutionName: keyof typeof RESOLUTIONS;
  options: RenderOptions;
  onProgress: (percent: number, currentSegmentIdx: number, totalSegments: number) => void;
}

const pickEncodingConfig = async (
  width: number,
  height: number,
  frameRate: number,
  bitrate: number,
  android: boolean,
): Promise<VideoEncodingConfig> => {
  const quality = new Quality({ bitrate, bitrateMode: 'variable' });
  const base: VideoEncodingConfig = { codec: 'avc', quality, keyFrameInterval: 4 };
  // Samsung MediaCodec emits B-frames on High profile, which makes Samsung Gallery stutter;
  // Constrained Baseline in realtime mode avoids them.
  const profile = android
    ? {
        latencyMode: 'realtime' as const,
        fullCodecString:
          width >= 2560 ? 'avc1.42E032' : width >= 1920 ? 'avc1.42E029' : 'avc1.42E01f',
      }
    : { fullCodecString: width >= 2560 ? 'avc1.640032' : 'avc1.640028' };
  const supported = await canEncodeVideo('avc', { width, height, frameRate, quality, ...profile });
  return supported ? { ...base, ...profile } : base;
};

export class WebCodecsExporter {
  private isCancelled = false;

  private getActiveCamKeys(options: RenderOptions): CameraKey[] {
    if (options.layout === 'single') {
      return [options.single_cam || 'front'];
    }
    const keys: CameraKey[] = ['front', 'back', 'left_repeater', 'right_repeater'];
    if (options.pillar_pip) {
      keys.push('left_pillar', 'right_pillar');
    }
    return keys;
  }

  cancel(): void {
    this.isCancelled = true;
  }

  async exportMultiClip(config: MultiClipExportConfig): Promise<Blob> {
    this.isCancelled = false;

    const android = isAndroid();
    const isMobile =
      isIOSOrAndroid() ||
      window.matchMedia(
        '(max-width: 850px), (pointer: coarse), ((orientation: landscape) and (max-height: 600px))',
      ).matches;

    const resConfig = RESOLUTIONS[config.resolutionName];
    const [targetW, targetH] = resConfig.size;

    // Bitrate selection: matched to Python libx264 CRF 21~26 real-world compression ratios with FPS ratio scaling
    const baseBitrate = resConfig.bitrate_mbps;
    const fpsRatio = Math.pow(Math.max(1, config.targetFps) / 30.0, 0.45);
    const scaledBitrate = baseBitrate * fpsRatio;
    const effectiveBitrateMbps = isMobile
      ? Math.min(scaledBitrate, targetW >= 2560 ? 16.0 : targetW >= 1920 ? 10.0 : 5.5)
      : scaledBitrate;
    const bitrateBps = Math.round(effectiveBitrateMbps * 1_000_000);

    // Render canvas setup
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = targetW;
    exportCanvas.height = targetH;

    const output = new Output({
      format: new Mp4OutputFormat({ fastStart: 'in-memory' }),
      target: new BufferTarget(),
    });
    const source = new CanvasSource(
      exportCanvas,
      await pickEncodingConfig(targetW, targetH, config.targetFps, bitrateBps, android),
    );
    output.addVideoTrack(source, { frameRate: config.targetFps });

    try {
      if (config.options.steering) await OverlayRenderer.prepareSteeringImage();
      await output.start();
      config.onProgress(0, 1, config.segments.length);

      const frameStepSec = (1.0 / config.targetFps) * config.exportSpeed;
      let totalSourceSec = sumBy(config.segments, (seg) =>
        Math.max(0.01, seg.endSec - seg.startSec),
      );
      let totalFrames = Math.max(1, Math.ceil(totalSourceSec / frameStepSec));

      let outputFrameCount = 0;

      for (let segIdx = 0; segIdx < config.segments.length; segIdx++) {
        if (this.isCancelled) break;
        let segment = config.segments[segIdx];

        await ensureClipFiles(segment.clip);
        const inputs: Input[] = [];
        try {
          const opened = await Promise.all(
            this.getActiveCamKeys(config.options).map(async (key) => {
              const file = segment.clip.cams[key];
              if (!file) return null;
              const input = new Input({ source: new BlobSource(file), formats: [MP4] });
              inputs.push(input);
              try {
                const track = await input.getPrimaryVideoTrack();
                return track ? { key, track } : null;
              } catch (error) {
                console.warn(`[Export] Skipping unreadable ${key} camera:`, error);
                return null;
              }
            }),
          );
          const tracks = compact(opened);

          // A SavedClip may end after only a few seconds. Never encode the scanner's
          // 60-second estimate after the master video has already ended.
          const master = tracks.find(({ key }) => key === 'front') ?? tracks[0];
          const actualSegment = clampSegmentToMedia(
            segment,
            master ? await master.track.computeDuration() : NaN,
          );
          totalSourceSec +=
            actualSegment.endSec - actualSegment.startSec - (segment.endSec - segment.startSec);
          totalFrames = Math.max(1, Math.ceil(totalSourceSec / frameStepSec));
          segment = actualSegment;

          const decoder = await config.getClipDecoder(segment.clip);
          const { startSec, endSec } = segment;
          const sourceTimes = Array.from(
            { length: Math.ceil((endSec - startSec - 1e-9) / frameStepSec) },
            (_, i) => startSec + i * frameStepSec,
          );
          const streams = tracks.map(({ key, track }) => ({
            key,
            canvases: new CanvasSink(track, { poolSize: 1 }).canvasesAtTimestamps(sourceTimes),
          }));

          for (const sourceSec of sourceTimes) {
            if (this.isCancelled) break;
            const results = await Promise.all(streams.map(({ canvases }) => canvases.next()));
            const frames: Partial<Record<CameraKey, CanvasImageSource>> = {};
            streams.forEach(({ key }, i) => {
              const frame = results[i].value;
              if (frame) frames[key] = frame.canvas;
            });

            const currentFrameIdx = Math.round(sourceSec * config.sourceFps);
            const telemetry = decoder
              ? decoder.getFrameTelemetry(decoder.getFrameIndexAtTime(sourceSec, config.sourceFps))
              : DEFAULT_TELEMETRY;

            OverlayRenderer.render(
              exportCanvas,
              frames,
              telemetry,
              segment.baseTimeStr,
              sourceSec,
              currentFrameIdx,
              config.sourceFps,
              config.options,
            );

            await source.add(outputFrameCount / config.targetFps, 1 / config.targetFps);
            outputFrameCount++;

            const progressPct = Math.min(100, Math.round((outputFrameCount / totalFrames) * 100));
            config.onProgress(progressPct, segIdx + 1, config.segments.length);
          }
        } finally {
          for (const input of inputs) input.dispose();
        }
      }

      if (this.isCancelled) {
        throw new Error(i18n.t('error_export_cancelled'));
      }

      if (outputFrameCount === 0) {
        throw new Error(i18n.t('error_no_frames'));
      }

      config.onProgress(100, config.segments.length, config.segments.length);
      await output.finalize();

      const { buffer } = output.target;
      if (!buffer || buffer.byteLength === 0) {
        throw new Error(i18n.t('error_empty_output'));
      }
      return new Blob([buffer], { type: 'video/mp4' });
    } finally {
      if (output.state === 'pending' || output.state === 'started') {
        await output.cancel();
      }
    }
  }
}
