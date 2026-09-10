import { MathUtils, Vector3, type PerspectiveCamera } from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { QualityProfile } from "./quality";

export type CameraRig = {
  controls: OrbitControls;
  setCinematic: (on: boolean) => void;
  cinematic: () => boolean;
  playIntro: (compact: boolean) => void;
  reset: () => void;
  frameCity: (width: number, depth: number, compact: boolean) => void;
  update: (dt: number) => void;
  dispose: () => void;
};

function lerpVec(out: Vector3, a: Vector3, b: Vector3, t: number) {
  out.set(
    MathUtils.lerp(a.x, b.x, t),
    MathUtils.lerp(a.y, b.y, t),
    MathUtils.lerp(a.z, b.z, t),
  );
}

export function createCameraRig(
  camera: PerspectiveCamera,
  canvas: HTMLCanvasElement,
  quality: QualityProfile,
): CameraRig {
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = !quality.reducedMotion;
  controls.dampingFactor = 0.06;
  controls.minDistance = 8;
  controls.maxDistance = 48;
  controls.minPolarAngle = 0.18;
  controls.maxPolarAngle = Math.PI / 2 - 0.12;
  controls.maxAzimuthAngle = Infinity;
  controls.minAzimuthAngle = -Infinity;
  controls.autoRotate = !quality.reducedMotion;
  controls.autoRotateSpeed = 0.35;
  controls.enablePan = false;
  controls.target.set(0, 0.6, 0);

  const idlePosition = new Vector3(16, 13.5, 22);
  const settlePosition = new Vector3(14.5, 9.8, 16.5);
  const introPosition = new Vector3(22, 18, 28);
  const target = new Vector3(0, 0.8, 0);

  let cinematic = !quality.reducedMotion;
  let intro = 0;
  let introFrom = idlePosition.clone();
  let introTo = settlePosition.clone();
  let introActive = false;
  let userInterrupted = false;

  camera.position.copy(idlePosition);

  const onStart = () => {
    userInterrupted = true;
    introActive = false;
    if (cinematic) {
      cinematic = false;
      controls.autoRotate = false;
    }
  };
  controls.addEventListener("start", onStart);

  const applyFrame = (compact: boolean) => {
    const lift = compact ? 1.15 : 1;
    idlePosition.set(16 * lift, 14.2, 22 * lift);
    settlePosition.set(13.5 * lift, 9.4, 15.8 * lift);
    introPosition.set(21 * lift, 17.5, 27 * lift);
  };

  applyFrame(quality.isCompact);

  return {
    controls,
    cinematic: () => cinematic,
    setCinematic(on: boolean) {
      cinematic = on && !quality.reducedMotion;
      controls.autoRotate = cinematic;
      controls.autoRotateSpeed = cinematic ? 0.55 : 0.32;
      if (cinematic) userInterrupted = false;
    },
    playIntro(compact: boolean) {
      applyFrame(compact);
      if (quality.reducedMotion) {
        camera.position.copy(settlePosition);
        controls.target.copy(target);
        introActive = false;
        return;
      }
      introFrom.copy(introPosition);
      introTo.copy(settlePosition);
      camera.position.copy(introFrom);
      controls.target.copy(target);
      intro = 0;
      introActive = true;
      userInterrupted = false;
      controls.autoRotate = false;
    },
    reset() {
      userInterrupted = false;
      camera.position.copy(settlePosition);
      controls.target.copy(target);
      introActive = false;
      controls.update();
    },
    frameCity(width: number, _depth: number, compact: boolean) {
      const span = Math.max(18, width * 0.62);
      const lift = compact ? 1.18 : 1;
      settlePosition.set(span * 0.42 * lift, 8.6 + span * 0.08, span * 0.48 * lift);
      idlePosition.set(span * 0.5 * lift, 12.5, span * 0.68 * lift);
      introPosition.set(span * 0.62 * lift, 16.5, span * 0.82 * lift);
      target.set(0, 0.7, 0);
      if (!introActive && !userInterrupted) {
        camera.position.copy(cinematic ? idlePosition : settlePosition);
        controls.target.copy(target);
      }
    },
    update(dt: number) {
      if (introActive) {
        intro += dt / 3.2;
        const t = 1 - Math.pow(1 - Math.min(1, intro), 3);
        lerpVec(camera.position, introFrom, introTo, t);
        controls.target.lerp(target, 0.08);
        if (intro >= 1) {
          introActive = false;
          if (cinematic && !userInterrupted) controls.autoRotate = true;
        }
      }
      controls.update();
    },
    dispose() {
      controls.removeEventListener("start", onStart);
      controls.dispose();
    },
  };
}
