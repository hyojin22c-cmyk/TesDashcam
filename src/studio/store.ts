import * as z from 'zod/mini';
import { create } from 'zustand';

import { DEFAULT_RESOLUTION, type ResolutionName } from '@/core/constants';
import { DEFAULT_RENDER_OPTIONS, type RenderOptions } from '@/core/renderer';
import { DEFAULT_CARD_PALETTE, TELEMETRY_STYLES } from '@/core/telemetry-style';

import type { ClipItem, FolderGroup } from '@/core/clip-scanner';
import type { TranslationKey } from '@/i18n';

export const STUDIO_THEMES = [
  'default',
  'graphite',
  'midnight',
  'forest',
  'burgundy',
  'amber',
  'paper',
  'paper-blue',
  'paper-violet',
  'paper-rose',
  'paper-sand',
] as const;
const ThemeSchema = z.enum(STUDIO_THEMES);
export type StudioTheme = z.infer<typeof ThemeSchema>;

const ViewModeSchema = z.enum(['auto', 'mobile', 'desktop']);
export type ViewMode = z.infer<typeof ViewModeSchema>;
export type LayoutMode = 'desktop' | 'portrait' | 'landscape';
export type PanelTab = 'clips' | 'overlays' | 'export' | 'settings';
export type LayoutName = RenderOptions['layout'];
export type DialogName = 'hotkeys' | 'tier' | 'install' | 'tutorial' | 'legal';

export const LEGAL_DOCS = ['privacy', 'license', 'third-party', 'audit', 'data-flow'] as const;
export type LegalDoc = (typeof LEGAL_DOCS)[number];
export type TranslationParams = Record<string, string | number>;

export interface RangePoint {
  clipId: string;
  sec: number;
  absTimeMs: number;
}

export interface LoadProgress {
  titleKey: TranslationKey;
  countKey: TranslationKey;
  params: TranslationParams;
  pct: number;
  indeterminate: boolean;
}

export interface SeiProgress {
  pct: number;
  parsedFrames?: number;
  totalFrames?: number;
}

export interface ExportProgress {
  pct: number;
  segment: number;
  totalSegments: number;
  targetFps: number;
  speed: number;
  cancelling: boolean;
}

export interface ExportStatus {
  key: TranslationKey;
  params?: TranslationParams;
  detail?: string;
}

export interface StudioState {
  folderGroups: FolderGroup[];
  clipFolders: { query: string; open: Record<string, boolean> };
  activeClip: ClipItem | null;
  isPlaying: boolean;
  currentTimeSec: number;
  durationSec: number;
  startPoint: RangePoint | null;
  endPoint: RangePoint | null;
  options: RenderOptions;
  autoNext: boolean;
  resolution: ResolutionName;
  exportFps: number;
  loadProgress: LoadProgress | null;
  seiProgress: SeiProgress | null;
  exportProgress: ExportProgress | null;
  exportStatus: ExportStatus | null;
  theme: StudioTheme;
  viewMode: ViewMode;
  layoutMode: LayoutMode;
  panelTab: PanelTab;
  confirmLongExport: boolean;
  consentOpen: boolean;
  explorerExpanded: boolean;
  drawerOpen: boolean;
  dialog: DialogName | null;
  legalDoc: LegalDoc;
}

const THEME_KEY = 'ct_studio_theme';
const VIEW_MODE_KEY = 'ct_view_mode';
const TELEMETRY_ORDER_KEY = 'ct_telemetry_order';
const TELEMETRY_STYLE_KEY = 'ct_telemetry_style';
const DRIVE_MODE_LABELS_KEY = 'ct_drive_mode_labels';
const AUTO_NEXT_KEY = 'ct_auto_next';

const readStorage = <S extends z.ZodMiniType>(
  key: string,
  schema: S,
  decode: (raw: string) => unknown = JSON.parse,
): z.infer<S> | undefined => {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? undefined : schema.safeParse(decode(raw)).data;
  } catch {
    return undefined;
  }
};

export const writeStorage = (key: string, value: string | null) => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {}
};

const savedTheme =
  readStorage(THEME_KEY, ThemeSchema, String) ??
  (import.meta.env.BASE_URL.includes('/dev/')
    ? readStorage('ct_theme_dev', ThemeSchema, String)
    : undefined) ??
  readStorage('ct_theme', ThemeSchema, String) ??
  'default';
const savedViewMode = readStorage(VIEW_MODE_KEY, ViewModeSchema, String);
const savedTelemetryOrder = readStorage(TELEMETRY_ORDER_KEY, z.array(z.string()));
const savedAutoNext = readStorage(AUTO_NEXT_KEY, z.enum(['0', '1']), String);
const linkedLegalDoc = z
  .enum(LEGAL_DOCS)
  .safeParse(new URLSearchParams(window.location.search).get('legal')).data;

export const useStudio = create<StudioState>()(() => ({
  folderGroups: [],
  clipFolders: { query: '', open: {} },
  activeClip: null,
  isPlaying: false,
  currentTimeSec: 0,
  durationSec: 60,
  startPoint: null,
  endPoint: null,
  options: {
    ...DEFAULT_RENDER_OPTIONS,
    pillar_pip: false,
    telemetryOrder: savedTelemetryOrder,
    telemetryStyle: readStorage(TELEMETRY_STYLE_KEY, z.enum(TELEMETRY_STYLES), String) ?? 'classic',
    newDriveModeLabels: readStorage(DRIVE_MODE_LABELS_KEY, z.enum(['0', '1']), String) === '1',
  },
  autoNext: savedAutoNext === '1',
  resolution: DEFAULT_RESOLUTION,
  exportFps: 36,
  loadProgress: null,
  seiProgress: null,
  exportProgress: null,
  exportStatus: null,
  theme: savedTheme,
  viewMode: savedViewMode ?? 'auto',
  layoutMode: 'desktop',
  panelTab: 'clips',
  confirmLongExport: false,
  consentOpen: false,
  explorerExpanded: false,
  drawerOpen: false,
  dialog: linkedLegalDoc ? 'legal' : null,
  legalDoc: linkedLegalDoc ?? 'privacy',
}));

export const getStudio = useStudio.getState;
export const setStudio = useStudio.setState;

export const setOption = <K extends keyof RenderOptions>(key: K, value: RenderOptions[K]) => {
  setStudio((state) => ({ options: { ...state.options, [key]: value } }));
  if (key === 'telemetryStyle' && typeof value === 'string')
    writeStorage(TELEMETRY_STYLE_KEY, value);
  if (key === 'newDriveModeLabels') writeStorage(DRIVE_MODE_LABELS_KEY, value ? '1' : '0');
};

export const setTelemetryOrder = (order: string[] | null) => {
  setOption('telemetryOrder', order ?? undefined);
  writeStorage(TELEMETRY_ORDER_KEY, order ? JSON.stringify(order) : null);
};

export const setAutoNext = (autoNext: boolean) => {
  setStudio({ autoNext });
  writeStorage(AUTO_NEXT_KEY, autoNext ? '1' : '0');
};

export const applyStudioTheme = (theme = getStudio().theme) => {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.classList.toggle('dark', !theme.startsWith('paper'));
  const styles = getComputedStyle(root);
  const color = styles.getPropertyValue('--background').trim();
  const cardPalette = { ...DEFAULT_CARD_PALETTE };
  for (const key of Object.keys(cardPalette) as (keyof typeof cardPalette)[]) {
    cardPalette[key] = styles.getPropertyValue(`--hud-card-${key}`).trim() || cardPalette[key];
  }
  setOption('cardPalette', cardPalette);
  if (color) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color);
};

export const setStudioTheme = (theme: StudioTheme) => {
  applyStudioTheme(theme);
  setStudio({ theme });
  writeStorage(THEME_KEY, theme);
};

export const setViewMode = (viewMode: ViewMode) => {
  setStudio({ viewMode });
  writeStorage(VIEW_MODE_KEY, viewMode);
};

export const openDialog = (dialog: DialogName | null) => setStudio({ dialog });

export const openLegal = (legalDoc: LegalDoc) => setStudio({ dialog: 'legal', legalDoc });

const clipIndexes = new WeakMap<FolderGroup[], { clips: ClipItem[]; byId: Map<string, number> }>();

const clipIndex = (groups: FolderGroup[]) => {
  let index = clipIndexes.get(groups);
  if (!index) {
    const clips = groups.flatMap((group) => group.clips);
    index = { clips, byId: new Map(clips.map((clip, position) => [clip.id, position])) };
    clipIndexes.set(groups, index);
  }
  return index;
};

export const allClips = (state: StudioState = getStudio()): readonly ClipItem[] =>
  clipIndex(state.folderGroups).clips;

export const clipPosition = (clipId: string, state: StudioState = getStudio()) =>
  clipIndex(state.folderGroups).byId.get(clipId) ?? -1;

export const hasPillarCameras = (clip: ClipItem | null) =>
  Boolean(
    clip &&
    (clip.cams.left_pillar ||
      clip.cams.right_pillar ||
      clip.camHandles?.left_pillar ||
      clip.camHandles?.right_pillar),
  );

export const isExporting = () => getStudio().exportProgress !== null;
