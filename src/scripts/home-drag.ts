// The key art is one picture assembled from many <img> sprites, so pressing a slime is also pressing
// an image. Chromium and Safari stop there on their own (see `-webkit-user-drag` in assets/home.css),
// but Firefox has no such property: dragging with the button down starts its native image drag, which
// leaves a ghost of the sprite under the cursor and swallows the click that pokes it.
//
// Cancel the drag on the document instead, in the capture phase, so the guard also covers the sprites
// a client-side navigation swaps in. Only the home hero is claimed: article images stay draggable.
document.addEventListener('dragstart', event => {
  if (!(event.target as Element | null)?.closest?.('.home-hero img')) return;
  event.preventDefault();
}, true);
