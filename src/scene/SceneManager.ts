import {
  Clock,
  Color,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
  type Object3D,
} from 'three';
import { COLORS, disposePalette } from './palette';
import { createStand } from './Stand';
import { createWorld } from './World';

type Updater = (dt: number, elapsed: number) => void;

/** Longest frame step, so a tab returning from background doesn't jump animations. */
const MAX_DT = 0.1;

/** Owns the three.js renderer, camera, and render loop (ARCHITECTURE.md §9). */
export class SceneManager {
  readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(35, 1, 0.1, 100);
  private readonly renderer: WebGLRenderer;
  private readonly clock = new Clock();
  private readonly updaters = new Set<Updater>();
  private readonly resizeObserver: ResizeObserver;

  constructor(private readonly container: HTMLElement) {
    this.renderer = new WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.append(this.renderer.domElement);

    this.scene.background = new Color(COLORS.cielClair);
    this.camera.position.set(6, 4.5, 10);
    this.camera.lookAt(0, 1.2, 0);

    const sun = new DirectionalLight(0xffffff, 1.6);
    sun.position.set(5, 10, 6);
    this.scene.add(new HemisphereLight(0xffffff, COLORS.feuille, 1.2), sun);

    this.scene.add(createWorld(), createStand());

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
  }

  start(): void {
    this.clock.start();
    // requestAnimationFrame already pauses while the tab is hidden.
    this.renderer.setAnimationLoop(() => {
      const dt = Math.min(this.clock.getDelta(), MAX_DT);
      const elapsed = this.clock.elapsedTime;
      for (const update of this.updaters) update(dt, elapsed);
      this.renderer.render(this.scene, this.camera);
    });
  }

  stop(): void {
    this.renderer.setAnimationLoop(null);
    this.clock.stop();
  }

  /** Registers a per-frame callback. Returns a function that unregisters it. */
  onUpdate(update: Updater): () => void {
    this.updaters.add(update);
    return () => {
      this.updaters.delete(update);
    };
  }

  dispose(): void {
    this.stop();
    this.resizeObserver.disconnect();
    this.scene.traverse((object: Object3D) => {
      if (object instanceof Mesh) object.geometry.dispose();
    });
    disposePalette();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private resize(): void {
    const { clientWidth: width, clientHeight: height } = this.container;
    if (width === 0 || height === 0) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }
}
