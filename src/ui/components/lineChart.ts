import { h, svg } from '../dom';

export interface Series {
  label: string;
  /** CSS colour, e.g. a custom property. */
  color: string;
  values: number[];
}

const WIDTH = 320;
const HEIGHT = 140;
const PAD = { top: 12, right: 12, bottom: 22, left: 52 };

/** Small hand-drawn SVG line chart (ARCHITECTURE.md §10.3: no chart library). */
export function lineChart(
  title: string,
  series: Series[],
  format: (value: number) => string,
  xLabels: string[],
): HTMLElement {
  const all = series.flatMap((s) => s.values);
  const count = Math.max(...series.map((s) => s.values.length), 1);
  let min = Math.min(0, ...all);
  let max = Math.max(...all, 1);
  if (min === max) max = min + 1;
  const pad = (max - min) * 0.08;
  min -= min < 0 ? pad : 0;
  max += pad;

  const innerW = WIDTH - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (count === 1 ? innerW / 2 : (i / (count - 1)) * innerW);
  const y = (v: number) => PAD.top + (1 - (v - min) / (max - min)) * innerH;

  const chart = svg('svg', {
    viewBox: `0 0 ${WIDTH} ${HEIGHT}`,
    class: 'graphique__svg',
    role: 'img',
    'aria-label': title,
  });

  for (const v of [min, (min + max) / 2, max]) {
    chart.append(
      svg('line', {
        x1: PAD.left,
        x2: WIDTH - PAD.right,
        y1: y(v),
        y2: y(v),
        class: 'graphique__grille',
      }),
    );
    const label = svg('text', {
      x: PAD.left - 6,
      y: y(v) + 4,
      class: 'graphique__axe',
      'text-anchor': 'end',
    });
    label.textContent = format(v);
    chart.append(label);
  }
  if (min < 0) {
    chart.append(
      svg('line', {
        x1: PAD.left,
        x2: WIDTH - PAD.right,
        y1: y(0),
        y2: y(0),
        class: 'graphique__zero',
      }),
    );
  }

  const first = xLabels[0];
  const last = xLabels[xLabels.length - 1];
  for (const [i, text] of [
    [0, first],
    [count - 1, last],
  ] as const) {
    if (text === undefined) continue;
    const label = svg('text', {
      x: x(i),
      y: HEIGHT - 6,
      class: 'graphique__axe',
      'text-anchor': i === 0 ? 'start' : 'end',
    });
    label.textContent = text;
    chart.append(label);
  }

  for (const s of series) {
    const points = s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ');
    chart.append(
      svg('polyline', {
        points,
        fill: 'none',
        stroke: s.color,
        'stroke-width': 3,
        'stroke-linejoin': 'round',
      }),
    );
    s.values.forEach((v, i) =>
      chart.append(svg('circle', { cx: x(i), cy: y(v), r: 3.5, fill: s.color })),
    );
  }

  return h(
    'figure',
    { class: 'graphique' },
    h('figcaption', null, title),
    chart,
    series.length > 1
      ? h(
          'div',
          { class: 'graphique__legende' },
          series.map((s) => h('span', null, h('i', { style: `background:${s.color}` }), s.label)),
        )
      : null,
  );
}
