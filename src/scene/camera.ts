import { MathUtils, Vector3, type PerspectiveCamera } from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { QualityProfile } from "./quality";

export type CameraRig = {
  controls: OrbitControls;
  setCinematic: (on: boolean) => void;
  cinematic: () => boolean;
  beginApproach: (compact: boolean) => void;
  frameCity: (width: number, depth: number, compact: boolean) => void;
  beginHero: () => void;
  beginOrbit: () => void;
  reset: () => void;
  update: (dt: number) => void;
  dispose: () => void;
};

type Phase = "idle" | "approach" | "construct" | "toHero" | "hold" | "orbit";

function lerpVec(out: Vector3, a: Vector3, b: Vector3, t: number) {
  out.set(
    MathUtils.lerp(a.x, b.x, t),
    MathUtils.lerp(a.y, b.y, t),
    MathUtils.lerp(a.z, b.z, t),
  );
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function place(radius: number, phi: number, theta: number, look: Vector3): Vector3 {
  return new Vector3(
    look.x + radius * Math.sin(phi) * Math.sin(theta),
    look.y + radius * Math.cos(phi),
    look.z + radius * Math.sin(phi) * Math.cos(theta),
  );
}

export function createCameraRig(
  camera: PerspectiveCamera,
  canvas: HTMLCanvasElement,
  quality: QualityProfile,
): CameraRig {
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = !quality.reducedMotion;
  controls.dampingFactor = 0.08;
  controls.enableZoom = true;
  controls.enablePan = true;
  controls.screenSpacePanning = false;
  controls.zoomToCursor = false;
  controls.rotateSpeed = 0.72;
  controls.zoomSpeed = 0.68;
  controls.panSpeed = 0.7;
  controls.minDistance = 3.4;
  controls.maxDistance = 56;
  controls.minPolarAngle = 0.2;
  controls.maxPolarAngle = Math.PI / 2 - 0.16;
  controls.autoRotate = false;
  controls.autoRotateSpeed = 0.28;

  const look = new Vector3(0, 1.65, 0);
  const idlePosition = new Vector3();
  const watchPosition = new Vector3();
  const constructPosition = new Vector3();
  const heroPosition = new Vector3();

  const from = new Vector3();
  const to = new Vector3();

  let phase: Phase = "idle";
  let cinematic = false;
  let intro = 0;
  let introDuration = 1.5;
  let hold = 0;
  let userInterrupted = false;
  let panLimitX = 28;
  let panLimitZ = 10;
  const heroTarget = new Vector3();

  const layout = (width: number, depth: number, compact: boolean) => {
    const lift = compact ? 1.18 : 1;
    const span = Math.max(24, width);
    look.set(0, compact ? 1.05 : 1.15, 0);
    heroTarget.copy(look);
    idlePosition.copy(place(span * 0.56 * lift, 0.97, 0.5, look));
    watchPosition.copy(place(span * 0.5 * lift, 1.0, 0.54, look));
    constructPosition.copy(place(span * 0.47 * lift, 1.02, 0.56, look));
    heroPosition.copy(place(span * 0.44 * lift, 1.03, 0.58, look));
    panLimitX = width * 0.55 + 5;
    panLimitZ = Math.max(6, depth * 0.9 + 4);
    controls.minDistance = 3.4;
    controls.maxDistance = Math.max(52, span * 1.2);
    if (!userInterrupted) controls.target.copy(look);
  };

  const constrainTarget = () => {
    const target = controls.target;
    target.x = MathUtils.clamp(target.x, -panLimitX, panLimitX);
    target.z = MathUtils.clamp(target.z, -panLimitZ, panLimitZ);
    target.y = heroTarget.y;
    if (camera.position.y < 0.45) camera.position.y = 0.45;
  };

  layout(41, 5, quality.isCompact);
  camera.position.copy(idlePosition);
  controls.target.copy(look);

  const onStart = () => {
    userInterrupted = true;
    phase = "idle";
    if (cinematic) {
      cinematic = false;
      controls.autoRotate = false;
    }
  };
  controls.addEventListener("start", onStart);

  const goTo = (destination: Vector3, duration: number, next: Phase) => {
    from.copy(camera.position);
    to.copy(destination);
    intro = 0;
    introDuration = Math.max(0.2, duration);
    phase = next;
    controls.autoRotate = false;
  };

  return {
    controls,
    cinematic: () => cinematic,
    setCinematic(on: boolean) {
      cinematic = on && !quality.reducedMotion;
      if (!cinematic) {
        controls.autoRotate = false;
        return;
      }
      phase = "orbit";
      controls.autoRotate = true;
    },
    frameCity(width: number, depth: number, compact: boolean) {
      layout(width, depth, compact);
      if (phase === "idle" && !userInterrupted) {
        camera.position.copy(cinematic ? watchPosition : idlePosition);
        controls.target.copy(heroTarget);
      }
    },
    beginApproach(compact: boolean) {
      layout(Math.max(24, 41), 5, compact);
      if (quality.reducedMotion) {
        camera.position.copy(heroPosition);
        controls.target.copy(heroTarget);
        phase = "idle";
        return;
      }
      userInterrupted = false;
      cinematic = false;
      controls.autoRotate = false;
      goTo(watchPosition, 1.45, "approach");
    },
    beginHero() {
      if (quality.reducedMotion) {
        camera.position.copy(heroPosition);
        controls.target.copy(heroTarget);
        phase = "idle";
        return;
      }
      if (userInterrupted) return;
      goTo(heroPosition, 1.35, "toHero");
    },
    beginOrbit() {
      if (quality.reducedMotion || userInterrupted) return;
      cinematic = true;
      phase = "orbit";
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.26;
    },
    reset() {
      userInterrupted = false;
      phase = "idle";
      cinematic = false;
      controls.autoRotate = false;
      camera.position.copy(heroPosition);
      controls.target.copy(heroTarget);
      controls.update();
    },
    update(dt: number) {
      if (userInterrupted) {
        controls.update();
        constrainTarget();
        return;
      }

      if (phase === "approach" || phase === "toHero") {
        intro += dt / introDuration;
        const t = easeOutCubic(Math.min(1, intro));
        lerpVec(camera.position, from, to, t);
        controls.target.lerp(heroTarget, 0.14);
        if (intro >= 1) {
          camera.position.copy(to);
          if (phase === "approach") {
            phase = "construct";
          } else {
            phase = "hold";
            hold = 0;
          }
        }
      } else if (phase === "construct") {
        camera.position.lerp(constructPosition, 1 - Math.pow(0.92, dt * 60));
        controls.target.lerp(heroTarget, 0.08);
      } else if (phase === "hold") {
        hold += dt;
        camera.position.lerp(heroPosition, 0.04);
        controls.target.lerp(heroTarget, 0.06);
      }

      controls.update();
      constrainTarget();
    },
    dispose() {
      controls.removeEventListener("start", onStart);
      controls.dispose();
    },
  };
}
