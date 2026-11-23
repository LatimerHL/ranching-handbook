import { gsap } from 'gsap';
import { mountHomeParallax } from './home-parallax';

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const detailOffsetInRem = {
  'white-light': 24,
  foreground: 18,
  'background-slimes': 6,
  'distant-slimes': 4,
  bubbles: 2,
};
// The reference poster is 1080 px tall. Map vertical travel onto its half-height for the radial layers.
const referenceRadiusInRem = 1080 / 2 / 16;
type PreparedImage = { placeholder: HTMLImageElement; image: HTMLImageElement };
const preparedHomes = new WeakMap<HTMLElement, { artwork: PreparedImage[]; loaded: boolean }>();
let mountedHero: HTMLElement | undefined;
let entrance: gsap.core.Timeline | undefined;
let unmountParallax: (() => void) | undefined;

function stopKeyArtEntrance() {
  entrance?.revert();
  entrance = undefined;
}

function playKeyArtEntrance(scenes: HTMLElement[]) {
  const layers = (motion: string) => scenes.flatMap(scene => [...scene.querySelectorAll(`[data-motion="${motion}"]`)]);
  const timeline = gsap.timeline({
    paused: true,
    defaults: {
      duration: 2,
      ease: 'elastic.out(1, 0.5)',
    },
    onComplete: () => {
      entrance = undefined;
      for (const scene of scenes) scene.dataset.entrance = 'settled';
    },
  });
  entrance = timeline;
  timeline.timeScale(1.5);

  const settled = { autoAlpha: 1, clearProps: 'transform,opacity,visibility' };
  const zoom = (motion: string, initialScale: number, start: number) => {
    const targets = layers(motion);
    timeline.set(targets, { scaleX: initialScale, scaleY: initialScale, autoAlpha: 0, immediateRender: true }, 0);
    timeline.to(targets, { scaleX: 1, scaleY: 1, ...settled }, start);
  };

  zoom('background', 1 / 1.25, 0);
  const beatrix = layers('beatrix');
  timeline.set(beatrix, { y: '12rem', autoAlpha: 0, immediateRender: true }, 0);
  timeline.to(beatrix, { y: '0rem', ...settled }, 0);
  for (const [motion, offset] of Object.entries(detailOffsetInRem)) {
    // The white spindle light points fade in on their own (see .home-key-art-ray), so they
    // never pop or scale with the rest of the entrance.
    if (motion === 'white-light') continue;
    zoom(motion, 1 - offset / referenceRadiusInRem, .2);
  }

  for (const scene of scenes) scene.dataset.entrance = 'playing';
  timeline.play();
}

function startParallax() {
  if (mountedHero?.querySelector('.home-key-art[data-entrance]') && !reducedMotion.matches && !unmountParallax) {
    unmountParallax = mountHomeParallax(mountedHero);
  }
}

function stopParallax() {
  unmountParallax?.();
  unmountParallax = undefined;
}

async function decodeGraphics(hero: HTMLElement, artwork: HTMLImageElement[], base: string | URL, signal?: AbortSignal) {
  const controls = (hero.dataset.controlImages?.split(' ') ?? []).map(src => {
    const image = new Image();
    image.src = new URL(src, base).href;
    return image;
  });
  const images = [...artwork, ...controls];
  const cancel = () => {
    for (const image of images) image.removeAttribute('src');
  };
  signal?.addEventListener('abort', cancel, { once: true });
  try {
    const results = await Promise.allSettled(images.map(image => image.decode()));
    return results.every(result => result.status === 'fulfilled');
  } finally {
    signal?.removeEventListener('abort', cancel);
  }
}

export async function prepareHomeKeyArt(hero: HTMLElement, destination: URL, signal: AbortSignal) {
  // Decode in the active document and reuse those nodes after the swap, even with an empty cache.
  const artwork = [...hero.querySelectorAll('img[src]')].map(placeholder => {
    const image = document.importNode(placeholder, false);
    image.src = new URL(placeholder.getAttribute('src')!, destination).href;
    return { placeholder, image };
  });
  const loaded = await decodeGraphics(hero, artwork.map(({ image }) => image), destination, signal);
  if (signal.aborted) return;
  for (const { placeholder } of artwork) placeholder.removeAttribute('src');
  hero.ownerDocument.body.removeAttribute('data-page-loading');
  preparedHomes.set(hero, { artwork, loaded });
}

function finishKeyArtLoad(hero: HTMLElement, loaded: boolean) {
  const scenes = [...hero.querySelectorAll<HTMLElement>('.home-key-art')];
  if (!loaded) {
    // Leave the page usable if a graphic fails, without playing an incomplete entrance.
    hero.dataset.loadError = '';
  } else if (reducedMotion.matches) {
    for (const scene of scenes) scene.dataset.entrance = 'settled';
  } else {
    playKeyArtEntrance(scenes);
  }
  hero.removeAttribute('data-loading');
  document.body.removeAttribute('data-page-loading');
  startParallax();
}

async function startKeyArt() {
  const hero = document.querySelector<HTMLElement>('.home-hero');
  if (!hero || hero === mountedHero) return;
  mountedHero = hero;

  const prepared = preparedHomes.get(hero);
  if (prepared) {
    preparedHomes.delete(hero);
    for (const { placeholder, image } of prepared.artwork) placeholder.replaceWith(image);
    finishKeyArtLoad(hero, prepared.loaded);
    return;
  }
  // Both orientations must be ready so a resize during the entrance can switch scenes.
  const loaded = await decodeGraphics(hero, [...hero.querySelectorAll('img')], document.baseURI);
  if (mountedHero === hero && hero.isConnected) finishKeyArtLoad(hero, loaded);
}

startKeyArt();
document.addEventListener('astro:before-swap', () => {
  mountedHero = undefined;
  stopKeyArtEntrance();
  stopParallax();
});
document.addEventListener('astro:after-swap', startKeyArt);
reducedMotion.addEventListener('change', ({ matches }) => {
  if (matches) {
    stopKeyArtEntrance();
    stopParallax();
    for (const scene of mountedHero?.querySelectorAll<HTMLElement>('.home-key-art[data-entrance="playing"]') ?? []) {
      scene.dataset.entrance = 'settled';
    }
  } else {
    startParallax();
  }
});
