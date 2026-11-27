// A poke makes a slime wobble like jelly: it gives, it overshoots, it settles.
//
// The squash pivots on a horizontal line through the sprite -- the line through the eyes, or the
// chicken's claws -- which is why the animation runs on the `.home-key-art-jelly` layer instead of
// the piece: the piece carries the geometry, the portrait rotation and the idle breathing, and the
// jelly layer only ever scales around that line.
// The give is quick and the sway back is slower, so the easing sits on the segments instead of on
// the whole animation: a single global ease would warp the offsets below into a different dance.
// A piece that is still wobbling, or still answering, ignores the poke instead of restarting: both
// effects share the same one-poke-at-a-time rule in `./slime-poke`.
import { blocked, hold, release } from './slime-poke';

const give = 'cubic-bezier(.2, .85, .3, 1)';
const settle = [
  { transform: 'scale(1, 1)', offset: 0, easing: give },
  { transform: 'scale(1.12, 0.84)', offset: 0.12, easing: give },
  { transform: 'scale(0.94, 1.09)', offset: 0.3, easing: give },
  { transform: 'scale(1.05, 0.96)', offset: 0.5, easing: give },
  { transform: 'scale(0.98, 1.02)', offset: 0.72, easing: give },
  { transform: 'scale(1, 1)', offset: 1 },
];
const settleMs = 620;

export function mountSlimeJelly(hero: HTMLElement): () => void {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const running = new Map<Element, Animation>();

  const onClick = (event: MouseEvent) => {
    if (reducedMotion.matches) return;
    // The artwork only becomes clickable once the entrance has handed the scene over.
    if (document.body.hasAttribute('data-page-loading')) return;

    const target = event.target;
    if (!(target instanceof Element)) return;
    const piece = target.closest('[data-jelly]');
    if (!piece) return;
    // Mid-wobble, or still answering: either way this poke is spent before it starts.
    if (blocked(event, piece)) return;
    const body = piece.querySelector<HTMLElement>('.home-key-art-jelly');
    if (!body) return;

    running.get(body)?.cancel();
    const animation = body.animate(settle, { duration: settleMs, easing: 'linear' });
    running.set(body, animation);
    hold(piece, 'jelly');
    const done = () => {
      release(piece, 'jelly');
      if (running.get(body) === animation) running.delete(body);
    };
    // `finished` rejects when the animation is cancelled, and the unmount path cancels them all.
    animation.addEventListener('finish', done);
    animation.addEventListener('cancel', done);
  };

  hero.addEventListener('click', onClick);

  return () => {
    hero.removeEventListener('click', onClick);
    running.forEach(animation => animation.cancel());
    running.clear();
  };
}
