import { sitePath } from '../site.mjs';

const home = sitePath(import.meta.env.BASE_URL);
const homePaths = [home, home.slice(0, -1), home + 'index.html'];
let clearProgress: (() => void) | undefined;

function revealOrdinaryPage() {
  if (!document.querySelector('.home-hero')) document.body.removeAttribute('data-page-loading');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', revealOrdinaryPage, { once: true });
} else {
  revealOrdinaryPage();
}

function startProgress(signal: AbortSignal) {
  clearProgress?.();
  const bar = document.querySelector<HTMLElement>('#navigation-progress');
  const fill = bar?.querySelector('span');
  if (!bar || !fill || signal.aborted) return;

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let width = .08;
  let stopFill: (() => void) | undefined;
  let fade: Animation | undefined;

  const fillTo = (target: number, duration: number) => {
    stopFill?.();
    const from = width;
    return new Promise<void>(resolve => {
      let start: number | undefined;
      let frame: number;
      const stop = () => {
        cancelAnimationFrame(frame);
        stopFill = undefined;
        resolve();
      };
      const draw = (now: number) => {
        start ??= now;
        const time = Math.min((now - start) / duration, 1);
        const eased = 1 - (1 - time) ** 4;
        width = from + (target - from) * eased;
        fill.style.transform = `scaleX(${width})`;
        if (time === 1) stop();
        else frame = requestAnimationFrame(draw);
      };
      stopFill = stop;
      frame = requestAnimationFrame(draw);
    });
  };

  const show = window.setTimeout(() => {
    bar.hidden = false;
    // The router has no byte total. Reserve the end of the bar for actual readiness.
    if (!reducedMotion) void fillTo(.9, 3600);
  }, 160);
  const clear = () => {
    window.clearTimeout(show);
    signal.removeEventListener('abort', clear);
    if (clearProgress !== clear) return;
    stopFill?.();
    fade?.cancel();
    bar.hidden = true;
    fill.style.removeProperty('transform');
    clearProgress = undefined;
  };
  clearProgress = clear;
  signal.addEventListener('abort', clear, { once: true });

  return async () => {
    if (clearProgress !== clear) return;
    window.clearTimeout(show);
    if (bar.hidden || reducedMotion || document.hidden) {
      clear();
      return;
    }

    try {
      // Start from the last width we drew when switching from waiting to completion.
      await fillTo(1, 140);
      if (clearProgress !== clear) return;
      fade = bar.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: 115,
        easing: 'ease-out',
        fill: 'forwards',
      });
      await fade.finished;
    } catch {
      // A newer navigation can cancel either animation.
    } finally {
      clear();
    }
  };
}

document.addEventListener('astro:before-preparation', event => {
  const loadPage = event.loader;
  event.loader = async () => {
    const completeProgress = startProgress(event.signal);
    try {
      const keyArt = homePaths.includes(event.to.pathname) ? import('./home-key-art').catch(() => undefined) : undefined;
      await loadPage();
      if (event.defaultPrevented || event.signal.aborted) return;
      const hero = event.newDocument.querySelector<HTMLElement>('.home-hero[data-loading]');
      if (hero) {
        const controller = await (keyArt ?? import('./home-key-art').catch(() => undefined));
        if (!event.signal.aborted) await controller?.prepareHomeKeyArt(hero, event.to, event.signal);
      } else {
        // Astro has already fetched and parsed the Markdown-generated HTML.
        event.newDocument.body.removeAttribute('data-page-loading');
      }
    } finally {
      // Finish on the current page before Astro captures it for the transition.
      await completeProgress?.();
    }
  };
});
