/**
 * TimeMachine Contour - Graph Plotter View
 *
 * Renders a Desmos-style interactive SVG graph inside the Contour panel.
 * - Primary equation comes from the chat input (auto-detected or focused mode).
 * - User can type a 2nd equation directly in the card.
 * - Supports: scroll-to-zoom, drag-to-pan, discontinuity detection.
 */

import React, { useState, useCallback, useMemo, useRef } from 'react';
import { TrendingUp } from 'lucide-react';
import { ModuleData, MODULE_META } from '../moduleRegistry';
import { AccentTheme, HintView } from './shared';

// ─── Math expression parser (Desmos-like notation → JS) ────────────

function parseMathExpr(input: string): string {
  if (!input.trim()) return '';
  let s = input.trim();

  // Strip "y =", "f(x) =", "g(x) =" prefixes
  s = s.replace(/^\s*[yfg]\s*(\(\s*x\s*\))?\s*=\s*/i, '');
  if (!s.trim()) return '';

  // Handle |expr| → abs(expr) iteratively
  let prev = '';
  while (prev !== s) { prev = s; s = s.replace(/\|([^|]+)\|/, 'abs($1)'); }

  // ^ → **
  s = s.replace(/\^/g, '**');

  // Replace functions (longer/specific names first)
  const fns: [RegExp, string][] = [
    [/\bsqrt\b/g,  'Math.sqrt'],  [/\bcbrt\b/g,  'Math.cbrt'],
    [/\bsinh\b/g,  'Math.sinh'],  [/\bcosh\b/g,  'Math.cosh'],  [/\btanh\b/g, 'Math.tanh'],
    [/\basin\b/g,  'Math.asin'],  [/\bacos\b/g,  'Math.acos'],
    [/\batan2\b/g, 'Math.atan2'], [/\batan\b/g,  'Math.atan'],
    [/\bsin\b/g,   'Math.sin'],   [/\bcos\b/g,   'Math.cos'],   [/\btan\b/g,  'Math.tan'],
    [/\babs\b/g,   'Math.abs'],   [/\bsign\b/g,  'Math.sign'],  [/\bhypot\b/g,'Math.hypot'],
    [/\bln\b/g,    'Math.log'],   [/\blog10\b/g, 'Math.log10'], [/\blog2\b/g, 'Math.log2'],
    [/\blog\b/g,   'Math.log10'], [/\bexp\b/g,   'Math.exp'],
    [/\bceil\b/g,  'Math.ceil'],  [/\bfloor\b/g, 'Math.floor'], [/\bround\b/g,'Math.round'],
    [/\btrunc\b/g, 'Math.trunc'], [/\bpow\b/g,   'Math.pow'],
    [/\bmax\b/g,   'Math.max'],   [/\bmin\b/g,   'Math.min'],   [/\bmod\b/g,  '%'],
  ];
  for (const [re, rep] of fns) s = s.replace(re, rep);

  // Constants
  s = s.replace(/\bpi\b/gi, 'Math.PI');
  s = s.replace(/π/g, 'Math.PI');
  s = s.replace(/\be\b/g, 'Math.E');
  s = s.replace(/∞/g, 'Infinity');

  // Implicit multiplication
  s = s.replace(/(\d)(x)(?!\w)/g, '$1*$2');
  s = s.replace(/(\d)\s*\(/g, '$1*(');
  s = s.replace(/\)\s*\(/g, ')*(');
  s = s.replace(/\)\s*x(?!\w)/g, ')*x');
  s = s.replace(/\)\s*(\d)/g, ')*$1');
  s = s.replace(/x\s*\(/g, 'x*(');
  s = s.replace(/(\d)\s*(Math\.)/g, '$1*$2');
  s = s.replace(/\)\s*(Math\.)/g, ')*$2');
  s = s.replace(/x\s*(Math\.)/g, 'x*$2');

  return s;
}

function formatTick(val: number): string {
  if (Math.abs(val) < 1e-10) return '0';
  if (Math.abs(val) >= 10000 || (Math.abs(val) < 0.001 && val !== 0))
    return val.toExponential(1);
  const s = parseFloat(val.toPrecision(5)).toString();
  return s.length > 7 ? val.toPrecision(3) : s;
}

// ─── Inner SVG graph ────────────────────────────────────────────────

const GW = 480, GH = 220;

function GraphCanvas({ eq1, eq2, accent }: { eq1: string; eq2: string; accent: AccentTheme }) {
  const [view, setView] = useState({ cx: 0, cy: 0, scale: 45 });
  const panRef = useRef<{ mx: number; my: number; cx: number; cy: number } | null>(null);

  const toSvgX = useCallback((x: number) => GW / 2 + (x - view.cx) * view.scale, [view]);
  const toSvgY = useCallback((y: number) => GH / 2 - (y - view.cy) * view.scale, [view]);
  const toMathX = useCallback((sx: number) => (sx - GW / 2) / view.scale + view.cx, [view]);
  const toMathY = useCallback((sy: number) => -(sy - GH / 2) / view.scale + view.cy, [view]);

  const buildEval = useCallback((eq: string): ((x: number) => number | null) | null => {
    const js = parseMathExpr(eq);
    if (!js) return null;
    try {
      // eslint-disable-next-line no-new-func
      const fn = new Function('x', `"use strict"; try { const _v=(${js}); return (typeof _v==='number'&&isFinite(_v))?_v:null; } catch(e){ return null; }`);
      return fn as (x: number) => number | null;
    } catch { return null; }
  }, []);

  const genPath = useCallback((evalFn: (x: number) => number | null): string => {
    const steps = 500;
    const xStart = toMathX(0), xEnd = toMathX(GW);
    const parts: string[] = [];
    let wasNull = true, prevSy: number | null = null;
    for (let i = 0; i <= steps; i++) {
      const x = xStart + (xEnd - xStart) * i / steps;
      const y = evalFn(x);
      if (y === null) { wasNull = true; prevSy = null; continue; }
      const sx = GW / 2 + (x - view.cx) * view.scale;
      const sy = GH / 2 - (y - view.cy) * view.scale;
      if (prevSy !== null && Math.abs(sy - prevSy) > GH * 1.5) { wasNull = true; }
      parts.push(wasNull ? `M${sx.toFixed(1)},${sy.toFixed(1)}` : `L${sx.toFixed(1)},${sy.toFixed(1)}`);
      wasNull = false;
      prevSy = sy;
    }
    return parts.join('');
  }, [view, toMathX]);

  const { gridLines, xTicks, yTicks } = useMemo(() => {
    const rawStep = 70 / view.scale;
    const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const step = ([1, 2, 5, 10].find((n) => n * mag >= rawStep) ?? 10) * mag;
    const xMin = toMathX(0), xMax = toMathX(GW);
    const yMin = toMathY(GH), yMax = toMathY(0);
    const snap = (v: number) => Math.round(v / (step * 1e-9)) * (step * 1e-9);
    const gLines: { x1: number; y1: number; x2: number; y2: number; axis: boolean }[] = [];
    const xT: { v: number; sx: number }[] = [];
    const yT: { v: number; sy: number }[] = [];
    for (let gx = Math.ceil(xMin / step) * step; gx <= xMax + step * 0.5; gx += step) {
      const v = snap(gx), sx = toSvgX(v), isAxis = Math.abs(v) < step * 0.01;
      gLines.push({ x1: sx, y1: 0, x2: sx, y2: GH, axis: isAxis });
      if (!isAxis) xT.push({ v, sx });
    }
    for (let gy = Math.ceil(yMin / step) * step; gy <= yMax + step * 0.5; gy += step) {
      const v = snap(gy), sy = toSvgY(v), isAxis = Math.abs(v) < step * 0.01;
      gLines.push({ x1: 0, y1: sy, x2: GW, y2: sy, axis: isAxis });
      if (!isAxis) yT.push({ v, sy });
    }
    return { gridLines: gLines, xTicks: xT, yTicks: yT };
  }, [view, toMathX, toMathY, toSvgX, toSvgY]);

  const { path1, path2 } = useMemo(() => {
    const fn1 = buildEval(eq1);
    const fn2 = eq2.trim() ? buildEval(eq2) : null;
    return { path1: fn1 ? genPath(fn1) : '', path2: fn2 ? genPath(fn2) : '' };
  }, [eq1, eq2, view, buildEval, genPath]);

  const axisX = Math.max(0, Math.min(GW, toSvgX(0)));
  const axisY = Math.max(0, Math.min(GH, toSvgY(0)));
  const clipId = 'contour-graph-clip';

  const onSvgMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    panRef.current = { mx: e.clientX, my: e.clientY, cx: view.cx, cy: view.cy };
  };
  const onSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!panRef.current) return;
    const dx = (e.clientX - panRef.current.mx) / view.scale;
    const dy = (e.clientY - panRef.current.my) / view.scale;
    setView((v) => ({ ...v, cx: panRef.current!.cx - dx, cy: panRef.current!.cy + dy }));
  };
  const onSvgMouseUp = () => { panRef.current = null; };
  const onSvgWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.2 : 1 / 1.2;
    const rect = e.currentTarget.getBoundingClientRect();
    const svgX = (e.clientX - rect.left) / rect.width * GW;
    const svgY = (e.clientY - rect.top) / rect.height * GH;
    const mxPivot = toMathX(svgX), myPivot = toMathY(svgY);
    setView((v) => {
      const ns = Math.max(3, Math.min(5000, v.scale * factor));
      return { scale: ns, cx: mxPivot - (svgX - GW / 2) / ns, cy: myPivot + (svgY - GH / 2) / ns };
    });
  };

  return (
    <div className="relative select-none" style={{ background: 'rgba(0,0,0,0.22)' }}>
      <svg
        width="100%"
        viewBox={`0 0 ${GW} ${GH}`}
        className="block cursor-grab active:cursor-grabbing"
        onMouseDown={onSvgMouseDown}
        onMouseMove={onSvgMouseMove}
        onMouseUp={onSvgMouseUp}
        onMouseLeave={onSvgMouseUp}
        onWheel={onSvgWheel}
      >
        <defs>
          <clipPath id={clipId}>
            <rect x="0" y="0" width={GW} height={GH} />
          </clipPath>
        </defs>

        {/* Minor grid */}
        {gridLines.filter((l) => !l.axis).map((l, i) => (
          <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="rgba(255,255,255,0.045)" strokeWidth="1" />
        ))}

        {/* Axes */}
        <line x1={0} y1={axisY} x2={GW} y2={axisY} stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
        <line x1={axisX} y1={0} x2={axisX} y2={GH} stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />

        {/* X tick marks + labels */}
        {xTicks.map((t, i) => (
          <g key={i}>
            <line x1={t.sx} y1={axisY - 3} x2={t.sx} y2={axisY + 3} stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
            <text x={t.sx} y={Math.min(GH - 4, Math.max(11, axisY + 13))}
              textAnchor="middle" fontSize="8" fill="rgba(255,255,255,0.38)" fontFamily="monospace">
              {formatTick(t.v)}
            </text>
          </g>
        ))}

        {/* Y tick marks + labels */}
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={axisX - 3} y1={t.sy} x2={axisX + 3} y2={t.sy} stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
            <text x={Math.max(24, Math.min(GW - 8, axisX - 6))} y={t.sy + 3.5}
              textAnchor="end" fontSize="8" fill="rgba(255,255,255,0.38)" fontFamily="monospace">
              {formatTick(t.v)}
            </text>
          </g>
        ))}

        {/* Axis labels */}
        <text x={GW - 8} y={Math.min(GH - 5, Math.max(12, axisY - 7))}
          fontSize="11" fill="rgba(255,255,255,0.4)" fontStyle="italic" fontFamily="serif">x</text>
        <text x={Math.max(8, Math.min(GW - 14, axisX + 7))} y={12}
          fontSize="11" fill="rgba(255,255,255,0.4)" fontStyle="italic" fontFamily="serif">y</text>

        {/* Origin label */}
        {axisX > 12 && axisX < GW - 12 && axisY > 12 && axisY < GH - 12 && (
          <text x={axisX - 6} y={axisY + 13} textAnchor="end" fontSize="7"
            fill="rgba(255,255,255,0.22)" fontFamily="monospace">0</text>
        )}

        {/* Curves */}
        {path1 && (
          <path d={path1} fill="none" stroke="rgba(168,85,247,1)" strokeWidth="2.2"
            strokeLinecap="round" strokeLinejoin="round" clipPath={`url(#${clipId})`} />
        )}
        {path2 && (
          <path d={path2} fill="none" stroke="rgba(34,211,238,1)" strokeWidth="2.2"
            strokeLinecap="round" strokeLinejoin="round" clipPath={`url(#${clipId})`} />
        )}
      </svg>

      {/* Reset view */}
      <button
        onClick={() => setView({ cx: 0, cy: 0, scale: 45 })}
        className="absolute top-1.5 right-2 text-[9px] font-mono text-white/20 hover:text-white/50 transition-colors"
      >reset</button>
    </div>
  );
}

// ─── Exported view ──────────────────────────────────────────────────

export function GraphView({ module, accent }: { module: ModuleData; accent: AccentTheme }) {
  const graph = module.graph;
  const [eq2, setEq2] = useState('');
  const [eq2Err, setEq2Err] = useState(false);

  if (!graph && module.focused) {
    return <HintView icon={TrendingUp} accent={accent} text={MODULE_META.graph.placeholder} />;
  }
  if (!graph) return null;

  const rawEq1 = graph.eq1;
  // Strip "y =" prefix for display in the label
  const displayEq1 = rawEq1.replace(/^\s*(?:[yfg]\s*(?:\(\s*x\s*\))?\s*=\s*)/i, '').trim() || rawEq1;

  const handleEq2Change = (val: string) => {
    setEq2(val);
    if (!val.trim()) { setEq2Err(false); return; }
    // Basic validation: try parsing
    try {
      const js = parseMathExpr(val);
      // eslint-disable-next-line no-new-func
      new Function('x', `"use strict"; return (${js || '0'})`);
      setEq2Err(false);
    } catch { setEq2Err(true); }
  };

  return (
    <div>
      {/* Equation inputs */}
      <div className="px-4 pt-3 pb-2 flex flex-col gap-1.5 border-b border-white/5">
        {/* Eq 1 — from chat input (read-only display) */}
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-purple-400 shrink-0" />
          <span className="text-xs font-mono shrink-0" style={{ color: 'rgba(255,255,255,0.3)' }}>y =</span>
          <span className="text-sm font-mono text-white/80 truncate">{displayEq1}</span>
        </div>
        {/* Eq 2 — user-editable */}
        <div className={`flex items-center gap-2 rounded-lg px-1 py-0.5 transition-colors ${eq2Err ? 'bg-red-500/10' : ''}`}>
          <div className="w-2 h-2 rounded-full bg-cyan-400 shrink-0" />
          <span className="text-xs font-mono shrink-0" style={{ color: 'rgba(255,255,255,0.3)' }}>y =</span>
          <input
            type="text"
            value={eq2}
            onChange={(e) => handleEq2Change(e.target.value)}
            placeholder="add 2nd equation…"
            spellCheck={false}
            className={`flex-1 bg-transparent outline-none text-sm font-mono placeholder-white/20 min-w-0 ${eq2Err ? 'text-red-300' : 'text-white/55'}`}
            onMouseDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          />
          {eq2Err && <span className="text-[9px] text-red-400 shrink-0">invalid</span>}
        </div>
      </div>

      {/* Graph canvas */}
      <GraphCanvas eq1={rawEq1} eq2={eq2} accent={accent} />

      {/* Footer hints */}
      <div className="px-4 py-2">
        <span className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.18)' }}>
          scroll to zoom · drag to pan &nbsp;·&nbsp; supports: x^2 · sin(x) · e^x · |x| · pi · ln(x)
        </span>
      </div>
    </div>
  );
}
