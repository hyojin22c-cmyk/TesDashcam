import { OpenStreetMapTileLoader } from './map-loader';

import type { TelemetryData } from './sei-decoder';

// The prototype artwork contains the road shot above the console. Only the console is rendered.
const ART_WIDTH = 1672;
const ART_HEIGHT = 941;
const CONSOLE_TOP = 586;
export const ROADSTER_HUD_HEIGHT = 356;

let artwork: HTMLImageElement | undefined;

const getArtwork = () => {
  if (!artwork && typeof Image !== 'undefined') {
    artwork = new Image();
    artwork.src = `${import.meta.env.BASE_URL}models/roadster-cockpit-prototype.webp`;
  }
  return artwork;
};

export const prepareRoadsterCockpit = async () => {
  await getArtwork()?.decode();
};

export const drawRoadsterCockpit = (
  ctx: CanvasRenderingContext2D,
  width: number,
  top: number,
  height: number,
  telemetry: TelemetryData,
  showMap: boolean,
) => {
  const art = getArtwork();
  ctx.fillStyle = '#171b1e';
  ctx.fillRect(0, top, width, height);
  if (!art?.naturalWidth) return;

  ctx.drawImage(art, 0, CONSOLE_TOP, ART_WIDTH, ART_HEIGHT - CONSOLE_TOP, 0, top, width, height);

  // Cover the illustrated map, keeping the beveled metal frame from the artwork.
  const xScale = width / ART_WIDTH;
  const yScale = height / (ART_HEIGHT - CONSOLE_TOP);
  ctx.save();
  ctx.translate(0, top);
  ctx.scale(xScale, yScale);
  ctx.beginPath();
  ctx.moveTo(19, 84);
  ctx.lineTo(43, 59);
  ctx.lineTo(349, 59);
  ctx.lineTo(371, 82);
  ctx.lineTo(371, 291);
  ctx.lineTo(350, 313);
  ctx.lineTo(42, 320);
  ctx.lineTo(19, 299);
  ctx.closePath();
  ctx.clip();

  const mapX = 19 * xScale;
  const mapY = 59 * yScale;
  const mapWidth = 352 * xScale;
  const mapHeight = 261 * yScale;
  ctx.scale(1 / xScale, 1 / yScale);
  if (showMap) {
    OpenStreetMapTileLoader.drawMinimap(
      ctx,
      mapX,
      mapY,
      mapWidth,
      mapHeight,
      telemetry.lat,
      telemetry.lon,
      telemetry.heading,
    );
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(mapX, mapY + mapHeight - 27 * yScale, mapWidth, 18 * yScale);
    ctx.fillStyle = '#fff';
    ctx.font = `${Math.max(8, 12 * xScale)}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      '© OpenStreetMap contributors',
      mapX + 27 * xScale,
      mapY + mapHeight - 18 * yScale,
    );
  } else {
    ctx.fillStyle = '#09100f';
    ctx.fillRect(mapX, mapY, mapWidth, mapHeight);
  }
  ctx.restore();
};
