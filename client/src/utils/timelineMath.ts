export const roundToFrame = (value: number, fps = 30): number => {
  const frame = 1 / fps;
  return Math.round(value / frame) * frame;
};

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const nearestBeat = (value: number, beatMarkers: number[]): number => {
  if (!beatMarkers.length) return value;
  return beatMarkers.reduce((closest, beat) => {
    return Math.abs(beat - value) < Math.abs(closest - value) ? beat : closest;
  }, beatMarkers[0]);
};
