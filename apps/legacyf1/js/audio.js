
/* Manejo de sonido (SFX). Vanilla: new Audio() por cada efecto.
   `muted` persiste en localStorage; `sfx(name)` ignora si está muteado.
   Autoplay: el primer play puede rechazarse hasta la 1ª interacción, por eso .catch. */
const SFX = {
  click: "assets/audio/click.mp3",
  win: "assets/audio/win.mp3",
  podium: "assets/audio/podium.mp3",
  trophy: "assets/audio/trophy.mp3",
  gp: "assets/audio/gp.mp3",
  transfer: "assets/audio/transfer.mp3",
  injury: "assets/audio/injury.mp3"
};

let muted = localStorage.getItem("muted") === "on";

function sfx(name) {
  if (muted) return;
  const src = SFX[name];
  if (!src) return;
  const a = new Audio(src);
  a.volume = 0.5;
  a.play().catch(() => {});
}

function toggleMute() {
  muted = !muted;
  localStorage.setItem("muted", muted ? "on" : "off");
  return muted;
}
