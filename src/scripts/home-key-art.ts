import { gsap } from 'gsap';
import { mountHomeParallax } from './home-parallax';
import { mountSlimeBlink } from './home-slime-blink';
import { mountSlimeVoice, preloadSlimeVoices, type VoiceLibrary } from './home-slime-voice';

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
type PreparedHome = { artwork: PreparedImage[]; loaded: boolean; voices?: VoiceLibrary };
const preparedHomes = new WeakMap<HTMLElement, PreparedHome>();
let mountedHero: HTMLElement | undefined;
let entrance: gsap.core.Timeline | undefined;
let unmountParallax: (() => void) | undefined;
let unmountBlink: (() => void) | undefined;
let unmountVoice: (() => void) | undefined;
let mountedVoices: VoiceLibrary | undefined;

// The clips travel with the artwork, but they must never hold up the entrance: whatever has arrived
// by the deadline is used, and the rest keeps landing in the same map for later pokes.
const voiceDeadlineMs = 1500;

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

function startBlink() {
  if (mountedHero && !unmountBlink) unmountBlink = mountSlimeBlink(mountedHero);
}

function stopBlink() {
  unmountBlink?.();
  unmountBlink = undefined;
}

function startVoice(voices?: VoiceLibrary) {
  if (mountedHero && !unmountVoice) {
    mountedVoices = voices;
    unmountVoice = mountSlimeVoice(mountedHero, voices?.clips);
  }
}

function stopVoice() {
  unmountVoice?.();
  unmountVoice = undefined;
  mountedVoices?.dispose();
  mountedVoices = undefined;
}

function startVoicePreload(hero: HTMLElement, base: string | URL, signal?: AbortSignal) {
  const source = hero.querySelector<HTMLElement>('.home-key-art')?.dataset.voiceSrc;
  if (!source) return undefined;
  try {
    return preloadSlimeVoices(new URL(source, base), signal);
  } catch {
    return undefined;
  }
}

// The clips ride along with the artwork: they start first, and the overlay waits for them only as
// long as it is waiting for the graphics anyway.
async function settleVoice(voices: VoiceLibrary | undefined, until: Promise<unknown>) {
  if (!voices) return;
  // Ride along with the artwork: audio gets at most as long as the graphics take, so adding it can
  // never make the entrance slower than it was without voices.
  await Promise.race([
    voices.ready,
    until.then(() => undefined),
    new Promise<void>(resolve => setTimeout(resolve, voiceDeadlineMs)),
  ]);
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
  // Start the clips first so they download while the artwork decodes; the overlay never waits longer
  // for a clip than it waits for a graphic.
  const voices = startVoicePreload(hero, destination, signal);
  const artworkDone = decodeGraphics(hero, artwork.map(({ image }) => image), destination, signal);
  const [loaded] = await Promise.all([artworkDone, settleVoice(voices, artworkDone)]);
  if (signal.aborted) return;
  for (const { placeholder } of artwork) placeholder.removeAttribute('src');
  hero.ownerDocument.body.removeAttribute('data-page-loading');
  preparedHomes.set(hero, { artwork, loaded, voices });
}

// A cut-out slime is only meaningful as a whole: revealing it part by part reads as a body that
// lost its head to a wing that has not arrived yet. Each rig therefore stays invisible until every
// one of its own layers has decoded, and then appears in one piece.
const rigRevealFallbackMs = 8000;

function revealRigs(hero: HTMLElement) {
  const rigs = [...hero.querySelectorAll<HTMLElement>('.home-key-art-rig[data-rig-pending]')];
  if (!rigs.length) return;
  const reveal = (rig: HTMLElement) => rig.removeAttribute('data-rig-pending');
  for (const rig of rigs) {
    const layers = [...rig.querySelectorAll('img')];
    Promise.allSettled(layers.map(image => image.decode())).then(() => reveal(rig));
  }
  // Insurance: a layer that never settles must not leave the slime missing for good.
  setTimeout(() => rigs.forEach(reveal), rigRevealFallbackMs);
}

function finishKeyArtLoad(hero: HTMLElement, loaded: boolean, voices?: VoiceLibrary) {
  revealRigs(hero);
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
  startBlink();
  startVoice(voices);
}

async function startKeyArt() {
  const hero = document.querySelector<HTMLElement>('.home-hero');
  if (!hero || hero === mountedHero) return;
  mountedHero = hero;

  const prepared = preparedHomes.get(hero);
  if (prepared) {
    preparedHomes.delete(hero);
    for (const { placeholder, image } of prepared.artwork) placeholder.replaceWith(image);
    finishKeyArtLoad(hero, prepared.loaded, prepared.voices);
    return;
  }
  // Both orientations must be ready so a resize during the entrance can switch scenes.
  const voices = startVoicePreload(hero, document.baseURI);
  const artworkDone = decodeGraphics(hero, [...hero.querySelectorAll('img')], document.baseURI);
  // The live <img> nodes are the ones that paint here, so each rig can land as soon as its own
  // layers are ready instead of waiting for the whole hero.
  revealRigs(hero);
  const [loaded] = await Promise.all([artworkDone, settleVoice(voices, artworkDone)]);
  if (mountedHero === hero && hero.isConnected) finishKeyArtLoad(hero, loaded, voices);
}

startKeyArt();
document.addEventListener('astro:before-swap', () => {
  mountedHero = undefined;
  stopKeyArtEntrance();
  stopParallax();
  stopBlink();
  stopVoice();
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
