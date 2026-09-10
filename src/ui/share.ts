import { shareUrlFor } from "../data/github";
import type { WebGLRenderer } from "three";

export function copyShareLink(username: string): Promise<void> {
  const url = shareUrlFor(username);
  window.history.replaceState({ user: username }, "", `/?user=${encodeURIComponent(username)}`);
  return navigator.clipboard.writeText(url);
}

export function captureSkyline(
  renderer: WebGLRenderer,
  render: () => void,
  username: string,
) {
  render();
  const url = renderer.domElement.toDataURL("image/png");
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `commit-city-${username || "skyline"}.png`;
  anchor.click();
}

export function toast(message: string) {
  const el = document.querySelector<HTMLParagraphElement>("#copy-toast")!;
  el.textContent = message;
  el.hidden = false;
  window.setTimeout(() => {
    el.hidden = true;
  }, 1800);
}
