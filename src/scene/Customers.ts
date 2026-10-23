import {
  CapsuleGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  type Scene,
  SphereGeometry,
  type Sprite,
  type SpriteMaterial,
} from 'three';
import {
  CUSTOMER_TIMING,
  CUSTOMER_TOTAL,
  customerPhase,
  customerPosition,
  type CustomerPath,
  freeSlot,
} from './logic';
import { COLORS, toon } from './palette';
import { emojiTexture, makeSprite } from './sprites';

const POOL_SIZE = 14;
const SHIRTS = [COLORS.corail, COLORS.ciel, COLORS.feuille, 0xa66cff, 0xff9f43, 0x48c9b0];
/** No green: umbrellas must stand out against the lawn. */
const UMBRELLAS = [COLORS.corail, COLORS.ciel, 0xa66cff, 0xff9f43, COLORS.citron];
const SKIN = [0xf6d2b5, 0xe0ac87, 0xc68642, 0x8d5524, 0xffdbac];

export interface Visit {
  /** Emoji shown in the bubble once the customer reaches the stand. */
  reaction: string;
  /** Whether they leave with a cup of lemonade. */
  bought: boolean;
}

/** Spots along the counter, so customers at the stand don't overlap. */
const STAND_SPOTS = 6;
const SPOT_SPACING = 0.46;

interface Walker {
  root: Group;
  body: Group;
  hat: Mesh;
  umbrella: Group;
  cup: Mesh;
  bubble: Sprite;
  path: CustomerPath;
  visit: Visit;
  age: number;
  busy: boolean;
}

/** Pool of low-poly customers who walk to the stand and react (ARCHITECTURE.md §9.2–9.4). */
export class CustomerCrowd {
  private readonly walkers: Walker[] = [];
  private sunny = true;
  private raining = false;
  private next = 0;

  constructor(scene: Scene) {
    const bodyGeometry = new CapsuleGeometry(0.26, 0.5, 4, 10);
    const headGeometry = new SphereGeometry(0.22, 14, 10);
    const hatGeometry = new CylinderGeometry(0.16, 0.3, 0.14, 14);
    const canopyGeometry = new ConeGeometry(0.75, 0.35, 10);
    const stickGeometry = new CylinderGeometry(0.02, 0.02, 0.9, 6);
    const cupGeometry = new CylinderGeometry(0.07, 0.05, 0.16, 10);

    for (let i = 0; i < POOL_SIZE; i++) {
      const root = new Group();
      const body = new Group();
      const torso = new Mesh(bodyGeometry, toon(SHIRTS[i % SHIRTS.length] ?? COLORS.corail));
      torso.position.y = 0.6;
      const head = new Mesh(headGeometry, toon(SKIN[i % SKIN.length] ?? 0xf6d2b5));
      head.position.y = 1.22;
      const hat = new Mesh(hatGeometry, toon(i % 2 ? COLORS.citron : 0xffffff));
      hat.position.y = 1.42;
      const umbrella = new Group();
      const canopy = new Mesh(canopyGeometry, toon(UMBRELLAS[i % UMBRELLAS.length] ?? COLORS.ciel));
      canopy.position.y = 1.95;
      const stick = new Mesh(stickGeometry, toon(0x555555));
      stick.position.y = 1.5;
      umbrella.add(canopy, stick);
      const cup = new Mesh(cupGeometry, toon(COLORS.corail));
      cup.position.set(0.3, 0.75, 0.1);
      body.add(torso, head, hat, umbrella, cup);

      const bubble = makeSprite(emojiTexture('🙂'), 0.62, 0.62);
      bubble.position.y = 2.2;
      root.add(body, bubble);
      root.visible = false;
      scene.add(root);

      this.walkers.push({
        root,
        body,
        hat,
        umbrella,
        cup,
        bubble,
        path: { direction: 1, standX: 0 },
        visit: { reaction: '🙂', bought: false },
        age: 0,
        busy: false,
      });
    }
  }

  setWeather(sunny: boolean, raining: boolean): void {
    this.sunny = sunny;
    this.raining = raining;
  }

  /** Sends a customer to the stand. Silently skipped when everyone in the pool is busy. */
  spawn(visit: Visit): void {
    const slot = freeSlot(this.walkers.map((w) => w.busy));
    if (slot === null) return;
    const w = this.walkers[slot];
    if (!w) return;
    this.next++;
    w.busy = true;
    w.age = 0;
    w.visit = visit;
    w.path = {
      direction: this.next % 2 === 0 ? 1 : -1,
      standX: ((slot % STAND_SPOTS) - (STAND_SPOTS - 1) / 2) * SPOT_SPACING,
    };
    (w.bubble.material as SpriteMaterial).map = emojiTexture(visit.reaction);
    w.hat.visible = this.sunny && !this.raining;
    w.umbrella.visible = this.raining;
    w.cup.visible = false;
    w.bubble.visible = false;
    w.root.visible = true;
    this.place(w, 0);
  }

  clear(): void {
    for (const w of this.walkers) {
      w.busy = false;
      w.root.visible = false;
    }
  }

  update(dt: number, elapsed: number): void {
    for (const w of this.walkers) {
      if (!w.busy) continue;
      w.age += dt;
      if (customerPhase(w.age) === 'done') {
        w.busy = false;
        w.root.visible = false;
        continue;
      }
      this.place(w, elapsed);
    }
  }

  private place(w: Walker, elapsed: number): void {
    const phase = customerPhase(w.age);
    const { x, z } = customerPosition(w.path, w.age);
    w.root.position.set(x, 0, z);
    const walking = phase !== 'stand';
    w.body.position.y = walking ? Math.abs(Math.sin(elapsed * 10 + w.path.standX)) * 0.07 : 0;
    w.body.rotation.y = phase === 'stand' ? Math.PI : (w.path.direction * Math.PI) / 2;

    const atOrAfterStand = w.age >= CUSTOMER_TIMING.walkIn;
    w.bubble.visible = atOrAfterStand && w.age < CUSTOMER_TOTAL - 0.4;
    w.cup.visible = w.visit.bought && atOrAfterStand;
  }
}
