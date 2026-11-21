import { i18n } from '@/i18n';

import { DEFAULT_TELEMETRY } from './sei-decoder';

import type { RenderOptions } from './renderer';
import type { TelemetryData } from './sei-decoder';

export const TELEMETRY_STYLES = ['classic', 'studio', 'cards', 'strip'] as const;
export type TelemetryStyle = (typeof TELEMETRY_STYLES)[number];

export const TELEMETRY_KEYS = [
  'timestamp',
  'steering',
  'turn_signal',
  'speed',
  'pedal',
  'fsd',
] as const;

export const driveModeLabel = (key: string, label: string, useNewLabels?: boolean) => {
  if (!useNewLabels) return label;
  if (key === 'AUTOPILOT') return 'AUTOSTEER';
  if (key === 'FSD') return 'ASSISTED DRIVING';
  return label;
};

type TelemetryBox = { key: string; x: number; y: number; width: number; height: number };

const CARD_WEIGHTS = [366, 314, 252, 246, 366, 346];

export const computeModernTelemetryBoxes = (
  keys: string[],
  x: number,
  y: number,
  width: number,
  height: number,
  scale: number,
  strip: boolean,
): TelemetryBox[] => {
  const inset = 12 * scale;
  x += inset;
  y += inset;
  width -= inset * 2;
  height -= inset * 2;
  if (strip) {
    const secondary = keys.length > 2;
    const primaryWidth = width / (secondary ? 4 : Math.max(1, keys.length));
    const secondaryWidth = (width - primaryWidth * 2) / (keys.length === 3 ? 1 : 2);
    return keys.map((key, index) => {
      if (index < 2) return { key, x: x + index * primaryWidth, y, width: primaryWidth, height };
      return {
        key,
        x: x + primaryWidth * 2 + ((index - 2) % 2) * secondaryWidth,
        y: y + (Math.floor((index - 2) / 2) * height) / 2,
        width: index === 4 && keys.length === 5 ? secondaryWidth * 2 : secondaryWidth,
        height: index < 4 && keys.length <= 4 ? height : height / 2,
      };
    });
  }

  const gap = 10 * scale;
  const available = width - gap * (keys.length - 1);
  const totalWeight = CARD_WEIGHTS.slice(0, keys.length).reduce((sum, weight) => sum + weight, 0);
  return keys.map((key, index) => {
    const cardWidth = (available * CARD_WEIGHTS[index]) / totalWeight;
    const box = { key, x, y, width: cardWidth, height };
    x += cardWidth + gap;
    return box;
  });
};

const LABELS = {
  speed: 'hud_speed',
  timestamp: 'hud_time',
  steering: 'hud_steering',
  turn_signal: 'hud_blinker',
  pedal: 'hud_pedals',
  fsd: 'hud_drive_mode',
} as const;

const timestampParts = (base: string, seconds: number) => {
  const date = new Date(base.replace(' ', 'T'));
  if (!Number.isFinite(date.getTime())) return ['—', '—'];
  date.setSeconds(date.getSeconds() + seconds);
  const pad = (value: number) => String(value).padStart(2, '0');
  return [
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`,
  ];
};

export const drawModernTelemetry = (
  ctx: CanvasRenderingContext2D,
  boxes: TelemetryBox[],
  telemetry: TelemetryData,
  baseDate: string,
  seconds: number,
  frame: number,
  fps: number,
  options: RenderOptions,
  scale: number,
  drawWheel: (x: number, y: number, angle: number, size: number) => void,
) => {
  const cards = options.telemetryStyle === 'cards';
  const present = telemetry !== DEFAULT_TELEMETRY;
  const number = (value: number, suffix = '') =>
    present && Number.isFinite(value) ? `${Math.round(value)}${suffix}` : '—';
  const [date, time] = timestampParts(baseDate, seconds);
  const mode = telemetry.ap_mode === 'FSD ACTIVE' ? 'FSD' : telemetry.ap_mode;
  const braking = telemetry.brake_applied || telemetry.brake_pct > 0;
  const text = '#f0f5ec';
  const muted = cards ? '#40565c' : '#acceca';
  const fg = cards ? '#102027' : text;
  const accent = cards ? '#006955' : '#79efd5';
  const blinkOn = Math.floor((frame / fps) * 3.5) % 2 === 0;
  const renderText = (
    value: string,
    x: number,
    y: number,
    width: number,
    size: number,
    color: string,
    bold = false,
    numeric = false,
  ) => {
    ctx.font = `${bold ? 700 : 500} ${size * scale}px ${numeric ? 'monospace' : 'sans-serif'}`;
    ctx.fillStyle = color;
    ctx.fillText(value, x, y, width);
  };

  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  boxes.forEach(({ key, x, y, width, height }, index) => {
    const large = cards || index < 2;
    const padding = Math.min(20 * scale, width * 0.075);
    const left = x + padding;
    const usable = width - padding * 2;
    const titleY = y + (large ? 31 : 19) * scale;
    const valueY = y + (large ? 99 : 50) * scale;
    if (cards || options.draggingCol === key) {
      ctx.fillStyle = cards ? (key === 'speed' ? '#c2efdc' : '#e5ebe7') : '#294345';
      ctx.beginPath();
      ctx.roundRect(x, y, width, height, 16 * scale);
      ctx.fill();
      if (cards && options.draggingCol === key) {
        ctx.strokeStyle = accent;
        ctx.lineWidth = 3 * scale;
        ctx.stroke();
      }
    } else if (index > 0) {
      ctx.fillStyle = '#48605f';
      if (index >= 4) ctx.fillRect(x + padding, y, usable, scale);
      else ctx.fillRect(x, y + 4 * scale, scale, height - 8 * scale);
    }
    renderText(
      i18n.t(LABELS[key as keyof typeof LABELS]),
      left,
      titleY,
      usable,
      large ? 23 : 17,
      muted,
    );
    switch (key) {
      case 'speed': {
        const unit = Math.min(74 * scale, usable * 0.34);
        renderText(
          number(telemetry.speed_kmh),
          left,
          valueY,
          usable - unit,
          cards ? 76 : large ? 92 : 37,
          fg,
          true,
          true,
        );
        renderText(
          'km/h',
          left + usable - unit,
          valueY + (large ? 12 : 4) * scale,
          unit,
          large ? 27 : 16,
          muted,
        );
        break;
      }
      case 'timestamp':
        renderText(
          time,
          left,
          valueY - 10 * scale,
          usable,
          cards ? 49 : large ? 63 : 31,
          fg,
          true,
          true,
        );
        renderText(
          date,
          left,
          y + (large ? 134 : 63) * scale,
          usable,
          large ? 20 : 13,
          muted,
          false,
          true,
        );
        break;
      case 'steering': {
        const size = present ? Math.min((large ? 68 : 36) * scale, usable * 0.42) : 0;
        if (size) drawWheel(left + size / 2, valueY, telemetry.steering_deg, size);
        const gap = size ? size + 8 * scale : 0;
        renderText(
          number(telemetry.steering_deg, '°'),
          left + gap,
          valueY,
          usable - gap,
          large ? 40 : 28,
          fg,
          true,
        );
        break;
      }
      case 'turn_signal':
        if (!present) renderText('—', left, valueY, usable, 32, fg);
        else {
          renderText(
            telemetry.left_blinker ? '◀' : '—',
            left,
            valueY,
            usable / 2,
            large ? 40 : 28,
            telemetry.left_blinker && blinkOn ? accent : muted,
          );
          renderText(
            telemetry.right_blinker ? '▶' : '—',
            left + usable / 2,
            valueY,
            usable / 2,
            large ? 40 : 28,
            telemetry.right_blinker && blinkOn ? accent : muted,
          );
        }
        break;
      case 'pedal': {
        const values = present
          ? `${number(telemetry.accel_pct, '%')} / ${braking ? 'ON' : 'OFF'}`
          : '—';
        renderText(values, left, valueY, usable, large ? 38 : 28, fg, true);
        if (cards && present) {
          ctx.fillStyle = '#728280';
          ctx.fillRect(left, y + 131 * scale, usable, 5 * scale);
          ctx.fillStyle = accent;
          ctx.fillRect(
            left,
            y + 131 * scale,
            (usable * Math.max(0, Math.min(100, telemetry.accel_pct))) / 100,
            5 * scale,
          );
        }
        break;
      }
      case 'fsd':
        renderText(
          present && mode ? driveModeLabel(mode, mode, options.newDriveModeLabels) : '—',
          left,
          valueY,
          usable,
          large ? 38 : 28,
          fg,
          true,
        );
        break;
    }
  });
  ctx.restore();
};
