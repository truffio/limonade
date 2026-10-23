import {
  BoxGeometry,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  type Scene,
  SphereGeometry,
} from 'three';
import type { CloudState } from '../core/types';
import { cloudCount, mixHex, skyColor, sunPosition } from './logic';
import { COLORS, toon } from './palette';

const MAX_CLOUDS = 9;
const RAIN_DROPS = 600;
/** Rain falls in a box around the stand; it stays well behind the camera (z = 10) to avoid giant streaks. */
const RAIN_AREA = { x: 26, y: 12, z: 10, centerZ: -1 };

export interface SkyState {
  /** 0 = opening (10 h), 1 = closing (18 h). */
  t: number;
  cloud: CloudState;
  raining: boolean;
}

/** Sky colour, sun arc, drifting clouds and rain (ARCHITECTURE.md §9.2). */
export class SkyView {
  private readonly sun: Mesh;
  private readonly clouds: Group[] = [];
  private readonly rain: InstancedMesh;
  private readonly drops: { x: number; y: number; z: number; speed: number }[] = [];
  private readonly matrix = new Matrix4();
  private readonly background = new Color();
  private state: SkyState = { t: 0.1, cloud: 'soleil', raining: false };
  private visibleClouds = 1;

  constructor(
    private readonly scene: Scene,
    private readonly sunLight: DirectionalLight,
    private readonly ambient: HemisphereLight,
  ) {
    this.sun = new Mesh(
      new SphereGeometry(1.6, 24, 16),
      new MeshBasicMaterial({ color: 0xffe066 }),
    );
    scene.add(this.sun);

    const puff = new SphereGeometry(1, 12, 10);
    const white = toon(0xffffff);
    for (let i = 0; i < MAX_CLOUDS; i++) {
      const cloud = new Group();
      for (const [x, y, s] of [
        [0, 0, 1.2],
        [1.3, -0.2, 0.9],
        [-1.2, -0.25, 0.85],
        [0.5, 0.5, 0.8],
      ] as const) {
        const ball = new Mesh(puff, white);
        ball.position.set(x, y, 0);
        ball.scale.setScalar(s);
        cloud.add(ball);
      }
      cloud.position.set(-22 + i * 5.5, 8 + (i % 3) * 1.6, -14 - (i % 2) * 4);
      cloud.scale.setScalar(0.9 + (i % 3) * 0.25);
      this.clouds.push(cloud);
      scene.add(cloud);
    }

    this.rain = new InstancedMesh(
      new BoxGeometry(0.03, 0.35, 0.03),
      new MeshBasicMaterial({ color: 0x7fa8d6, transparent: true, opacity: 0.7 }),
      RAIN_DROPS,
    );
    for (let i = 0; i < RAIN_DROPS; i++) {
      this.drops.push({
        x: (Math.random() - 0.5) * RAIN_AREA.x,
        y: Math.random() * RAIN_AREA.y,
        z: (Math.random() - 0.5) * RAIN_AREA.z + RAIN_AREA.centerZ,
        speed: 9 + Math.random() * 4,
      });
    }
    this.rain.visible = false;
    scene.add(this.rain);

    this.apply();
  }

  set(state: Partial<SkyState>): void {
    this.state = { ...this.state, ...state };
    this.apply();
  }

  update(dt: number): void {
    for (const [i, cloud] of this.clouds.entries()) {
      if (!cloud.visible) continue;
      cloud.position.x += dt * (0.35 + (i % 3) * 0.12);
      if (cloud.position.x > 26) cloud.position.x = -26;
    }
    if (this.rain.visible) {
      this.drops.forEach((drop, i) => {
        drop.y -= drop.speed * dt;
        if (drop.y < 0) drop.y += RAIN_AREA.y;
        this.matrix.makeTranslation(drop.x, drop.y, drop.z);
        this.rain.setMatrixAt(i, this.matrix);
      });
      this.rain.instanceMatrix.needsUpdate = true;
    }
  }

  private apply(): void {
    const { t, cloud, raining } = this.state;
    this.background.setHex(skyColor(t, cloud, raining));
    this.scene.background = this.background;

    const sun = sunPosition(t);
    this.sun.position.set(sun.x, sun.y, sun.z);
    this.sun.visible = cloud !== 'couvert' && !raining;
    this.sunLight.position.set(sun.x * 0.4, Math.max(3, sun.y), 8);

    const dim = raining ? 0.45 : cloud === 'couvert' ? 0.6 : cloud === 'nuageux' ? 0.85 : 1;
    const evening = Math.max(0, (t - 0.75) / 0.25);
    this.sunLight.intensity = 1.6 * dim;
    this.sunLight.color.setHex(mixHex(0xffffff, 0xffb37a, evening * 0.7));
    this.ambient.intensity = 0.9 + 0.3 * dim;

    this.visibleClouds = cloudCount(cloud, raining);
    const grey = raining ? 0x9aa5b1 : cloud === 'couvert' ? 0xd5dbe1 : 0xffffff;
    this.clouds.forEach((c, i) => {
      c.visible = i < this.visibleClouds;
      for (const child of c.children) {
        if (child instanceof Mesh) child.material = toon(grey);
      }
    });

    this.rain.visible = raining;
    this.ambient.groundColor.setHex(raining ? 0x4f8f58 : COLORS.feuille);
  }
}
