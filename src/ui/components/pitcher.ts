import type { Recipe } from '../../core/types';
import { svg } from '../dom';

/**
 * Cartoon pitcher that changes with the recipe: more lemon makes it more
 * yellow, sugar adds sparkles, ice shows cubes. It never shows a score (spec §5).
 */
export function pitcherPreview(recipe: Recipe, maxLemons: number, maxIce: number): SVGElement {
  const lemon = Math.min(1, recipe.lemons / Math.max(1, maxLemons));
  // From pale water to bright lemon yellow.
  const lightness = 92 - 30 * lemon;
  const saturation = 40 + 60 * lemon;
  const liquid = `hsl(50 ${saturation}% ${lightness}%)`;

  const root = svg('svg', {
    viewBox: '0 0 120 140',
    class: 'pichet',
    role: 'img',
    'aria-label': `Pichet : ${recipe.lemons} citrons, ${recipe.sugar} sucres, ${recipe.ice} glaçons`,
  });

  root.append(
    svg('path', { d: 'M22 20 L98 20 L90 130 L30 130 Z', class: 'pichet__verre' }),
    svg('path', { d: 'M26 45 L94 45 L90 128 L30 128 Z', fill: liquid }),
    svg('path', {
      d: 'M98 40 Q118 45 112 75 Q108 92 92 95',
      fill: 'none',
      class: 'pichet__anse',
    }),
  );

  const cubes = Math.min(8, Math.round((recipe.ice / Math.max(1, maxIce)) * 8));
  for (let i = 0; i < cubes; i++) {
    const x = 34 + (i % 4) * 14 + (i >= 4 ? 7 : 0);
    const y = 52 + Math.floor(i / 4) * 14;
    root.append(
      svg('rect', {
        x,
        y,
        width: 11,
        height: 11,
        rx: 2,
        class: 'pichet__glacon',
        transform: `rotate(${((i * 23) % 30) - 15} ${x + 5} ${y + 5})`,
      }),
    );
  }

  const sparkles = Math.min(6, recipe.sugar);
  for (let i = 0; i < sparkles; i++) {
    const x = 38 + ((i * 37) % 44);
    const y = 92 + ((i * 17) % 28);
    root.append(svg('circle', { cx: x, cy: y, r: 2.2, class: 'pichet__sucre' }));
  }

  return root;
}
