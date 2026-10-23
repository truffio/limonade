import {
  BoxGeometry,
  CanvasTexture,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshToonMaterial,
  SphereGeometry,
  SRGBColorSpace,
  type Sprite,
  type SpriteMaterial,
} from 'three';
import { propCount } from './logic';
import { COLORS, toon } from './palette';
import { labelTexture, makeSprite } from './sprites';

/** How long the « +1,00 $ » pop stays visible after a sale, in seconds. */
const COIN_POP_SECONDS = 0.9;

const STAND_WIDTH = 2.4;
const STRIPES = 6;
const MAX_CUPS = 8;
const MAX_LEMONS = 9;
const COUNTER_TOP = 1.1;

export interface StandStock {
  lemons: number;
  sugar: number;
  ice: number;
  cups: number;
  /** 0..1, how full the pitcher looks. */
  pitcherLevel: number;
}

/**
 * The lemonade stand and the stock you can see on it (ARCHITECTURE.md §9.2):
 * the pitcher empties as cups sell, the cup stack shrinks, the lemon crate,
 * sugar bag and ice box show what is left.
 */
export class StandView {
  readonly group = new Group();
  private readonly liquid: Mesh;
  private readonly cups: Mesh[] = [];
  private readonly lemons: Mesh[] = [];
  private readonly sugarBag: Mesh;
  private readonly iceCubes: Mesh[] = [];
  private readonly signCanvas = document.createElement('canvas');
  private readonly signTexture: CanvasTexture;
  private signText = '';
  private readonly coin: Sprite;
  private coinAge = COIN_POP_SECONDS;

  constructor() {
    const g = this.group;

    const counter = new Mesh(new BoxGeometry(STAND_WIDTH, 1, 1), toon(COLORS.bois));
    counter.position.y = 0.5;
    const top = new Mesh(new BoxGeometry(STAND_WIDTH + 0.2, 0.1, 1.2), toon(COLORS.creme));
    top.position.y = 1.05;
    g.add(counter, top);

    for (const x of [-STAND_WIDTH / 2 + 0.1, STAND_WIDTH / 2 - 0.1]) {
      const post = new Mesh(new BoxGeometry(0.1, 1.5, 0.1), toon(COLORS.bois));
      post.position.set(x, 1.85, -0.4);
      g.add(post);
    }

    const awning = new Group();
    const stripeWidth = (STAND_WIDTH + 0.4) / STRIPES;
    for (let i = 0; i < STRIPES; i++) {
      const stripe = new Mesh(
        new BoxGeometry(stripeWidth, 0.06, 1.5),
        toon(i % 2 === 0 ? COLORS.citron : COLORS.creme),
      );
      stripe.position.x = -(STAND_WIDTH + 0.4) / 2 + stripeWidth * (i + 0.5);
      awning.add(stripe);
    }
    awning.position.set(0, 2.6, 0);
    awning.rotation.x = 0.25;
    g.add(awning);

    // Price sign on the front of the counter.
    this.signCanvas.width = 512;
    this.signCanvas.height = 192;
    this.signTexture = new CanvasTexture(this.signCanvas);
    this.signTexture.colorSpace = SRGBColorSpace;
    const sign = new Mesh(
      new BoxGeometry(1.8, 0.66, 0.04),
      new MeshBasicMaterial({ map: this.signTexture }),
    );
    sign.position.set(0, 0.55, 0.53);
    g.add(sign);

    // Pitcher: a glass with lemonade inside whose height follows the level.
    const glass = new Mesh(
      new CylinderGeometry(0.2, 0.22, 0.5, 20, 1, true),
      new MeshToonMaterial({ color: 0xdff1ff, transparent: true, opacity: 0.45 }),
    );
    glass.position.set(-0.6, COUNTER_TOP + 0.25, 0.1);
    this.liquid = new Mesh(new CylinderGeometry(0.18, 0.2, 0.46, 20), toon(COLORS.citron));
    this.liquid.position.set(-0.6, COUNTER_TOP + 0.23, 0.1);
    g.add(glass, this.liquid);

    const cupGeometry = new CylinderGeometry(0.08, 0.06, 0.16, 12);
    for (let i = 0; i < MAX_CUPS; i++) {
      const cup = new Mesh(cupGeometry, toon(COLORS.corail));
      cup.position.set(-0.15, COUNTER_TOP + 0.08 + i * 0.05, 0.25);
      this.cups.push(cup);
      g.add(cup);
    }

    const crate = new Mesh(new BoxGeometry(0.6, 0.18, 0.4), toon(COLORS.bois));
    crate.position.set(0.55, COUNTER_TOP + 0.09, 0.05);
    g.add(crate);
    const lemonGeometry = new SphereGeometry(0.09, 10, 8);
    for (let i = 0; i < MAX_LEMONS; i++) {
      const lemon = new Mesh(lemonGeometry, toon(COLORS.citron));
      lemon.scale.set(1.2, 1, 1);
      lemon.position.set(
        0.37 + (i % 3) * 0.18,
        COUNTER_TOP + 0.2 + Math.floor(i / 3) * 0.05,
        -0.07 + Math.floor(i / 3) * 0.12,
      );
      this.lemons.push(lemon);
      g.add(lemon);
    }

    this.sugarBag = new Mesh(new BoxGeometry(0.22, 0.3, 0.16), toon(0xffffff));
    this.sugarBag.position.set(0.2, COUNTER_TOP + 0.15, -0.3);
    g.add(this.sugarBag);

    // Ice box on the ground beside the stand.
    const iceBox = new Mesh(new BoxGeometry(0.7, 0.45, 0.5), toon(COLORS.ciel));
    iceBox.position.set(1.65, 0.225, 0.2);
    g.add(iceBox);
    const cubeGeometry = new BoxGeometry(0.12, 0.12, 0.12);
    for (let i = 0; i < 6; i++) {
      const cube = new Mesh(cubeGeometry, toon(0xe6f6ff));
      cube.position.set(1.45 + (i % 3) * 0.2, 0.5, 0.1 + Math.floor(i / 3) * 0.2);
      cube.rotation.y = i * 0.6;
      this.iceCubes.push(cube);
      g.add(cube);
    }

    this.coin = makeSprite(labelTexture('+'), 1.1, 0.42);
    this.coin.position.set(0.25, COUNTER_TOP + 0.9, 0.5);
    this.coin.visible = false;
    g.add(this.coin);

    this.setPrice('');
  }

  /** Pops « +1,00 $ » above the counter; a new sale restarts the animation. */
  popCoin(text: string): void {
    (this.coin.material as SpriteMaterial).map = labelTexture(text);
    this.coinAge = 0;
    this.coin.visible = true;
  }

  update(dt: number): void {
    if (this.coinAge >= COIN_POP_SECONDS) return;
    this.coinAge += dt;
    const f = Math.min(1, this.coinAge / COIN_POP_SECONDS);
    this.coin.position.y = COUNTER_TOP + 0.9 + f * 0.6;
    (this.coin.material as SpriteMaterial).opacity = 1 - f * f;
    if (f >= 1) this.coin.visible = false;
  }

  setStock(stock: StandStock): void {
    const level = Math.min(1, Math.max(0, stock.pitcherLevel));
    this.liquid.visible = level > 0.02;
    this.liquid.scale.y = Math.max(0.02, level);
    this.liquid.position.y = COUNTER_TOP + 0.01 + 0.23 * this.liquid.scale.y;

    const cups = propCount(stock.cups, 5, MAX_CUPS);
    this.cups.forEach((cup, i) => (cup.visible = i < cups));
    const lemons = propCount(stock.lemons, 1, MAX_LEMONS);
    this.lemons.forEach((lemon, i) => (lemon.visible = i < lemons));
    this.sugarBag.visible = stock.sugar > 0;
    this.sugarBag.scale.y = 0.5 + 0.5 * Math.min(1, stock.sugar / 20);
    const cubes = propCount(stock.ice, 10, this.iceCubes.length);
    this.iceCubes.forEach((cube, i) => (cube.visible = i < cubes));
  }

  /** Draws « Limonade » and the price on the counter sign. */
  setPrice(price: string, force = false): void {
    if (!force && price === this.signText && price !== '') return;
    this.signText = price;
    const ctx = this.signCanvas.getContext('2d');
    if (!ctx) return;
    const { width, height } = this.signCanvas;
    ctx.fillStyle = '#ffd93d';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = '#c68b59';
    ctx.lineWidth = 14;
    ctx.strokeRect(7, 7, width - 14, height - 14);
    ctx.fillStyle = '#2b2b2b';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '600 64px Fredoka, system-ui, sans-serif';
    ctx.fillText('Limonade', width / 2, price ? 64 : height / 2);
    if (price) {
      ctx.font = '600 58px Fredoka, system-ui, sans-serif';
      ctx.fillStyle = '#2f8a3c';
      ctx.fillText(price, width / 2, 136);
    }
    this.signTexture.needsUpdate = true;
  }

  dispose(): void {
    this.signTexture.dispose();
  }
}
