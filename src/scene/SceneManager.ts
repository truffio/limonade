import {
  DirectionalLight,
  HemisphereLight,
  Mesh,
  PerspectiveCamera,
  Scene,
  Timer,
  WebGLRenderer,
  type Object3D,
} from 'three';
import { COLORS, disposePalette } from './palette';
import { disposeSpriteTextures } from './sprites';

type Updater = (dt: number, elapsed: number) => void;

/** Longest frame step, so a tab returning from background doesn't jump animations. */
const MAX_DT = 0.1;

/** Vertical field of view on wide screens; tall screens get a wider one so the street stays in view. */
const BASE_FOV = 35;
const MAX_FOV = 62;
const WIDE_ASPECT = 1.2;

export function fovForAspect(aspect: number): number {
  if (aspect >= WIDE_ASPECT) return BASE_FOV;
  return Math.min(MAX_FOV, BASE_FOV * (WIDE_ASPECT / aspect) ** 0.6);
}

/** Owns the three.js renderer, camera, lights and render loop (ARCHITECTURE.md §9). */
export class SceneManager {
  readonly scene = new Scene();
  readonly sunLight = new DirectionalLight(0xffffff, 1.6);
  readonly ambient = new HemisphereLight(0xffffff, COLORS.feuille, 1.2);
  private readonly camera = new PerspectiveCamera(BASE_FOV, 1, 0.1, 100);
  private readonly renderer: WebGLRenderer;
  private readonly timer = new Timer();
  private readonly updaters = new Set<Updater>();
  private readonly resizeObserver: ResizeObserver;
  /** Share of the screen covered by a panel (right side, bottom), so the stand stays clear of it. */
  private focusShift = { x: 0, y: 0 };

  constructor(private readonly container: HTMLElement) {
    this.renderer = new WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.append(this.renderer.domElement);

    this.camera.position.set(5.5, 4.2, 10);
    this.camera.lookAt(0, 1.2, 0.5);
    this.sunLight.position.set(5, 10, 6);
    this.scene.add(this.ambient, this.sunLight);

    this.timer.connect(document);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
  }

  add(...objects: Object3D[]): void {
    this.scene.add(...objects);
  }

  start(): void {
    // requestAnimationFrame already pauses while the tab is hidden.
    this.renderer.setAnimationLoop((timestamp) => {
      this.timer.update(timestamp);
      const dt = Math.min(this.timer.getDelta(), MAX_DT);
      const elapsed = this.timer.getElapsed();
      for (const update of this.updaters) update(dt, elapsed);
      this.renderer.render(this.scene, this.camera);
    });
  }

  stop(): void {
    this.renderer.setAnimationLoop(null);
  }

  /** Registers a per-frame callback. Returns a function that unregisters it. */
  onUpdate(update: Updater): () => void {
    this.updaters.add(update);
    return () => {
      this.updaters.delete(update);
    };
  }

  /**
   * Moves the stand away from panels: left when a panel covers the right side
   * (`x` = share of the width), up when one covers the bottom (`y` = share of the height).
   */
  setFocusShift(x: number, y = 0): void {
    if (x === this.focusShift.x && y === this.focusShift.y) return;
    this.focusShift = { x, y };
    this.resize();
  }

  dispose(): void {
    this.stop();
    this.timer.dispose();
    this.resizeObserver.disconnect();
    this.scene.traverse((object: Object3D) => {
      if (object instanceof Mesh) object.geometry.dispose();
    });
    disposePalette();
    disposeSpriteTextures();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private resize(): void {
    const { clientWidth: width, clientHeight: height } = this.container;
    if (width === 0 || height === 0) return;
    this.camera.aspect = width / height;
    this.camera.fov = fovForAspect(this.camera.aspect);
    const { x, y } = this.focusShift;
    if (x > 0 || y > 0) {
      // Render a slightly larger view and look at the part away from the panel.
      this.camera.setViewOffset(width, height, (width * x) / 2, (height * y) / 2, width, height);
    } else {
      this.camera.clearViewOffset();
    }
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }
}
