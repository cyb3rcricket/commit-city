import { Raycaster, Vector2, type Camera } from "three";
import type { CitySystem } from "./city";

export type InteractionSystem = {
  hovered: () => number;
  selected: () => number;
  clear: () => void;
  dispose: () => void;
};

type Handlers = {
  onHover: (index: number, event: PointerEvent | null) => void;
  onSelect: (index: number) => void;
};

export function createInteraction(
  canvas: HTMLCanvasElement,
  camera: Camera,
  city: CitySystem,
  handlers: Handlers,
): InteractionSystem {
  const raycaster = new Raycaster();
  const pointer = new Vector2();
  let hovered = -1;
  let selected = -1;
  let downIndex = -1;

  const setPointer = (event: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    pointer.set(x * 2 - 1, -(y * 2 - 1));
  };

  const pick = (event: PointerEvent) => {
    setPointer(event);
    raycaster.setFromCamera(pointer, camera);
    return city.pick(raycaster);
  };

  const onMove = (event: PointerEvent) => {
    const index = pick(event);
    if (index !== hovered) {
      hovered = index;
      city.highlight(index);
      handlers.onHover(index, event);
    } else if (index >= 0) {
      handlers.onHover(index, event);
    }
  };

  const onDown = (event: PointerEvent) => {
    downIndex = pick(event);
  };

  const onUp = (event: PointerEvent) => {
    const index = pick(event);
    if (index >= 0 && index === downIndex) {
      selected = selected === index ? -1 : index;
      city.select(selected);
      handlers.onSelect(selected);
    }
    downIndex = -1;
  };

  const onLeave = () => {
    hovered = -1;
    city.highlight(-1);
    handlers.onHover(-1, null);
  };

  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointerleave", onLeave);

  return {
    hovered: () => hovered,
    selected: () => selected,
    clear() {
      hovered = -1;
      selected = -1;
      city.highlight(-1);
      city.select(-1);
      handlers.onHover(-1, null);
      handlers.onSelect(-1);
    },
    dispose() {
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointerleave", onLeave);
    },
  };
}
