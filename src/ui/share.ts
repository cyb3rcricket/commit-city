import { shareUrlFor } from "../data/github";
import type { WebGLRenderer } from "three";

let toastTimer: number | undefined;
let toastEl: HTMLParagraphElement | null = null;

export function copyShareLink(username: string): Promise<void> {
  const url = shareUrlFor(username);
  window.history.replaceState({ user: username }, "", `/?user=${encodeURIComponent(username)}`);
  if (!navigator.clipboard?.writeText) {
    return Promise.reject(new Error("Clipboard API unavailable"));
  }
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
  if (!toastEl) {
    toastEl = document.querySelector<HTMLParagraphElement>("#copy-toast");
  }
  if (!toastEl) return;

  if (toastTimer !== undefined) {
    window.clearTimeout(toastTimer);
  }
  toastEl.textContent = message;
  toastEl.hidden = false;
  toastTimer = window.setTimeout(() => {
    if (toastEl) {
      toastEl.hidden = true;
    }
    toastTimer = undefined;
  }, 1800);
}
