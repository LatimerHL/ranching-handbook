// A poke is one gesture with two effects: the wobble and the answer. While either of them is still
// running, further pokes at the same piece are ignored -- a slime that is mid-wobble or mid-sentence
// does not restart itself. Other slimes are unaffected, so two answers can still overlap.
//
// Both effects install their own click listener on the same hero element, and both look at the same
// click event. The decision is therefore taken once per event: the first listener to look records
// whether the piece was busy, and the second reads that answer instead of measuring again after its
// sibling has already claimed the piece (which would make the two effects block each other forever).
const held = new WeakMap<Element, Set<string>>();
const decided = new WeakMap<Event, boolean>();

/** Claim a piece for one of its effects (`jelly`, `voice`) until that effect finishes. */
export function hold(piece: Element, effect: string): void {
  const effects = held.get(piece) ?? new Set<string>();
  effects.add(effect);
  held.set(piece, effects);
}

/** Give the piece back once that effect is over, whether it finished or was torn down. */
export function release(piece: Element, effect: string): void {
  held.get(piece)?.delete(effect);
}

/**
 * True when this click landed on a piece whose wobble or answer has not finished yet. The answer is
 * stored against the event, so the wobble and the answer agree on it within one click.
 */
export function blocked(event: Event, piece: Element): boolean {
  let value = decided.get(event);
  if (value === undefined) {
    value = (held.get(piece)?.size ?? 0) > 0;
    decided.set(event, value);
  }
  return value;
}
