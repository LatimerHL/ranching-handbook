// A poked slime answers. Each slime has a small library of clips and a click plays one of them at
// random -- never the same clip twice in a row, because the libraries run from two clips to twenty
// and a repeat is the easiest way to make them feel smaller than they are.
//
// A slime that is still talking ignores further pokes at itself: the clip plays to its end, and the
// next poke after that answers as usual. Poking a different slime still interrupts, so the hero
// never stacks two voices on top of each other.
//
// The clips are part of the page-loading step: they are fetched while the loading overlay is up and
// kept as object URLs, so the first poke has nothing to wait for. Clips are small (a few hundred
// kilobytes for the whole hero) and a slime's answer lands on a click, which is exactly the moment
// a network round trip is most visible.

import { slimeVoices } from '../data/slime-voice';

// One element for the whole hero.
type Player = HTMLAudioElement;

// Relative library path (`cotton/vo_cotton_hop_01.m4a`, `shared/...`) -> object URL for the bytes in hand.
export type VoiceClips = Map<string, string>;

export type VoiceLibrary = {
  clips: VoiceClips;
  // Resolves once every clip has settled, so a caller can put the fetch on its own deadline.
  ready: Promise<void>;
  dispose: () => void;
};

const libraryPaths = (): string[] => [...new Set(Object.values(slimeVoices).flat())];

// The clips must not crowd out the artwork that the entrance is waiting for: a handful of requests at
// a time, and low priority where the browser honours it.
const fetchConcurrency = 4;

type NetworkInformation = { saveData?: boolean };

export function preloadSlimeVoices(base: string | URL, signal?: AbortSignal): VoiceLibrary {
  const clips: VoiceClips = new Map();
  const created: string[] = [];
  let disposed = false;

  const dispose = () => {
    disposed = true;
    for (const url of created) URL.revokeObjectURL(url);
    created.length = 0;
    clips.clear();
  };

  // A data-saver user gets the clips on the click that asks for them instead of the page load.
  const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection;
  if (connection?.saveData) {
    return { clips, ready: Promise.resolve(), dispose };
  }

  const pending = libraryPaths();
  const load = async (file: string) => {
    try {
      const response = await fetch(new URL(file, base).href, { signal, priority: 'low' } as RequestInit);
      if (!response.ok || disposed) return;
      const url = URL.createObjectURL(await response.blob());
      if (disposed) {
        URL.revokeObjectURL(url);
        return;
      }
      created.push(url);
      clips.set(file, url);
    } catch {
      // A clip that fails to load stays on the network, and the poke that wants it fetches then.
    }
  };

  const ready = Promise.all(
    Array.from({ length: Math.min(fetchConcurrency, pending.length) }, async () => {
      while (pending.length) await load(pending.shift()!);
    }),
  ).then(() => undefined);

  signal?.addEventListener('abort', dispose, { once: true });

  return { clips, ready, dispose };
}

const pick = (item: string, last: Map<string, string>): string | undefined => {
  const clips = slimeVoices[item];
  if (!clips?.length) return undefined;
  if (clips.length === 1) return clips[0];
  let index = Math.floor(Math.random() * clips.length);
  // Re-roll the one clip that would repeat: a loop over a two-clip library is still random.
  if (clips[index] === last.get(item)) index = (index + 1) % clips.length;
  last.set(item, clips[index]);
  return clips[index];
};

export function mountSlimeVoice(hero: HTMLElement, preloaded?: VoiceClips): () => void {
  const player: Player = new Audio();
  player.preload = 'none';
  const last = new Map<string, string>();
  // Which slime owns the clip in flight. It is claimed as soon as a clip starts, so a poke that lands
  // while the clip is still loading is ignored just like one that lands mid-clip; the claim is given
  // back when the clip ends, or when the browser refuses to play it.
  let speaking: string | undefined;

  const onEnded = () => {
    speaking = undefined;
  };

  const onClick = (event: MouseEvent) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const piece = target.closest<HTMLElement>('[data-voice]');
    if (!piece) return;
    const item = piece.dataset.voice;
    const base = piece.closest<HTMLElement>('.home-key-art')?.dataset.voiceSrc;
    if (!item || !base) return;
    // Let the slime finish what it is saying rather than cutting itself off.
    if (speaking === item) return;
    const file = pick(item, last);
    if (!file) return;

    // The library entry is already relative to the voice root: `cotton/...` for the slime's own
    // clips, `shared/...` for the ones two slimes both use. The load step usually holds the bytes
    // already, so the click only has to start the element.
    const url = preloaded?.get(file) ?? `${base}${file}`;
    // Re-assigning the same source is treated as no change, so a repeat click only rewinds it.
    if (player.src !== url) player.src = url;
    else player.currentTime = 0;
    speaking = item;
    // A rejected play() means the browser refused (no gesture, or a newer clip pre-empted this one);
    // hand the slime back so the next poke can try again.
    void player.play().catch(() => {
      if (speaking === item) speaking = undefined;
    });
    // Let the rest of the page react to the same poke (a mouth, a squash) without knowing about audio.
    piece.dispatchEvent(new CustomEvent('slime-voice', { bubbles: true, detail: { item, file, piece } }));
  };

  player.addEventListener('ended', onEnded);
  hero.addEventListener('click', onClick);

  return () => {
    hero.removeEventListener('click', onClick);
    player.removeEventListener('ended', onEnded);
    speaking = undefined;
    player.pause();
    player.removeAttribute('src');
  };
}
