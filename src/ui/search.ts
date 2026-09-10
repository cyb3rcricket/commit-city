const MESSAGES = [
  "Mapping contributions...",
  "Constructing city...",
  "Building skyline...",
];

export type SearchUI = {
  username: () => string;
  setUsername: (value: string) => void;
  setBusy: (busy: boolean) => void;
  setStatus: (message: string, error?: boolean) => void;
  cycleLoading: (on: boolean) => void;
  onSubmit: (handler: (username: string) => void) => void;
};

export function createSearchUI(): SearchUI {
  const form = document.querySelector<HTMLFormElement>("#search-form")!;
  const input = document.querySelector<HTMLInputElement>("#username")!;
  const button = document.querySelector<HTMLButtonElement>("#build-btn")!;
  const status = document.querySelector<HTMLParagraphElement>("#status-line")!;
  const chips = document.querySelectorAll<HTMLButtonElement>("[data-example]");

  let loadingTimer = 0;
  let submitHandler: (username: string) => void = () => undefined;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    submitHandler(input.value.trim());
  });

  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      const name = chip.dataset.example ?? "";
      input.value = name;
      submitHandler(name);
    });
  });

  return {
    username: () => input.value.trim(),
    setUsername(value: string) {
      input.value = value;
    },
    setBusy(busy: boolean) {
      button.disabled = busy;
      input.disabled = busy;
      button.textContent = busy ? "Mapping..." : "Build My City";
    },
    setStatus(message: string, error = false) {
      status.textContent = message;
      status.classList.toggle("is-error", error);
    },
    cycleLoading(on: boolean) {
      window.clearInterval(loadingTimer);
      if (!on) return;
      let i = 0;
      status.classList.remove("is-error");
      status.textContent = MESSAGES[0];
      loadingTimer = window.setInterval(() => {
        i = (i + 1) % MESSAGES.length;
        status.textContent = MESSAGES[i];
      }, 750);
    },
    onSubmit(handler) {
      submitHandler = handler;
    },
  };
}
