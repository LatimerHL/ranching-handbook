// Where a poke's wobble pivots: a horizontal line through the sprite, as a fraction of its height.
//
// For a slime it is the line through its eyes -- the two eye centres averaged, measured on the eye
// layer the parts ship with -- so the eye line holds still while the belly and the feet swing. The
// chicken has no eyes to speak of, and what it stands on is its claws, so that line comes from the
// two feet instead.
export const slimePivots: Record<string, number> = {
  'background-slimes/angler-slime.webp': 0.677,
  'background-slimes/honey-slime.webp': 0.35,
  'background-slimes/ringtail-slime.webp': 0.49,
  'background-slimes/rock-slime.webp': 0.653,
  'background-slimes/sea-hen.webp': 0.899,
  'foreground/slimes/batty-slime.webp': 0.364,
  'foreground/slimes/flutter-slime.webp': 0.435,
  'foreground/slimes/pink-slime.webp': 0.326,
  'foreground/slimes/cotton-slime.webp': 0.48,
};
