/**
 * Layered cut-outs for the slimes on the home key art. Every layer was authored on the same canvas as
 * the flat sprite it replaces, so a rig can stand in for that sprite without touching its placement,
 * scale or rotation -- the layers stay registered to each other, which is what lets one of them move
 * without tearing away from the rest.
 *
 * `layers` runs bottom to top: side fins and tails sit behind the body, ears and crowns in front of it.
 * The two face layers (`eyes`, `wink`) are always drawn last, on top of whatever the face carries.
 */
export type SlimeRig = {
  /** Folder under `assets/home-scene/parts/`. */
  item: string;
  /** Layer file stems, bottom to top, without the face layers. */
  layers: string[];
  /**
   * Layers that stay in the document but out of sight until something animates them in. A rig's
   * layers are still drawn in the order above, so a hidden layer keeps its place in the stack: the
   * ringtail's tongue is tucked behind its lips and only slides out when the mouth opens.
   */
  hidden?: string[];
  /** Face layer shown at rest. Defaults to `eyes`. */
  face?: 'eyes' | 'wink';
};

/**
 * Keyed by the flat sprite a rig replaces, i.e. the `file` field in home-scene*.json.
 *
 * `batty` deliberately rests on its open eyes: the flat artwork has it winking, and that wink is an
 * expression it can hold whenever it blinks -- not the face it needs to advertise all the time.
 */
export const slimeRigs: Record<string, SlimeRig> = {
  'background-slimes/angler-slime.webp': {
    item: 'angler',
    layers: ['sidefin1', 'body', 'sidefin2', 'upperfin', 'light_stick', 'light'],
  },
  'background-slimes/honey-slime.webp': {
    item: 'honey',
    layers: ['drip2', 'body', 'crown', 'drip1'],
  },
  'background-slimes/ringtail-slime.webp': {
    item: 'ringtail',
    // The muzzle layer is the lips; the nose layer is the tongue that pokes out of them. The lips
    // have to paint over the tongue so it can be drawn out from under them, and the tongue itself
    // stays retracted until the mouth opens, which is why the flat face shows no tongue.
    layers: ['tail', 'ear_left', 'ear_top', 'body', 'nose', 'muzzle'],
    hidden: ['nose'],
  },
  'foreground/slimes/batty-slime.webp': {
    item: 'batty',
    layers: ['ear1', 'ear2', 'body', 'wing1', 'wing2'],
    face: 'eyes',
  },
  'foreground/slimes/flutter-slime.webp': {
    item: 'flutter',
    layers: ['wing1', 'wing2', 'body', 'antenna1', 'antenna2'],
  },
  'foreground/slimes/pink-slime.webp': {
    item: 'pink',
    layers: ['body'],
  },
  'foreground/slimes/cotton-slime.webp': {
    item: 'cotton',
    layers: ['ear2', 'body', 'ear1', 'tentacle1', 'tentacle2', 'tentacle3', 'tentacle4'],
  },
};
