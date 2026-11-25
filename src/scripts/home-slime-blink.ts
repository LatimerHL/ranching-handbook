// The slimes are cut-outs, so nothing moves in their faces unless we move it. A blink is the
// cheapest thing that keeps them from reading as stickers: the lids drop for about a tenth of a
// second, at irregular intervals, and every so often the slime blinks twice in a row.

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

// How long the lids stay down. A real blink is over in well under a fifth of a second; slower than
// this and it reads as a deliberate wink.
const closedMs = 110;
// Rest between the halves of a double blink: far enough apart to be seen as two, close enough to
// read as one gesture.
const doubleGapMs = [140, 230] as const;
// Chance that a blink is followed by a second one.
const doubleChance = 0.28;
// Time to the first blink, counted from the moment the rig is allowed to blink at all.
const firstDelayMs = [1600, 5200] as const;
// Idle time between blinks. Wide and irregular on purpose: an even rhythm is what makes a loop feel
// like a loop.
const idleMs = [3200, 7600] as const;
// Extra rest after a double blink, so doubles do not become a habit.
const restAfterDoubleMs = [900, 1800] as const;
// Distance between the slimes' first blinks. Timers started while the entrance is still running tend
// to wake up in a bunch, and a row of slimes blinking in unison looks choreographed.
const staggerMs = 700;

function between([min, max]: readonly [number, number]) {
  return min + Math.random() * (max - min);
}

type Slime = {
  rig: HTMLElement;
  scene: HTMLElement | null;
  eyes: HTMLElement;
  wink: HTMLElement;
  // The face the slime wears when it is not blinking; whatever the markup shipped with.
  resting: HTMLElement;
  other: HTMLElement;
  inView: boolean;
  settled: boolean;
  running: boolean;
  // Offset added to the first delay so the slimes of a scene never start in step.
  phase: number;
  timer: number | undefined;
};

function showFace(slime: Slime, face: 'resting' | 'blink') {
  const hidden = face === 'blink' ? slime.resting : slime.other;
  const shown = face === 'blink' ? slime.other : slime.resting;
  hidden.removeAttribute('data-visible');
  shown.setAttribute('data-visible', '');
}

export function mountSlimeBlink(hero: HTMLElement): () => void {
  const slimes: Slime[] = [];
  // The first blink of each scene is spaced out; the count restarts per scene so landscape and
  // portrait get the same pattern.
  const perScene = new Map<Element, number>();
  for (const rig of hero.querySelectorAll<HTMLElement>('[data-rig]')) {
    const eyes = rig.querySelector<HTMLElement>('[data-face="eyes"]');
    const wink = rig.querySelector<HTMLElement>('[data-face="wink"]');
    if (!eyes || !wink) continue;
    const scene = rig.closest('.home-key-art');
    const index = perScene.get(scene ?? hero) ?? 0;
    perScene.set(scene ?? hero, index + 1);
    const winking = wink.hasAttribute('data-visible');
    slimes.push({
      rig,
      scene,
      eyes,
      wink,
      resting: winking ? wink : eyes,
      other: winking ? eyes : wink,
      inView: false,
      settled: false,
      running: false,
      phase: index * staggerMs,
      timer: undefined,
    });
  }
  if (!slimes.length) return () => {};

  const clear = (slime: Slime) => {
    if (slime.timer !== undefined) {
      clearTimeout(slime.timer);
      slime.timer = undefined;
    }
    showFace(slime, 'resting');
  };

  const later = (slime: Slime, delay: number, run: () => void) => {
    slime.timer = window.setTimeout(() => {
      slime.timer = undefined;
      run();
    }, delay);
  };

  const blinkOnce = (slime: Slime, then: () => void) => {
    showFace(slime, 'blink');
    later(slime, closedMs, () => {
      showFace(slime, 'resting');
      then();
    });
  };

  const rest = (slime: Slime, delay = between(idleMs)) => {
    later(slime, delay, () => blink(slime));
  };

  const blink = (slime: Slime) => {
    blinkOnce(slime, () => {
      // A rig can fall out of view (or the visitor can ask for less motion) mid-blink. The lids are
      // already back up, so the only thing left to do is stop instead of chaining another one.
      if (!slime.running) return;
      if (Math.random() < doubleChance) {
        later(slime, between(doubleGapMs), () =>
          blinkOnce(slime, () => rest(slime, between(idleMs) + between(restAfterDoubleMs))),
        );
      } else {
        rest(slime);
      }
    });
  };

  // Both scenes are always laid out; the inactive one is only `visibility: hidden`. That is enough
  // to keep it off the screen but not enough for IntersectionObserver, which still reports those
  // rigs as on view, so the hidden scene is filtered out by its computed visibility.
  const painted = (slime: Slime) => !slime.scene || getComputedStyle(slime.scene).visibility === 'visible';

  const allowed = (slime: Slime) =>
    slime.inView &&
    slime.settled &&
    painted(slime) &&
    !reducedMotion.matches &&
    document.visibilityState === 'visible';

  const refresh = (slime: Slime) => {
    const running = allowed(slime);
    if (running === slime.running) return;
    slime.running = running;
    if (running) later(slime, between(firstDelayMs) + slime.phase, () => blink(slime));
    else clear(slime);
  };

  const refreshAll = () => slimes.forEach(refresh);

  // Which scene is painted is decided by `data-layout` on the document, so the orientation switch
  // has to re-evaluate the rigs: their intersection never changes when a scene merely hides.
  const layout = new MutationObserver(refreshAll);
  layout.observe(document.documentElement, { attributes: true, attributeFilter: ['data-layout', 'data-layout-fading'] });

  // A rig is allowed to blink once its scene has finished entering, and only while it is on screen.
  // IntersectionObserver covers scrolling and the off-screen scene; the painted check below covers
  // the scene that is merely hidden.
  const intersection = new IntersectionObserver(entries => {
    for (const entry of entries) {
      const slime = slimes.find(candidate => candidate.rig === entry.target);
      if (!slime) continue;
      slime.inView = entry.isIntersecting;
      refresh(slime);
    }
  });
  for (const slime of slimes) intersection.observe(slime.rig);

  const entrance = new MutationObserver(() => {
    for (const slime of slimes) {
      slime.settled = slime.rig.closest<HTMLElement>('.home-key-art')?.dataset.entrance === 'settled';
      refresh(slime);
    }
  });
  for (const scene of hero.querySelectorAll('.home-key-art')) {
    entrance.observe(scene, { attributes: true, attributeFilter: ['data-entrance'] });
  }
  for (const slime of slimes) {
    slime.settled = slime.rig.closest<HTMLElement>('.home-key-art')?.dataset.entrance === 'settled';
  }

  document.addEventListener('visibilitychange', refreshAll);
  reducedMotion.addEventListener('change', refreshAll);
  refreshAll();

  return () => {
    intersection.disconnect();
    entrance.disconnect();
    layout.disconnect();
    document.removeEventListener('visibilitychange', refreshAll);
    reducedMotion.removeEventListener('change', refreshAll);
    for (const slime of slimes) {
      slime.running = false;
      clear(slime);
    }
  };
}
