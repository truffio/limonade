import { BoxGeometry, ConeGeometry, CylinderGeometry, Group, Mesh, SphereGeometry } from 'three';
import { COLORS, toon } from './palette';

function createTree(x: number, z: number): Group {
  const tree = new Group();
  const trunk = new Mesh(new CylinderGeometry(0.15, 0.2, 1, 8), toon(COLORS.bois));
  trunk.position.y = 0.5;
  const leaves = new Mesh(new SphereGeometry(0.8, 10, 8), toon(COLORS.feuille));
  leaves.position.y = 1.5;
  tree.add(trunk, leaves);
  tree.position.set(x, 0, z);
  return tree;
}

function createBush(x: number, z: number): Mesh {
  const bush = new Mesh(new ConeGeometry(0.5, 0.9, 7), toon(COLORS.feuille));
  bush.position.set(x, 0.45, z);
  return bush;
}

/** Static backdrop: lawn, sidewalk, and a few trees. */
export function createWorld(): Group {
  const world = new Group();

  const lawn = new Mesh(new BoxGeometry(200, 0.2, 200), toon(COLORS.feuille));
  lawn.position.y = -0.1;

  const sidewalk = new Mesh(new BoxGeometry(200, 0.22, 3), toon(COLORS.trottoir));
  sidewalk.position.set(0, -0.09, 2.5);

  world.add(
    lawn,
    sidewalk,
    createTree(-4.5, -2.5),
    createTree(5, -3.5),
    createBush(-2.6, -1.2),
    createBush(3.2, -1.6),
  );
  return world;
}
