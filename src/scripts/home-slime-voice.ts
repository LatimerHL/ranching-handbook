// A poked slime answers. Each slime has a small library of clips and a click plays one of them at
// random -- never the same clip twice in a row, because the libraries run from two clips to twenty
// and a repeat is the easiest way to make them feel smaller than they are.
//
// Every slime has its own element, so two pokes on two slimes overlap the way a pen of animals
// would: poking the bat does not cut the rabbit off mid-word. A slime that is still talking ignores
// further pokes at itself, though: its own clip plays to the end, and the next poke after that
// answers as usual.
//
// The clips are part of the page-loading step: they are fetched while the loading overlay is up and
// kept as object URLs, so the first poke has nothing to wait for. Clips are small (a few hundred
// kilobytes for the whole hero) and a slime's answer lands on a click, which is exactly the moment
// a network round trip is most visible.

import { slimeVoices } from '../data/slime-voice';

// Relative library path (`cotton/vo_cotton_hop_01.m4a`, `shared/...`) -> object URL for the bytes in hand.
export type VoiceClips = Map<string, string>;

export type VoiceLibrary = {
  clips: VoiceClips;
  // Resolves once every clip has settled, so a caller can keep the page loading until the audio is in hand.
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
  // One element per slime: separate elements are what lets two answers play at once, and it also
  // means a slime's own clip is never rewound by anything but that slime.
  const players = new Map<string, HTMLAudioElement>();
  const last = new Map<string, string>();
  // Which slimes are still talking. A slime is claimed as soon as its clip starts, so a poke that
  // lands while the clip is still decoding is ignored just like one that lands mid-word; the claim
  // is given back when the clip ends, or when the browser refuses to play it.
  const speaking = new Set<string>();

  const playerFor = (item: string): HTMLAudioElement => {
    let player = players.get(item);
    if (!player) {
      player = new Audio();
      player.preload = 'none';
      players.set(item, player);
    }
    return player;
  };

  const onClick = (event: MouseEvent) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const piece = target.closest<HTMLElement>('[data-voice]');
    if (!piece) return;
    const item = piece.dataset.voice;
    const base = piece.closest<HTMLElement>('.home-key-art')?.dataset.voiceSrc;
    if (!item || !base) return;
    // Let this slime finish what it is saying rather than cutting itself off. Other slimes are
    // untouched: their clips keep playing under this one.
    if (speaking.has(item)) return;
    const file = pick(item, last);
    if (!file) return;

    // The library entry is already relative to the voice root: `cotton/...` for the slime's own
    // clips, `shared/...` for the ones two slimes both use. The load step usually holds the bytes
    // already, so the click only has to start the element.
    const url = preloaded?.get(file) ?? `${base}${file}`;
    const player = playerFor(item);
    // Re-assigning the same source is treated as no change, so a repeat click only rewinds it.
    if (player.src !== url) player.src = url;
    else player.currentTime = 0;
    speaking.add(item);
    const release = () => speaking.delete(item);
    player.addEventListener('ended', release, { once: true });
    // A rejected play() means the browser refused (no gesture, or the element was torn down); hand the
    // slime back so the next poke can try again.
    void player.play().catch(() => {
      player.removeEventListener('ended', release);
      release();
    });
    // Let the rest of the page react to the same poke (a mouth, a squash) without knowing about audio.
    piece.dispatchEvent(new CustomEvent('slime-voice', { bubbles: true, detail: { item, file, piece } }));
  };

  hero.addEventListener('click', onClick);

  return () => {
    hero.removeEventListener('click', onClick);
    for (const player of players.values()) {
      player.pause();
      player.removeAttribute('src');
    }
    players.clear();
    speaking.clear();
  };
}
