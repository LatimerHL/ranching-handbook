// Every so often a slime flicks one ear. Never both at once -- that would read as a twitch of the
// whole head rather than a shrug -- and never on a fixed beat, so the scene keeps a little surprise
// in it.
//
// The ears carry their pivot and swing as custom properties (see `src/data/slime-motion.ts`); the
// flick reuses the same pivot as the resting sway and only lifts further and snaps back, which is
// what an ear does when a fly lands on it. Ears are the only parts without a stylesheet animation,
// so the script is the sole owner of their `rotate` and needs no arbitration.
// The scheduler keeps one timer per slime instead of one per ear: the choice of ear is made at the
// moment of the flick, so the pair never fires together.
const firstDelayMs = 2600;
const gapMs: [number, number] = [4200, 9000];
const flickMs = 520;
const ease = 'cubic-bezier(.3, .7, .4, 1)';

const between = ([min, max]: [number, number]) => min + Math.random() * (max - min);

/** Reads the swing the stylesheet would use, so the script and the CSS agree on the size. */
const swingOf = (ear: HTMLElement) => {
  const value = parseFloat(getComputedStyle(ear).getPropertyValue('--swing'));
  return Number.isFinite(value) ? value : 10;
};

export function mountSlimeTwitch(hero: HTMLElement): () => void {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const timers = new Set<number>();
  const running = new Set<Animation>();

  const flick = (ear: HTMLElement) => {
    const angle = swingOf(ear);
    const animation = ear.animate([
      { rotate: '0deg', offset: 0, easing: ease },
      { rotate: `${-angle}deg`, offset: 0.18, easing: ease },
      { rotate: `${angle * 0.45}deg`, offset: 0.46, easing: ease },
      { rotate: `${-angle * 0.2}deg`, offset: 0.7, easing: ease },
      { rotate: '0deg', offset: 1 },
    ], { duration: flickMs, easing: 'linear' });
    running.add(animation);
    const done = () => running.delete(animation);
    animation.addEventListener('finish', done);
    animation.addEventListener('cancel', done);
  };

  // One slime, one loop: pick an ear from the pieces that are actually on screen, flick it, then wait
  // a random while. A hidden scene (the other orientation) or a loading page skips the flick but
  // keeps the slot, so nothing piles up behind a hidden page.
  const schedule = (ears: HTMLElement[], owner: HTMLElement, delay: number) => {
    const id = window.setTimeout(() => {
      timers.delete(id);
      const scene = owner.closest('.home-key-art');
      const skipped = reducedMotion.matches
        || document.visibilityState !== 'visible'
        || !ears.length
        || !scene
        || getComputedStyle(scene).visibility !== 'visible';
      if (!skipped) flick(ears[Math.floor(Math.random() * ears.length)]);
      schedule(ears, owner, between(gapMs));
    }, delay);
    timers.add(id);
  };

  const groups = new Map<HTMLElement, HTMLElement[]>();
  hero.querySelectorAll<HTMLElement>('.home-key-art-piece[data-jelly] [data-motion="twitch"]')
    .forEach(ear => {
      const piece = ear.closest<HTMLElement>('.home-key-art-piece');
      if (!piece) return;
      const ears = groups.get(piece) ?? [];
      ears.push(ear);
      groups.set(piece, ears);
    });

  groups.forEach((ears, piece) => schedule(ears, piece, firstDelayMs + between([0, gapMs[1]])));

  return () => {
    timers.forEach(id => window.clearTimeout(id));
    timers.clear();
    running.forEach(animation => animation.cancel());
    running.clear();
    groups.clear();
  };
}
