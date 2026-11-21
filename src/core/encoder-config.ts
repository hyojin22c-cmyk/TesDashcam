import { RESOLUTIONS, type ResolutionName } from './constants';

export const resolveVideoEncoderConfig = async (resolution: ResolutionName, frameRate: number) => {
  const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);
  const isIOS =
    typeof navigator !== 'undefined' &&
    (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
  const isMobile =
    isAndroid ||
    isIOS ||
    (typeof window !== 'undefined' &&
      window.matchMedia(
        '(max-width: 850px), (pointer: coarse), ((orientation: landscape) and (max-height: 600px))',
      ).matches);

  const resConfig = RESOLUTIONS[resolution];
  const [targetW, targetH] = resConfig.size;
  // Bitrate selection: matched to Python libx264 CRF 21~26 real-world compression ratios with FPS ratio scaling
  const baseBitrate = resConfig.bitrate_mbps;
  const fpsRatio = Math.pow(Math.max(1, frameRate) / 30.0, 0.45);
  const scaledBitrate = baseBitrate * fpsRatio;
  const effectiveBitrateMbps = isMobile
    ? Math.min(scaledBitrate, targetW >= 2560 ? 16.0 : targetW >= 1920 ? 10.0 : 5.5)
    : scaledBitrate;
  const bitrateBps = Math.round(effectiveBitrateMbps * 1_000_000);

  // Codec profile & level:
  // - PC & iOS: standard High Profile avc1.640028 (Level 4.0) or avc1.640032 (Level 5.0 for QHD).
  //   Apple VideoToolbox on iOS handles High Profile natively with zero frame swap jitter and maximum hardware speed.
  // - Android (Galaxy): Constrained Baseline Profile (avc1.42E0xx) to strictly prevent Samsung Exynos/Snapdragon
  //   MediaCodec from generating B-frames which cause 1-3-2-4-6-5 PTS/DTS temporal jitter in Samsung Gallery.
  let avcLevel = 'avc1.640028';
  if (isAndroid) {
    avcLevel = targetW >= 2560 ? 'avc1.42E032' : targetW >= 1920 ? 'avc1.42E029' : 'avc1.42E01f';
  } else if (targetW >= 2560) {
    avcLevel = 'avc1.640032';
  }

  const encoderConfig: VideoEncoderConfig = {
    codec: avcLevel,
    width: targetW,
    height: targetH,
    bitrate: bitrateBps,
    bitrateMode: 'variable',
    framerate: frameRate,
    avc: { format: 'avc' },
  };

  let supported: boolean | undefined;
  if (isAndroid) {
    // Enforce realtime latencyMode on Android to prevent B-frame temporal reordering jitter in Samsung Gallery
    encoderConfig.latencyMode = 'realtime';
  }

  if (typeof VideoEncoder.isConfigSupported === 'function') {
    try {
      let check = await VideoEncoder.isConfigSupported(encoderConfig);
      if (!check.supported && encoderConfig.bitrateMode) {
        delete encoderConfig.bitrateMode;
        check = await VideoEncoder.isConfigSupported(encoderConfig);
      }
      if (!check.supported && encoderConfig.latencyMode) {
        delete encoderConfig.latencyMode;
        check = await VideoEncoder.isConfigSupported(encoderConfig);
      }
      if (!check.supported) {
        encoderConfig.codec =
          targetW >= 2560 ? 'avc1.640032' : targetW >= 1920 ? 'avc1.640029' : 'avc1.640028';
        delete encoderConfig.latencyMode;
        check = await VideoEncoder.isConfigSupported(encoderConfig);
      }
      if (!check.supported) {
        encoderConfig.codec = 'avc1.42001f';
        check = await VideoEncoder.isConfigSupported(encoderConfig);
      }
      if (!check.supported && encoderConfig.avc) {
        delete encoderConfig.avc;
        check = await VideoEncoder.isConfigSupported(encoderConfig);
      }
      supported = check.supported ?? false;
    } catch (err) {
      console.warn('[Exporter] VideoEncoder.isConfigSupported check fallback:', err);
      delete encoderConfig.latencyMode;
      delete encoderConfig.bitrateMode;
    }
  }

  return { encoderConfig, supported };
};
