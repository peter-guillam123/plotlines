// One question, one answer, everywhere: is this the compact landscape-phone
// layout? The camera framers (the story player, the director, the overture)
// all reserve padding for the same furniture, so they must agree on when that
// furniture is compact. The test some of them used - innerWidth <= 720 -
// missed every landscape phone (they are 780-930px wide), handing a 390px-tall
// screen desktop-sized padding. This matches the CSS media query the mobile
// layout is actually built on: html.touch + landscape + max-height 560.
export const compactViewport = () =>
  document.documentElement.classList.contains('touch') &&
  matchMedia('(orientation: landscape) and (max-height: 560px)').matches;
