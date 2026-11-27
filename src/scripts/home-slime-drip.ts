// The honey slime drips. The drops are drawn in the honey artwork as two blobs sitting against the
// body; instead of painting them in place, the rig keeps them out of its layer stack and this script
// drops copies of them from the slime's underside, one at a time, on a loose beat.
//
// A drop is spawned exactly where the artwork drew that blob -- the sprite is added over the whole
// canvas, so its own position is the anchor -- and then falls and fades. Nothing accumulates: each
// drop removes itself when its animation finishes.
const firstDelayMs = 1600;
const gapMs: [number, number] = [1100, 2800];
const fallMs = 1150;
const concurrency = 3;

const between = ([min, max]: [number, number]) => min + Math.random() * (max - min);

export function mountSlimeDrip(hero: HTMLElement): () => void {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const timers = new Set<number>();
  const running = new Set<Animation>();
  const drops = new Set<HTMLElement>();

  const fall = (rig: HTMLElement, source: string) => {
    if (drops.size >= concurrency) return;
    const body = rig.querySelector<HTMLElement>('.home-key-art-jelly');
    if (!body) return;
    const drop = document.createElement('img');
    drop.className = 'home-key-art-drip';
    drop.src = source;
    drop.alt = '';
    drop.setAttribute('aria-hidden', 'true');
    drop.decoding = 'async';
    // Under the slime: a drop leaves from beneath the tail, so the body must paint over it.
    body.prepend(drop);
    drops.add(drop);
    const animation = drop.animate([
      // Even speed from the first frame: any easing on the launch shows up as a lurch followed by a
      // crawl, which reads as the drop stalling on its way out.
      { translate: '0 0', scale: '1', opacity: 1, offset: 0 },
      { translate: '-3% 2.2%', scale: '0.995', opacity: 0.98, offset: 0.12 },
      { translate: '-14.3% 10.23%', scale: '0.97', opacity: 0.62, offset: 0.55 },
      { translate: '-26% 18.6%', scale: '0.93', opacity: 0, offset: 1 },
    ], { duration: fallMs, easing: 'linear' });
    running.add(animation);
    const done = () => {
      running.delete(animation);
      drops.delete(drop);
      drop.remove();
    };
    animation.addEventListener('finish', done);
    animation.addEventListener('cancel', done);
  };

  const schedule = (rig: HTMLElement, sources: string[], delay: number) => {
    const id = window.setTimeout(() => {
      timers.delete(id);
      const scene = rig.closest('.home-key-art');
      const skipped = reducedMotion.matches
        || document.visibilityState !== 'visible'
        || !scene
        || getComputedStyle(scene).visibility !== 'visible'
        || hero.hasAttribute('data-loading');
      if (!skipped) fall(rig, sources[Math.floor(Math.random() * sources.length)]);
      schedule(rig, sources, between(gapMs));
    }, delay);
    timers.add(id);
  };

  hero.querySelectorAll<HTMLElement>('[data-rig="honey"]').forEach(rig => {
    const body = rig.querySelector<HTMLImageElement>('[data-part="body"]');
    const source = body?.getAttribute('src');
    if (!source) return;
    const folder = source.slice(0, source.lastIndexOf('/') + 1);
    schedule(rig, [`${folder}drip1.webp`, `${folder}drip2.webp`], firstDelayMs + between([0, gapMs[1]]));
  });

  return () => {
    timers.forEach(id => window.clearTimeout(id));
    timers.clear();
    running.forEach(animation => animation.cancel());
    running.clear();
    drops.forEach(drop => drop.remove());
    drops.clear();
  };
}
