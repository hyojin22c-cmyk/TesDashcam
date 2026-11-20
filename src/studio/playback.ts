import { clamp, delay } from 'es-toolkit';

import { type ClipItem, ensureClipFiles } from '@/core/clip-scanner';
import { rememberClipDuration } from '@/core/clip-timing';
import { CAMERA_KEYS, type CameraKey } from '@/core/constants';
import { clampPlaybackSpeed } from '@/core/playback-speed';
import { OverlayRenderer } from '@/core/renderer';
import { BlobFileHandle, DEFAULT_TELEMETRY, RealTeslaSEIDecoder } from '@/core/sei-decoder';
import { isAndroid, isIOS, isIOSOrAndroid, isMobileDevice } from '@/lib/platform';

import {
  allClips,
  clipPosition,
  getStudio,
  hasPillarCameras,
  isExporting,
  type LayoutName,
  openDialog,
  setStudio,
} from './store';

import type { SeiWorkerResponse } from '@/core/sei-worker';

export const SOURCE_FPS = 36;

const videoPool: Partial<Record<CameraKey, HTMLVideoElement>> = {};
const blobUrls = new Map<CameraKey, string>();
const clipDecoders = new Map<string, RealTeslaSEIDecoder>();
let canvas: HTMLCanvasElement | null = null;
let seiWorker: Worker | null = null;
let loadSeq = 0;
let clipGeneration = 0;
let isSelectingClip = false;
let lastSyncCheckMs = 0;
let lastRenderWallMs = 0;
let previousLayout: LayoutName = 'front-focus';

const playbackSpeed = () => clampPlaybackSpeed(getStudio().options.playbackSpeed);

const isMobileEnvironment = () =>
  isMobileDevice() ||
  isIOSOrAndroid() ||
  getStudio().viewMode === 'mobile' ||
  window.innerWidth <= 850;

export const getCanvas = () => canvas;

export const mountVideoPool = (container: HTMLElement | null) => {
  if (!container) return;
  for (const key of CAMERA_KEYS) {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.preload = 'auto';
    Object.assign(video.style, {
      width: '1px',
      height: '1px',
      opacity: '0.01',
      pointerEvents: 'none',
    });
    const onFrameReady = () => {
      if (!getStudio().isPlaying && getStudio().activeClip) renderFrame();
    };
    video.addEventListener('loadeddata', onFrameReady);
    video.addEventListener('canplay', onFrameReady);
    video.addEventListener('seeked', onFrameReady);
    video.addEventListener('error', () => {
      if (video.src) console.warn(`[Video Error] Camera ${key} failed to load:`, video.error);
    });
    container.append(video);
    videoPool[key] = video;
  }
  return () => {
    for (const key of CAMERA_KEYS) {
      videoPool[key]?.remove();
      delete videoPool[key];
    }
  };
};

export const attachCanvas = (element: HTMLCanvasElement | null) => {
  if (!element) return;
  canvas = element;
  const loop = () => {
    tick();
    frame = requestAnimationFrame(loop);
  };
  let frame = requestAnimationFrame(loop);
  return () => {
    cancelAnimationFrame(frame);
    canvas = null;
  };
};

const getMasterVideo = (): HTMLVideoElement | null => {
  const clip = getStudio().activeClip;
  if (!clip) return null;
  if (clip.cams.front && videoPool.front) return videoPool.front;
  const key = CAMERA_KEYS.find((k) => Boolean(clip.cams[k]));
  return key ? (videoPool[key] ?? null) : null;
};

const getActiveVideos = (): HTMLVideoElement[] => {
  const clip = getStudio().activeClip;
  if (!clip) return [];
  return CAMERA_KEYS.filter((k) => clip.cams[k]).flatMap((k) => videoPool[k] ?? []);
};

const releaseVideo = (video: HTMLVideoElement) => {
  try {
    video.playbackRate = 1;
    video.pause();
    video.onloadedmetadata = null;
    video.onloadeddata = null;
    video.onended = null;
    video.onpause = null;
    video.removeAttribute('src');
    video.load();
  } catch {}
};

const clearBlobUrls = () => {
  for (const url of blobUrls.values()) URL.revokeObjectURL(url);
  blobUrls.clear();
};

export const releasePreviewDecoders = () => {
  for (const key of CAMERA_KEYS) {
    const video = videoPool[key];
    if (video) releaseVideo(video);
  }
  clearBlobUrls();
};

const restartSeiWorker = () => {
  seiWorker?.terminate();
  seiWorker = null;
  try {
    const worker = new Worker(new URL('../core/sei-worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = (event: MessageEvent<SeiWorkerResponse>) =>
      handleSeiWorkerMessage(event.data);
    worker.onerror = (error) => {
      console.warn('[App] seiWorker error, falling back to main-thread async decoder:', error);
      seiWorker = null;
    };
    seiWorker = worker;
  } catch (error) {
    console.warn('[App] Could not initialize seiWorker, using main-thread fallback:', error);
  }
};

const handleSeiWorkerMessage = (msg: SeiWorkerResponse) => {
  if (msg.generation !== clipGeneration) return;
  if (msg.type === 'progress') {
    setStudio({
      seiProgress: { pct: msg.pct, parsedFrames: msg.parsedFrames, totalFrames: msg.totalFrames },
    });
  } else if (msg.type === 'complete') {
    const decoder = new RealTeslaSEIDecoder();
    decoder.telemetryCache = new Map(msg.entries);
    decoder.sortedKeys = Array.from(decoder.telemetryCache.keys()).sort((a, b) => a - b);
    decoder.maxSpeedKmh = msg.maxSpeedKmh;
    decoder.hasSeiData = msg.hasSeiData;
    decoder.setSampleTimes(msg.sampleTimesSec);
    clipDecoders.set(msg.clipId, decoder);
    setStudio({ seiProgress: null });
    if (!getStudio().isPlaying) renderFrame();
  } else {
    console.warn('[App] seiWorker error for clip', msg.clipId, msg.error);
    setStudio({ seiProgress: null });
  }
};

restartSeiWorker();

export const getClipDecoder = async (clip: ClipItem, frontFile: File | null) => {
  if (!clipDecoders.has(clip.id) && frontFile) {
    const decoder = new RealTeslaSEIDecoder();
    await decoder.parseMp4Sei(new BlobFileHandle(frontFile));
    clipDecoders.set(clip.id, decoder);
  }
  return clipDecoders.get(clip.id) ?? null;
};

const startBackgroundTelemetry = (clip: ClipItem, generation: number) => {
  const frontFile = clip.cams.front;
  if (clipDecoders.has(clip.id) || !frontFile) {
    setStudio({ seiProgress: null });
    return;
  }
  setStudio({ seiProgress: { pct: 0 } });
  if (seiWorker) {
    seiWorker.postMessage({ type: 'parse', clipId: clip.id, generation, file: frontFile });
    return;
  }
  const decoder = new RealTeslaSEIDecoder();
  decoder
    .parseMp4Sei(new BlobFileHandle(frontFile), (pct, parsedFrames, totalFrames) => {
      if (clipGeneration === generation) {
        setStudio({ seiProgress: { pct, parsedFrames, totalFrames } });
      }
    })
    .then(() => {
      if (clipGeneration !== generation) return;
      clipDecoders.set(clip.id, decoder);
      setStudio({ seiProgress: null });
      if (!getStudio().isPlaying) renderFrame();
    })
    .catch((error: unknown) => {
      console.warn('[App] Failed to parse SEI metadata for clip', clip.id, error);
      if (clipGeneration === generation) setStudio({ seiProgress: null });
    });
};

export const syncPillarPip = () => {
  const { activeClip, options } = getStudio();
  const pillars = hasPillarCameras(activeClip);
  const pillarSingle =
    options.single_cam === 'left_pillar' || options.single_cam === 'right_pillar';
  setStudio({
    options: {
      ...options,
      pillar_pip: pillars && options.layout !== 'single',
      single_cam: !pillars && pillarSingle ? 'front' : options.single_cam,
    },
  });
};

export const setLayoutMode = (layout: LayoutName) => {
  const current = getStudio().options.layout;
  if (layout === 'single' && current !== 'single') previousLayout = current;
  setStudio((state) => ({ options: { ...state.options, layout } }));
  syncPillarPip();
};

export const showSingleCamera = (camera: CameraKey) => {
  setStudio((state) => ({ options: { ...state.options, single_cam: camera } }));
  setLayoutMode('single');
};

export const restorePreviousLayout = () => setLayoutMode(previousLayout);

export const resetSession = () => {
  loadSeq++;
  clipGeneration = loadSeq;
  isSelectingClip = false;
  releasePreviewDecoders();
  clipDecoders.clear();
  restartSeiWorker();
  for (const clip of allClips()) {
    clip.cams = {};
    clip.camHandles = {};
  }
  canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
  setStudio({
    folderGroups: [],
    clipFolders: { query: '', open: {} },
    activeClip: null,
    isPlaying: false,
    startPoint: null,
    endPoint: null,
    seiProgress: null,
  });
  syncPillarPip();
};

export const selectClip = async (clip: ClipItem) => {
  isSelectingClip = true;
  const seq = ++loadSeq;
  clipGeneration = seq;
  try {
    setStudio({ activeClip: clip });
    await ensureClipFiles(clip);
    if (seq !== loadSeq) return;

    setStudio({ durationSec: clip.durationSec, isPlaying: false, currentTimeSec: 0 });
    syncPillarPip();
    clipDecoders.clear();
    restartSeiWorker();

    const ios = isIOS();
    const android = isAndroid();
    const masterKey: CameraKey = clip.cams.front
      ? 'front'
      : (CAMERA_KEYS.find((k) => clip.cams[k]) ?? 'front');

    for (const key of CAMERA_KEYS) {
      const video = videoPool[key];
      if (!video) continue;
      try {
        video.playbackRate = 1;
        video.pause();
        video.onloadedmetadata = null;
        video.onloadeddata = null;
        video.onended = null;
        video.onpause = null;
        if (android || !clip.cams[key]) {
          video.removeAttribute('src');
          video.load();
        }
      } catch {}
      const oldUrl = blobUrls.get(key);
      if (oldUrl) {
        URL.revokeObjectURL(oldUrl);
        blobUrls.delete(key);
      }
    }

    if (android) {
      await delay(50);
      if (seq !== loadSeq) return;
    }

    const speed = playbackSpeed();
    const updateDuration = (video: HTMLVideoElement) => {
      if (rememberClipDuration(clip, video.duration)) setStudio({ durationSec: video.duration });
    };

    for (const key of CAMERA_KEYS) {
      const video = videoPool[key];
      const file = clip.cams[key];
      if (!video || !file) continue;
      const url = URL.createObjectURL(file);
      blobUrls.set(key, url);
      video.src = url;
      video.muted = true;
      video.playsInline = true;
      const isMaster = key === masterKey;
      video.preload = ios && !isMaster ? 'metadata' : 'auto';

      video.onloadeddata = () => {
        if (seq !== loadSeq) return;
        video.playbackRate = speed;
        if (!getStudio().isPlaying && getStudio().activeClip?.id === clip.id) renderFrame();
      };
      video.onloadedmetadata = () => {
        if (seq !== loadSeq) return;
        video.playbackRate = speed;
        if (isMaster) updateDuration(video);
        if (!ios && !getStudio().isPlaying && video.currentTime < 0.002) {
          try {
            const master = videoPool[masterKey];
            video.currentTime = master && master.currentTime > 0 ? master.currentTime : 0.001;
          } catch {}
        }
        if (!getStudio().isPlaying && getStudio().activeClip?.id === clip.id) renderFrame();
      };
      try {
        video.load();
      } catch {}
    }

    const masterVideo = videoPool[masterKey];
    if (masterVideo) {
      masterVideo.onended = handleMasterEnded;
      masterVideo.onpause = () => {
        if (getStudio().isPlaying) pauseAllVideos(false);
      };
      if (masterVideo.readyState >= 1) updateDuration(masterVideo);
    }

    if (seq !== loadSeq) return;
    setStudio({ currentTimeSec: 0 });
    renderFrame();
    startBackgroundTelemetry(clip, seq);
  } finally {
    if (seq === loadSeq) isSelectingClip = false;
  }
};

export const pauseAllVideos = (alignTimes = true) => {
  const master = getMasterVideo();
  const targetTime = master ? master.currentTime : getStudio().currentTimeSec;
  const speed = playbackSpeed();
  const videos = getActiveVideos();
  for (const video of videos) {
    try {
      if (!video.paused) video.pause();
      video.playbackRate = speed;
    } catch {}
  }
  setStudio({ isPlaying: false });
  if (!alignTimes || !master) return;
  for (const video of videos) {
    if (video === master || video.ended) continue;
    try {
      if (Math.abs(video.currentTime - targetTime) > 0.02) {
        video.currentTime = Math.min(video.duration || targetTime, targetTime);
      }
    } catch {}
  }
  setStudio({ currentTimeSec: targetTime });
};

const handleMasterEnded = () => {
  pauseAllVideos(true);
  if (getStudio().autoNext) nextClip(true).catch(reportError);
};

export const applyPlaybackSpeed = () => {
  const speed = playbackSpeed();
  for (const video of getActiveVideos()) video.playbackRate = speed;
};

export const setPlaybackSpeed = (speed: number) => {
  setStudio((state) => ({
    options: { ...state.options, playbackSpeed: clampPlaybackSpeed(speed) },
  }));
  applyPlaybackSpeed();
};

export const togglePlay = () => {
  if (isExporting()) return;
  if (getStudio().isPlaying) {
    pauseAllVideos(true);
    return;
  }
  const master = getMasterVideo();
  const { durationSec } = getStudio();
  if (master && (master.ended || (durationSec > 0 && master.currentTime >= durationSec - 0.04))) {
    seekTo(0);
  }
  setStudio({ isPlaying: true });
  applyPlaybackSpeed();
  for (const video of getActiveVideos()) {
    if (video.preload !== 'auto') video.preload = 'auto';
    video.play().catch(() => {});
  }
};

export const seekTo = (targetSec: number) => {
  if (isExporting()) return;
  const { durationSec, isPlaying } = getStudio();
  const currentTimeSec = clamp(targetSec, 0, durationSec);
  const seekTime = !isIOS() && currentTimeSec === 0 ? 0.001 : currentTimeSec;
  const speed = playbackSpeed();
  for (const video of getActiveVideos()) {
    try {
      if (video.readyState >= 1) video.currentTime = Math.min(video.duration || seekTime, seekTime);
      video.playbackRate = speed;
    } catch {}
  }
  setStudio({ currentTimeSec });
  if (!isPlaying) renderFrame();
};

export const seekRelative = (deltaSec: number) => seekTo(getStudio().currentTimeSec + deltaSec);

export const prevClip = async () => {
  const { activeClip } = getStudio();
  if (isExporting() || !activeClip) return;
  const previous = allClips()[clipPosition(activeClip.id) - 1];
  if (previous) await selectClip(previous);
};

export const nextClip = async (auto = false) => {
  const { activeClip } = getStudio();
  if (isExporting() || !activeClip) return;
  const index = clipPosition(activeClip.id);
  const next = index >= 0 ? allClips()[index + 1] : undefined;
  if (!next) return;
  await selectClip(next);
  if (auto && getStudio().activeClip?.id === next.id) togglePlay();
};

const syncSecondaryVideos = (master: HTMLVideoElement) => {
  const masterTime = master.currentTime;
  const maxSpeed = isMobileEnvironment() ? 4 : 16;
  const targetSpeed = playbackSpeed();
  const hardSeekThreshold = Math.max(0.4, 0.25 * targetSpeed);
  for (const video of getActiveVideos()) {
    if (video === master || video.ended || video.seeking || video.readyState < 2) continue;
    const diff = video.currentTime - masterTime;
    let rate = targetSpeed;
    if (Math.abs(diff) > hardSeekThreshold) {
      try {
        video.currentTime = Math.min(video.duration || masterTime, masterTime);
      } catch {}
    } else if (Math.abs(diff) > 0.06) {
      rate =
        diff > 0
          ? Math.max(0.5, Number((targetSpeed * 0.94).toFixed(2)))
          : Math.min(maxSpeed, Number((targetSpeed * 1.06).toFixed(2)));
    }
    if (Math.abs(video.playbackRate - rate) > 0.01) video.playbackRate = rate;
  }
};

const tick = () => {
  if (isExporting()) {
    for (const video of getActiveVideos()) if (!video.paused) video.pause();
    return;
  }
  const { isPlaying, durationSec, options } = getStudio();
  const master = getMasterVideo();
  if (!isPlaying || !master || master.paused || master.ended) {
    if (isPlaying) handleMasterEnded();
    else if (!isSelectingClip) {
      const speed = playbackSpeed();
      for (const video of getActiveVideos()) {
        if (video.paused || video.seeking) continue;
        video.pause();
        video.playbackRate = speed;
      }
    }
  } else if (master.ended || (durationSec > 0 && master.currentTime >= durationSec - 0.04)) {
    setStudio({ currentTimeSec: master.currentTime });
    handleMasterEnded();
  } else {
    setStudio({ currentTimeSec: master.currentTime });
    const now = performance.now();
    if (now - lastSyncCheckMs >= 250) {
      lastSyncCheckMs = now;
      syncSecondaryVideos(master);
    }
  }
  if (isPlaying || options.draggingCol || performance.now() - lastRenderWallMs >= 120) {
    renderFrame();
  }
};

export const renderFrame = () => {
  if (!canvas) return;
  lastRenderWallMs = performance.now();
  const { activeClip, currentTimeSec, options } = getStudio();
  const decoder = activeClip ? clipDecoders.get(activeClip.id) : undefined;
  const frameIdx = Math.round(currentTimeSec * SOURCE_FPS);
  const telemetry = decoder
    ? decoder.getFrameTelemetry(decoder.getFrameIndexAtTime(currentTimeSec, SOURCE_FPS))
    : DEFAULT_TELEMETRY;
  const frames: Partial<Record<CameraKey, HTMLVideoElement>> = {};
  if (activeClip) {
    for (const key of CAMERA_KEYS) {
      const video = videoPool[key];
      if (activeClip.cams[key] && video) frames[key] = video;
    }
  }
  OverlayRenderer.render(
    canvas,
    frames,
    telemetry,
    activeClip?.timestampStr ?? '2026-10-07 00:00:00',
    currentTimeSec,
    frameIdx,
    SOURCE_FPS,
    options,
  );
};

export const openTutorial = () => {
  if (isExporting()) return;
  if (getStudio().isPlaying) pauseAllVideos(false);
  openDialog('tutorial');
};
