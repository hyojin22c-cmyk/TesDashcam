export const ROADSTER_DECOR_WIDTH = 268;

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
  right: number,
  top: number,
  height: number,
  scale: number,
) => {
  const art = getArtwork();
  if (!art?.naturalWidth) return;

  const left = right - Math.round(ROADSTER_DECOR_WIDTH * scale);
  ctx.drawImage(art, 428, 644, 832, 248, left, top + 66 * scale, 158 * scale, 47 * scale);
  ctx.drawImage(
    art,
    1332,
    589,
    340,
    351,
    right - 105 * scale,
    top + (height - 99 * scale) / 2,
    96 * scale,
    99 * scale,
  );
};
