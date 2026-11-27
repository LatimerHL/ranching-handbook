import { gsap } from 'gsap';
import { mountHomeParallax } from './home-parallax';
import { mountSlimeBlink } from './home-slime-blink';
import { mountSlimeDrip } from './home-slime-drip';
import { mountSlimeJelly } from './home-slime-jelly';
import { mountSlimeTwitch } from './home-slime-twitch';
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
let mountedHero: HTMLElement | undefined;
let mediaLoad: AbortController | undefined;
let entrance: gsap.core.Timeline | undefined;
let unmountParallax: (() => void) | undefined;
let unmountBlink: (() => void) | undefined;
let unmountJelly: (() => void) | undefined;
let unmountTwitch: (() => void) | undefined;
let unmountDrip: (() => void) | undefined;
let unmountVoice: (() => void) | undefined;

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
  if (mountedHero && !reducedMotion.matches && !unmountParallax) {
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

function startJelly() {
  if (mountedHero && !unmountJelly) unmountJelly = mountSlimeJelly(mountedHero);
}

function stopJelly() {
  unmountJelly?.();
  unmountJelly = undefined;
}

// Ears flick on their own schedule; the timer only starts once the scene is on screen.
function startTwitch() {
  if (mountedHero && !unmountTwitch) unmountTwitch = mountSlimeTwitch(mountedHero);
}

function stopTwitch() {
  unmountTwitch?.();
  unmountTwitch = undefined;
}

// Drips fall on their own schedule; the timer only starts once the scene is on screen.
function startDrip() {
  if (mountedHero && !unmountDrip) unmountDrip = mountSlimeDrip(mountedHero);
}

function stopDrip() {
  unmountDrip?.();
  unmountDrip = undefined;
}

function startVoice(voices?: VoiceLibrary) {
  if (mountedHero && !unmountVoice) {
    unmountVoice = mountSlimeVoice(mountedHero, voices?.clips);
  }
}

function stopVoice() {
  unmountVoice?.();
  unmountVoice = undefined;
}

function startVoicePreload(hero: HTMLElement, signal: AbortSignal) {
  const source = hero.querySelector<HTMLElement>('.home-key-art')?.dataset.voiceSrc;
  if (!source) return undefined;
  try {
    return preloadSlimeVoices(new URL(source, document.baseURI), signal);
  } catch {
    return undefined;
  }
}

const voiceGraceMs = 8000;

// Give audio time to finish after the artwork is ready. A stalled clip can continue in the
// background after this deadline, and the click handler can still fetch it on demand.
function settleVoice(voices: VoiceLibrary | undefined, signal: AbortSignal) {
  if (!voices || signal.aborted) return Promise.resolve();
  return new Promise<void>(resolve => {
    const done = () => {
      window.clearTimeout(timer);
      signal.removeEventListener('abort', done);
      resolve();
    };
    const timer = window.setTimeout(done, voiceGraceMs);
    signal.addEventListener('abort', done, { once: true });
    void voices.ready.then(done);
  });
}

async function decodeGraphics(hero: HTMLElement, signal: AbortSignal) {
  const images = [...hero.querySelectorAll<HTMLImageElement>('.home-key-art img')];
  const cancel = () => {
    for (const image of images) image.removeAttribute('src');
  };
  signal.addEventListener('abort', cancel, { once: true });
  try {
    const results = await Promise.allSettled(images.map(image => image.decode()));
    return results.every(result => result.status === 'fulfilled');
  } finally {
    signal.removeEventListener('abort', cancel);
  }
}

function finishKeyArtLoad(hero: HTMLElement, loaded: boolean, voices?: VoiceLibrary) {
  for (const rig of hero.querySelectorAll('[data-rig-pending]')) rig.removeAttribute('data-rig-pending');
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
  startBlink();
  startJelly();
  startTwitch();
  startDrip();
  startVoice(voices);
}

async function startKeyArt() {
  const hero = document.querySelector<HTMLElement>('.home-hero');
  if (!hero || hero === mountedHero) return;
  mountedHero = hero;
  mediaLoad = new AbortController();
  const { signal } = mediaLoad;
  startParallax();
  // Both orientations must be ready so a resize during the entrance can switch scenes.
  const voices = startVoicePreload(hero, signal);
  const loaded = await decodeGraphics(hero, signal);
  await settleVoice(voices, signal);
  if (!signal.aborted && hero.isConnected) finishKeyArtLoad(hero, loaded, voices);
}

startKeyArt();
document.addEventListener('astro:before-swap', () => {
  mountedHero = undefined;
  stopKeyArtEntrance();
  stopParallax();
  stopBlink();
  stopJelly();
  stopTwitch();
  stopDrip();
  stopVoice();
  mediaLoad?.abort();
  mediaLoad = undefined;
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
