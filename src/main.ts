import { deriveStats } from "../shared/calendar";
import { USERNAME_PATTERN, type CityData } from "../shared/types";
import { fetchCityData, CityRequestError, shareUrlFor, usernameFromLocation } from "./data/github";
import { createScene } from "./scene/createScene";
import { createEnvironment } from "./scene/environment";
import { createParticles } from "./scene/particles";
import { createCameraRig } from "./scene/camera";
import { createCity } from "./scene/city";
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
    const next = !cameraRig.cinematic();
    cameraRig.setCinematic(next);
    controls.setCinematic(next);
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

function setMode(mode: "idle" | "loading" | "ready" | "error") {
  document.body.classList.remove("is-idle", "is-loading", "is-ready", "is-error");
  document.body.classList.add(`is-${mode}`);
}

async function loadUser(raw: string, fromUrl = false) {
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

  building = true;
  search.setUsername(username);
  search.setBusy(true);
  search.cycleLoading(true);
  setMode("loading");
  city.setLoading(true);
  tooltip.hide();
  renderSelection(null);
  interaction.clear();

  const fetchPromise = fetchCityData(username);
  if (currentData) {
    city.setDays(currentData.days, {
      reducedMotion: context.quality.reducedMotion,
      reverse: true,
    });
  }

  try {
    const [data] = await Promise.all([
      fetchPromise,
      currentData ? wait(context.quality.reducedMotion ? 140 : 780) : wait(280),
    ]);
    currentData = data;
    const size = {
      width: 0,
      depth: 0,
    };
    city.setDays(data.days, { reducedMotion: context.quality.reducedMotion });
    Object.assign(size, city.citySize());
    cameraRig.frameCity(size.width, size.depth, context.quality.isCompact);
    cameraRig.playIntro(context.quality.isCompact);
    if (!context.quality.reducedMotion) {
      cameraRig.setCinematic(true);
      controls.setCinematic(true);
    }
    stats.show(deriveStats(data));
    controls.show();
    window.history.replaceState(
      { user: data.username },
      "",
      `/?user=${encodeURIComponent(data.username)}`,
    );
    const summary = `${data.totalContributions.toLocaleString("en-US")} contributions. ${deriveStats(data).activeDays} active days. One year of code.`;
    search.setStatus(summary);
    setMode("ready");
  } catch (error) {
    const message =
      error instanceof CityRequestError
        ? error.message
        : "Couldn't map that contribution history.";
    search.setStatus(message, true);
    setMode(currentData ? "ready" : "error");
    if (!fromUrl) {
      city.setLoading(false);
    }
  } finally {
    city.setLoading(false);
    search.setBusy(false);
    search.cycleLoading(false);
    building = false;
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
  environment.setPulse(document.body.classList.contains("is-loading") ? 1 : 0.12);
  environment.update(time);
  particles.update(time);
  city.update(time, dt);
  cameraRig.update(dt);
  context.render();
};

loop();
