import {
  ACESFilmicToneMapping,
  Clock,
  Color,
  PCFSoftShadowMap,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Vector2,
  WebGLRenderer,
} from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { SMAAPass } from "three/addons/postprocessing/SMAAPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { detectQuality, type QualityProfile } from "./quality";

export type SceneContext = {
  canvas: HTMLCanvasElement;
  scene: Scene;
  camera: PerspectiveCamera;
  renderer: WebGLRenderer;
  composer: EffectComposer | null;
  clock: Clock;
  quality: QualityProfile;
  resize: () => void;
  render: () => void;
  dispose: () => void;
};

export function createScene(canvas: HTMLCanvasElement): SceneContext {
  const quality = detectQuality();
  const scene = new Scene();
  scene.background = new Color(0x040605);

  const camera = new PerspectiveCamera(40.5, 1, 0.1, 280);
  camera.position.set(18, 16, 24);

  const renderer = new WebGLRenderer({
    canvas,
    antialias: quality.antialias && !quality.bloom,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.98;
  renderer.shadowMap.enabled = false;
  renderer.shadowMap.type = PCFSoftShadowMap;
  renderer.setClearColor(0x040605, 1);

  let composer: EffectComposer | null = null;
  let bloom: UnrealBloomPass | null = null;
  let smaa: SMAAPass | null = null;

  if (quality.bloom) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(
      new Vector2(1, 1),
      quality.bloomStrength,
      quality.bloomRadius,
      quality.bloomThreshold,
    );
    composer.addPass(bloom);
    smaa = new SMAAPass();
    composer.addPass(smaa);
    composer.addPass(new OutputPass());
  }

  const clock = new Clock();

  const resize = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const dpr = quality.dpr;
    camera.aspect = width / Math.max(height, 1);
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    composer?.setSize(width, height);
    bloom?.setSize(width, height);
    smaa?.setSize(width, height);
  };

  resize();
  window.addEventListener("resize", resize);

  return {
    canvas,
    scene,
    camera,
    renderer,
    composer,
    clock,
    quality,
    resize,
    render: () => {
      if (composer) composer.render();
      else renderer.render(scene, camera);
    },
    dispose: () => {
      window.removeEventListener("resize", resize);
      composer?.dispose();
      renderer.dispose();
    },
  };
}
