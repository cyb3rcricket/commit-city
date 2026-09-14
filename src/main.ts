import { deriveStats } from "../shared/calendar";
import { USERNAME_PATTERN, type CityData } from "../shared/types";
import { fetchCityData, CityRequestError, shareUrlFor, usernameFromLocation } from "./data/github";
import { createScene } from "./scene/createScene";
import { createEnvironment } from "./scene/environment";
import { createParticles } from "./scene/particles";
import { createCameraRig } from "./scene/camera";
import { createCity, LOT, GAP_X, GAP_Z } from "./scene/city";
import { createInteraction } from "./scene/interaction";
import { createSearchUI } from "./ui/search";
import { createTooltip } from "./ui/tooltip";
import { createStatsUI } from "./ui/stats";
import { createControlsUI } from "./ui/controls";
import { captureSkyline, copyShareLink, toast } from "./ui/share";
import { renderSelection } from "./ui/selection";

const canvas = document.querySelector<HTMLCanvasElement>("#stage")!;
const context = createScene(canvas);
requestAnimationFrame(() => context.resize());
const environment = createEnvironment(context.scene, context.quality);
const particles = createParticles(context.scene, context.quality);
const cameraRig = createCameraRig(context.camera, canvas, context.quality);
const city = createCity(context.scene, context.quality);
const search = createSearchUI();
const tooltip = createTooltip();
const stats = createStatsUI();
const controls = createControlsUI({
  onExplore: () => {
    cameraRig.setCinematic(!cameraRig.cinematic());
    controls.setCinematic(cameraRig.cinematic());
  },
  onReset: () => {
    cameraRig.setCinematic(false);
    controls.setCinematic(false);
    cameraRig.reset();
  },
  onShare: async () => {
    if (!currentData) return;
    try {
      await copyShareLink(currentData.username);
      toast("Link copied");
    } catch {
      toast(shareUrlFor(currentData.username));
    }
  },
  onCapture: () => {
    captureSkyline(context.renderer, context.render, currentData?.username ?? "skyline");
  },
});

let currentData: CityData | null = null;
let building = false;
let visible = true;
let loadGen = 0;

const interaction = createInteraction(
  canvas,
  context.camera,
  city,
  {
    onHover(index, event) {
      const day = city.getDay(index);
      if (!day || !day.date || !event) {
        tooltip.hide();
        canvas.style.cursor = "grab";
        return;
      }
      canvas.style.cursor = "pointer";
      tooltip.show(day, event.clientX, event.clientY);
    },
    onSelect(index) {
      renderSelection(city.getDay(index));
    },
  },
);

let currentMode: "idle" | "loading" | "ready" | "error" = "idle";
let lastCinematic = false;

function setMode(mode: "idle" | "loading" | "ready" | "error") {
  currentMode = mode;
  document.body.classList.remove("is-idle", "is-loading", "is-ready", "is-error");
  document.body.classList.add(`is-${mode}`);
}

function stillCurrent(gen: number) {
  return gen === loadGen;
}

async function loadUser(raw: string, _fromUrl = false) {
  const username = raw.trim().replace(/^@/, "");
  if (!username) {
    search.setStatus("Enter a GitHub username.", true);
    return;
  }
  if (!USERNAME_PATTERN.test(username)) {
    search.setStatus("That username doesn't look like a GitHub login.", true);
    setMode(currentData ? "ready" : "error");
    return;
  }
  if (building) return;

  const gen = ++loadGen;
  building = true;
  const started = performance.now();
  search.setUsername(username);
  search.setBusy(true);
  search.cycleLoading(true);
  setMode("loading");
  city.setLoading(true);
  environment.setFocus(1);
  environment.setPulse(1);
  tooltip.hide();
  renderSelection(null);
  interaction.clear();
  stats.hide();
  controls.hide();
  controls.setCinematic(false);

  if (!context.quality.reducedMotion) {
    cameraRig.frameCity(53 * (LOT + GAP_X), 7 * (LOT + GAP_Z), context.quality.isCompact);
    cameraRig.beginApproach(context.quality.isCompact);
  }

  const fetchPromise = fetchCityData(username);
  if (currentData) {
    city.setDays(currentData.days, {
      reducedMotion: context.quality.reducedMotion,
      reverse: true,
    });
  }

  try {
    const data = await fetchPromise;
    if (!stillCurrent(gen)) return;

    if (!context.quality.reducedMotion) {
      const elapsed = performance.now() - started;
      const preRoll = currentData ? 900 : 3000;
      if (elapsed < preRoll) await wait(preRoll - elapsed);
    } else if (currentData) {
      await wait(140);
    }
    if (!stillCurrent(gen)) return;

    currentData = data;
    city.setDays(data.days, { reducedMotion: context.quality.reducedMotion });
    const size = city.citySize();
    cameraRig.frameCity(size.width, size.depth, context.quality.isCompact);
    window.history.replaceState(
      { user: data.username },
      "",
      `/?user=${encodeURIComponent(data.username)}`,
    );

    building = false;
    search.setBusy(false);
    city.setLoading(false);

    const derived = deriveStats(data);
    const summary = `${data.totalContributions.toLocaleString("en-US")} contributions. ${derived.activeDays} active days. One year of code.`;

    if (context.quality.reducedMotion) {
      search.cycleLoading(false);
      search.setStatus(summary);
      stats.show(derived);
      controls.show();
      setMode("ready");
      environment.setFocus(0.45);
      cameraRig.reset();
      return;
    }

    await wait(city.constructionDuration() * 1000);
    if (!stillCurrent(gen)) return;
    cameraRig.beginHero();
    await wait(1350);
    if (!stillCurrent(gen)) return;
    await wait(900);
    if (!stillCurrent(gen)) return;

    search.cycleLoading(false);
    search.setStatus(summary);
    stats.show(derived);
    controls.show();
    setMode("ready");
    environment.setFocus(0.62);
    environment.setPulse(0.08);
    await wait(700);
    if (!stillCurrent(gen)) return;
    cameraRig.beginOrbit();
    controls.setCinematic(true);
  } catch (error) {
    if (!stillCurrent(gen)) return;
    const message =
      error instanceof CityRequestError
        ? error.message
        : "Couldn't map that contribution history.";
    search.cycleLoading(false);
    search.setStatus(message, true);
    setMode(currentData ? "ready" : "error");
    environment.setFocus(currentData ? 0.45 : 0);
    if (currentData) {
      stats.show(deriveStats(currentData));
      controls.show();
    }
  } finally {
    if (stillCurrent(gen)) {
      city.setLoading(false);
      search.setBusy(false);
      building = false;
    }
  }
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

search.onSubmit((username) => {
  void loadUser(username);
});

const initial = usernameFromLocation();
if (initial) {
  search.setUsername(initial);
  void loadUser(initial, true);
}

window.addEventListener("popstate", () => {
  const user = usernameFromLocation();
  if (user) void loadUser(user, true);
});

document.addEventListener("visibilitychange", () => {
  visible = document.visibilityState === "visible";
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    interaction.clear();
    renderSelection(null);
    tooltip.hide();
  }
});

const loop = () => {
  requestAnimationFrame(loop);
  if (!visible) return;
  const dt = Math.min(0.05, context.clock.getDelta());
  const time = context.clock.elapsedTime;
  environment.setPulse(
    currentMode === "loading" ? 0.85 : 0.08,
  );
  environment.update(time);
  particles.update(time);
  city.update(time, dt);
  cameraRig.update(dt);
  const cine = cameraRig.cinematic();
  if (currentMode === "ready" && lastCinematic !== cine) {
    lastCinematic = cine;
    controls.setCinematic(cine);
  }
  context.render();
};

loop();
