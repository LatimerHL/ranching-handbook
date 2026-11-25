/**
 * Voice clips per slime, keyed by the slime's item id -- the same id the rigs in `slime-parts.ts`
 * use, taken from the sprite's file name (`foreground/slimes/cotton-slime.webp` -> `cotton`).
 *
 * Paths are relative to `assets/home-scene/voice/`. The clips are AAC-LC in MP4 containers,
 * encoded at 48 kbps mono from the game's mono WAVs; a clip that more than one slime
 * shares lives in `shared/` once and every user points at that single file. Head and tail
 * silence is trimmed at build time. Clips are fetched during the page-loading step, so the
 * first poke plays from memory.
 */
export const slimeVoices: Record<string, string[]> = {
  angler: ['angler/vo_angler_alarm_02.m4a', 'angler/vo_angler_fear_01.m4a', 'angler/vo_angler_fear_02.m4a'],
  batty: ['batty/vo_batty_refreshed_01.m4a', 'batty/vo_batty_refreshed_02.m4a', 'batty/vo_batty_refreshed_03.m4a', 'batty/vo_batty_refreshed_04.m4a', 'batty/vo_batty_refreshed_06.m4a', 'batty/vo_batty_refreshed_07.m4a', 'batty/vo_batty_refreshed_08.m4a', 'batty/vo_batty_refreshed_09.m4a'],
  cotton: ['cotton/vo_cotton_highjump_02.m4a', 'cotton/vo_cotton_highjump_03.m4a', 'cotton/vo_cotton_highjump_04.m4a', 'cotton/vo_cotton_highjump_06.m4a', 'cotton/vo_cotton_highjump_07.m4a', 'cotton/vo_cotton_highjump_08.m4a', 'cotton/vo_cotton_highjump_11.m4a', 'cotton/vo_cotton_hop_01.m4a', 'cotton/vo_cotton_hop_04.m4a', 'cotton/vo_cotton_hop_05.m4a', 'cotton/vo_cotton_hop_06.m4a', 'cotton/vo_cotton_hop_07.m4a', 'cotton/vo_cotton_hop_09.m4a', 'cotton/vo_cotton_hop_10.m4a', 'cotton/vo_cotton_hop_12.m4a', 'cotton/vo_cotton_hop_14.m4a', 'cotton/vo_cotton_hop_15.m4a', 'cotton/vo_cotton_hop_16.m4a', 'cotton/vo_cotton_leapaway_01.m4a', 'cotton/vo_cotton_leapaway_02.m4a'],
  flutter: ['flutter/vo_flutter_awe_03.m4a', 'flutter/vo_flutter_fun_01.m4a', 'flutter/vo_flutter_fun_02.m4a', 'flutter/vo_flutter_refreshed_03.m4a'],
  honey: ['honey/vo_slime_awe_01.m4a', 'shared/vo_slime_jump_01.m4a', 'shared/vo_slime_refreshed_03.m4a', 'honey/vo_slime_refreshed_05.m4a'],
  pink: ['pink/vo_slime_refreshed_01.m4a', 'pink/vo_slime_refreshed_02.m4a', 'shared/vo_slime_refreshed_03.m4a', 'pink/vo_slime_refreshed_04.m4a', 'pink/vo_slime_refreshed_06.m4a', 'pink/vo_slime_refreshed_07.m4a', 'pink/vo_slime_refreshed_08.m4a', 'pink/vo_slime_refreshed_09.m4a'],
  ringtail: ['ringtail/vo_slime_10.m4a', 'ringtail/vo_slime_fun_01.m4a', 'ringtail/vo_slime_fun_02.m4a', 'shared/vo_slime_jump_01.m4a'],
  rock: ['rock/vo_burn_06.m4a', 'rock/vo_slime_damage_01.m4a', 'rock/vo_slime_damage_02.m4a', 'rock/vo_slime_splat_01.m4a', 'rock/vo_sneeze_06.m4a'],
};
