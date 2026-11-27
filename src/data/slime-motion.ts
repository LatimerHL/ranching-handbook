// Ambient motion: the parts that move on their own, without being touched.
//
// Every part is drawn on the full sprite canvas, so the point it should turn around is where it
// leaves the body -- measured from the artwork (the part's pixel closest to the body's centre of
// mass) and stored as canvas-relative fractions. Those numbers are the transform-origin of the layer,
// which is why a wing folds from its shoulder instead of spinning around the middle of the frame.
//
// `angle` is the swing to each side in degrees; the sign picks which way the part leans first, so a
// mirrored pair (left and right wing) fans out together instead of sliding as one block. `period` is
// one full there-and-back cycle and `offset` shifts it, which keeps the parts from ticking in step.
export type PartMotion = {
  /** Layer name, as it sits in `slimeRigs`. */
  part: string;
  /** `flap` for bat wings, `beat` for butterfly wings, `sway` for anything that hangs, `lure` for the
   *  angler's lamp, `twitch` for ears. */
  kind: 'flap' | 'beat' | 'sway' | 'lure' | 'squish' | 'twitch';
  angle: number;
  /** One full cycle, ms. Unused by `twitch`, which is scheduled by script. */
  period: number;
  /** ms; negative starts the cycle part-way through. */
  offset: number;
  /** Pivot in canvas-relative fractions. */
  origin: [number, number];
  /**
   * `beat` only: how far the wing turns away from the viewer at the top of the stroke, in degrees,
   * signed so the outer edge recedes. The turn runs under `perspective`, so the wing narrows towards
   * its tip the way a wing turning edge-on does -- a plain scale would just slide it sideways.
   */
  turn?: number;
  /** Vertical stretch at the top of a beat: a wing turning edge-on gets taller, not just narrower. */
  stretch?: number;
  /**
   * `beat` only: fold the wing along a crease inside its own span, the way a page turns. `at` is the
   * crease position as a canvas-relative fraction of x, `side` says which side of the crease is the
   * moving flap. The renderer draws the wing twice -- the static half and the flap -- and rotates the
   * flap 180 degrees about the crease, so the outer half really does flip onto the inner half.
   */
  fold?: { at: number; side: 'left' | 'right' };
  /**
   * Split the part at this canvas-relative y and animate only what lies below the line. The layer is
   * drawn twice: the top half stays exactly as painted, the bottom half carries the motion with its
   * pivot on the split, so the seam never moves. Use this when the thing that should move is the far
   * end of one big shape (a body whose head must stay put while its tail swings).
   */
  clip?: number;
};

export const partMotions: Record<string, PartMotion[]> = {
  'foreground/slimes/batty-slime.webp': [
    // The wings are a pair: opposite signs lift both tips at once and drop them together. wing1 turns on
    // the corner at its bottom right -- where the redrawn blade tucks under the body -- so the whole blade
    // swings out of that corner instead of sliding along the flank.
    { part: 'wing1', kind: 'flap', angle: 8, period: 1500, offset: 0, origin: [0.1455, 0.4831] },
    { part: 'wing2', kind: 'flap', angle: -8, period: 1500, offset: -70, origin: [0.6826, 0.6348] },
    // Ears twitch from the point where they leave the head's silhouette: everything inside that rim is
    // painted behind the body, so the hinge keeps the visible seam still and only the tip flicks. The
    // angle stays small on purpose -- a rigid ear sprite can only pivot on a point, so a wide swing slides
    // the base along the rim and opens a sliver of sky; ~5 degrees moves the tip visibly and the seam by
    // barely a pixel.
    { part: 'ear1', kind: 'twitch', angle: 5, period: 0, offset: 0, origin: [0.2217, 0.2472] },
    { part: 'ear2', kind: 'twitch', angle: 4.5, period: 0, offset: 0, origin: [0.7174, 0.6517] },
  ],
  'foreground/slimes/flutter-slime.webp': [
    // A butterfly beats like a page turning: each wing yaws about the line where it meets the body, so it
    // narrows, darkens and grows taller as it turns away. The hinge stays put -- folding further out would
    // tear the wing away from the body and leave a gap along its base.
    // The art already carries the perspective: the left wing is drawn face-on (95x111 px) and the right
    // one foreshortened to 38x115, which is a wing seen at roughly 64 degrees. A beat therefore has to
    // turn both wings the same way in depth -- the near wing narrows, the far one opens up -- instead of
    // mirroring the angle, which would drive the already edge-on wing past the camera and flatten it.
    // Two motions added up: an in-plane lift that carries each wing tip up along the arc the wings travel,
    // and a small yaw so the wing turns away as it rises. Both wings rise (mirrored lift), while the yaw
    // keeps one shared depth direction so the near wing narrows and the far one opens.
    // Hinge sits on the seam where each wing leaves the body (left wing's inner edge x 0.40, right wing's
    // inner edge x 0.74), at the wing's mid height: the vertical door axis drawn on the reference.
    // Each axis sits at the outer end of its contact patch, so the whole blade lies on the outside of the
    // hinge: the edge that meets the body stays put and only the free edge swings.
    { part: 'wing1', kind: 'beat', angle: 0, period: 2400, offset: 0, origin: [0.435, 0.5785], turn: 40 },
    { part: 'wing2', kind: 'beat', angle: 0, period: 2400, offset: 0, origin: [0.72, 0.452], turn: -40 },
  ],
  'background-slimes/angler-slime.webp': [
    { part: 'sidefin1', kind: 'sway', angle: 6, period: 2600, offset: -400, origin: [0.1126, 0.3265] },
    { part: 'sidefin2', kind: 'sway', angle: -7, period: 3100, offset: -1500, origin: [0.7351, 0.8367] },
    { part: 'upperfin', kind: 'sway', angle: 5, period: 2300, offset: -900, origin: [0.4967, 0.3333] },
    // The lamp hangs off the stalk: both turn around the stalk's root, the glow a beat behind so the
    // bulb trails the stem the way a weight on a wire does.
    { part: 'light_stick', kind: 'lure', angle: 9, period: 2800, offset: -700, origin: [0.4305, 0.4762] },
    { part: 'light', kind: 'lure', angle: 12, period: 2800, offset: -880, origin: [0.4305, 0.4762] },
  ],
  'background-slimes/ringtail-slime.webp': [
    { part: 'tail', kind: 'sway', angle: 7, period: 3400, offset: -1200, origin: [0.5204, 0.4010] },
    { part: 'ear_left', kind: 'twitch', angle: 12, period: 0, offset: 0, origin: [0.1379, 0.6771] },
    { part: 'ear_top', kind: 'twitch', angle: 10, period: 0, offset: 0, origin: [0.3135, 0.2656] },
  ],
  'foreground/slimes/cotton-slime.webp': [
    { part: 'ear1', kind: 'sway', angle: 5, period: 3000, offset: -500, origin: [0.4729, 0.3453] },
    { part: 'ear2', kind: 'sway', angle: -5, period: 3400, offset: -1400, origin: [0.5613, 0.2964] },
    // Whiskers: two strands a side, and the pair on each cheek swings on one clock, so the two picks share
    // period and offset and only differ slightly in how far they reach; the signs are mirrored
    // left-to-right so both tips rise together.
    { part: 'tentacle1', kind: 'sway', angle: 7, period: 2400, offset: -300, origin: [0.4359, 0.5635] },
    { part: 'tentacle2', kind: 'sway', angle: 6, period: 2400, offset: -300, origin: [0.4387, 0.5896] },
    { part: 'tentacle3', kind: 'sway', angle: -7, period: 2400, offset: -300, origin: [0.8348, 0.4853] },
    { part: 'tentacle4', kind: 'sway', angle: -6, period: 2400, offset: -300, origin: [0.8490, 0.5277] },
  ],
  // Honey is the only body that sags: it leans from just under the crown, so the runny underside keeps
  // lagging behind the crown on a long, slow clock instead of breathing in step with the others.
  'background-slimes/honey-slime.webp': [
    // Split below the face: the head and crown are painted once and never move, and only the belly and
    // tail below the line swing, pivoting on the line itself so the seam cannot open.
    { part: 'body', kind: 'squish', angle: 7.5, period: 4200, offset: 0, origin: [0.5, 0.52], clip: 0.52 },
  ],
};

// A whole body rocking on the same clock as its breathing: same duration and delay, so the lean peaks
// when the chest is fullest instead of drifting against it.
export const bodySway: Record<string, number> = {
  'background-slimes/angler-slime.webp': 2.6,
};
