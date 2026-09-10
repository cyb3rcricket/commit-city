export type ControlsUI = {
  show: () => void;
  hide: () => void;
  setCinematic: (on: boolean) => void;
};

export function createControlsUI(handlers: {
  onExplore: () => void;
  onReset: () => void;
  onShare: () => void;
  onCapture: () => void;
}): ControlsUI {
  const toolbar = document.querySelector<HTMLElement>("#toolbar")!;
  const explore = document.querySelector<HTMLButtonElement>("#btn-explore")!;
  const reset = document.querySelector<HTMLButtonElement>("#btn-reset")!;
  const share = document.querySelector<HTMLButtonElement>("#btn-share")!;
  const capture = document.querySelector<HTMLButtonElement>("#btn-capture")!;

  explore.addEventListener("click", handlers.onExplore);
  reset.addEventListener("click", handlers.onReset);
  share.addEventListener("click", handlers.onShare);
  capture.addEventListener("click", handlers.onCapture);

  return {
    show() {
      toolbar.hidden = false;
    },
    hide() {
      toolbar.hidden = true;
    },
    setCinematic(on: boolean) {
      explore.setAttribute("aria-pressed", String(on));
      explore.textContent = on ? "Stop Cinematic" : "Cinematic View";
    },
  };
}
