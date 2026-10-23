import { DataTexture, MeshToonMaterial, NearestFilter, RedFormat } from 'three';

/** Shared bright palette (ARCHITECTURE.md §9.1). */
export const COLORS = {
  citron: 0xffd93d,
  feuille: 0x6bcb77,
  ciel: 0x4d96ff,
  cielClair: 0xbfe3ff,
  corail: 0xff6b6b,
  creme: 0xfff8e7,
  bois: 0xc68b59,
  trottoir: 0xd9d4c7,
} as const;

let gradientMap: DataTexture | null = null;

/** 3-step gradient that gives MeshToonMaterial its cartoon look. */
function getGradientMap(): DataTexture {
  if (!gradientMap) {
    gradientMap = new DataTexture(new Uint8Array([90, 170, 255]), 3, 1, RedFormat);
    gradientMap.minFilter = NearestFilter;
    gradientMap.magFilter = NearestFilter;
    gradientMap.needsUpdate = true;
  }
  return gradientMap;
}

const materials = new Map<number, MeshToonMaterial>();

/** Returns a shared toon material for a color, so identical colors reuse one material. */
export function toon(color: number): MeshToonMaterial {
  let material = materials.get(color);
  if (!material) {
    material = new MeshToonMaterial({ color, gradientMap: getGradientMap() });
    materials.set(color, material);
  }
  return material;
}

export function disposePalette(): void {
  for (const material of materials.values()) material.dispose();
  materials.clear();
  gradientMap?.dispose();
  gradientMap = null;
}
