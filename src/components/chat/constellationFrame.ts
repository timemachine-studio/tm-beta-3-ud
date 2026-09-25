import { fibDir, finalizeFrame, makeProj, type Dot, type Line, type ModeFrame } from 'thinking-orbs';

const NODE_COUNT = 13;
const DRAW_SECONDS = 0.4;
const HOLD_SECONDS = 1.2;
const directions = Array.from({ length: NODE_COUNT }, (_, index) => fibDir(index, NODE_COUNT));

// A nearest-neighbour path gives each new stroke an unlit destination.
const path = (() => {
  const order = [0];
  const remaining = new Set(Array.from({ length: NODE_COUNT - 1 }, (_, index) => index + 1));
  while (remaining.size) {
    const from = directions[order[order.length - 1]];
    let next = -1;
    let best = Infinity;
    for (const index of remaining) {
      const to = directions[index];
      const distance = (from[0] - to[0]) ** 2 + (from[1] - to[1]) ** 2 + (from[2] - to[2]) ** 2;
      if (distance < best) { best = distance; next = index; }
    }
    order.push(next);
    remaining.delete(next);
  }
  return order;
})();

export const constellationFrame: ModeFrame = (size, t) => {
  const radius = size * 0.34;
  const project = makeProj(t * 0.46, 0.32 + Math.sin(t * 0.2) * 0.12, size / 2, size / 2, radius);
  const points = directions.map(([x, y, z]) => project(x, y, z));
  const cycle = (NODE_COUNT - 1) * DRAW_SECONDS + HOLD_SECONDS;
  const elapsed = ((t % cycle) + cycle) % cycle;
  const completed = Math.min(NODE_COUNT - 1, Math.floor(elapsed / DRAW_SECONDS));
  const drawing = Math.min(1, (elapsed % DRAW_SECONDS) / DRAW_SECONDS);
  const lit = new Set(path.slice(0, completed + 1));
  const lines: Line[] = [];
  const dots: Dot[] = [];

  for (let segment = 0; segment < NODE_COUNT - 1; segment++) {
    if (segment > completed || (segment === completed && completed === NODE_COUNT - 1)) break;
    const from = points[path[segment]];
    const to = points[path[segment + 1]];
    const progress = segment < completed ? 1 : drawing;
    lines.push({
      x1: from[0], y1: from[1],
      x2: from[0] + (to[0] - from[0]) * progress,
      y2: from[1] + (to[1] - from[1]) * progress,
      white: 0.12,
      a: 0.58 + 0.24 * ((from[2] + to[2] + 2) / 4),
      w: Math.max(0.85, size / 64),
    });
  }

  points.forEach(([x, y, z], index) => {
    const depth = (z + 1) / 2;
    if (lit.has(index)) {
      dots.push({ x, y, z, r: 5.1 + depth, white: 0.02, a: 0.08 });
      dots.push({ x, y, z, r: 2.9 + depth * 0.5, white: 0.02, a: 0.2 });
      dots.push({ x, y, z, r: 1.25 + depth * 0.5, white: 0.02, a: 0.95 });
    } else {
      dots.push({ x, y, z, r: 0.85 + depth * 0.35, white: 0.3, a: 0.5 });
    }
  });

  return finalizeFrame(dots, lines, 0.5);
};

export const stillConstellationFrame: ModeFrame = (size, _t, opts) =>
  constellationFrame(size, 3.2, opts);
