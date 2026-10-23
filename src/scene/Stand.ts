import { BoxGeometry, CylinderGeometry, Group, Mesh } from 'three';
import { COLORS, toon } from './palette';

const STAND_WIDTH = 2.4;
const STRIPES = 6;

/** Placeholder lemonade stand: counter, legs, striped awning, and a pitcher. */
export function createStand(): Group {
  const stand = new Group();

  const counter = new Mesh(new BoxGeometry(STAND_WIDTH, 1, 1), toon(COLORS.bois));
  counter.position.y = 0.5;

  const top = new Mesh(new BoxGeometry(STAND_WIDTH + 0.2, 0.1, 1.2), toon(COLORS.creme));
  top.position.y = 1.05;

  const front = new Mesh(new BoxGeometry(1.6, 0.5, 0.05), toon(COLORS.citron));
  front.position.set(0, 0.55, 0.53);

  stand.add(counter, top, front);

  for (const x of [-STAND_WIDTH / 2 + 0.1, STAND_WIDTH / 2 - 0.1]) {
    const post = new Mesh(new BoxGeometry(0.1, 1.4, 0.1), toon(COLORS.bois));
    post.position.set(x, 1.8, -0.4);
    stand.add(post);
  }

  const awning = new Group();
  const stripeWidth = (STAND_WIDTH + 0.4) / STRIPES;
  for (let i = 0; i < STRIPES; i++) {
    const color = i % 2 === 0 ? COLORS.citron : COLORS.creme;
    const stripe = new Mesh(new BoxGeometry(stripeWidth, 0.06, 1.5), toon(color));
    stripe.position.x = -(STAND_WIDTH + 0.4) / 2 + stripeWidth * (i + 0.5);
    awning.add(stripe);
  }
  awning.position.set(0, 2.55, 0);
  awning.rotation.x = 0.25;
  stand.add(awning);

  const pitcher = new Mesh(new CylinderGeometry(0.18, 0.2, 0.45, 16), toon(COLORS.citron));
  pitcher.position.set(-0.5, 1.33, 0.1);
  stand.add(pitcher);

  return stand;
}
