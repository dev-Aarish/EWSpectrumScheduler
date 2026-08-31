"use client";

import { useMemo, memo, useState, useRef, useCallback, useEffect } from "react";

interface FeatureSpaceData {
  coordinates: number[][];
  labels: number[];
  clusters: Record<
    number,
    {
      centroid: number[];
      covariance: number[][];
      count: number;
    }
  >;
  separability: number;
}

interface EmitterType {
  label: string;
  count: number;
  color: string;
}

interface EmitterFeatureSpaceProps {
  featureSpace: FeatureSpaceData;
  emitterTypes: EmitterType[];
  emitterLabels: number[];
}

const PALETTE = [
  "#C4523B",
  "#D98E33",
  "#5E8C6A",
  "#B8763E",
  "#6B7B8D",
  "#9B59B6",
  "#3498DB",
  "#E67E22",
  "#1ABC9C",
  "#E74C3C",
];

const VIEWBOX_HEIGHT = 110;
const MIN_VIEWBOX_WIDTH = 120;
const PLOT_MARGIN = {
  top: 5,
  right: 10,
  bottom: 10,
  left: 10,
} as const;

function getCovarianceExtents(covariance: number[][]): { x: number; y: number } {
  const a = covariance[0]?.[0] ?? 0;
  const b = covariance[0]?.[1] ?? 0;
  const d = covariance[1]?.[1] ?? 0;
  const trace = a + d;
  const det = a * d - b * b;
  const disc = Math.sqrt(Math.max(0, trace * trace / 4 - det));
  const lambda1 = Math.max(0, trace / 2 + disc);
  const lambda2 = Math.max(0, trace / 2 - disc);

  let angle = 0;
  if (Math.abs(b) > 1e-10) {
    angle = Math.atan2(lambda1 - a, b);
  } else if (a <= d) {
    angle = Math.PI / 2;
  }

  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const r1 = Math.sqrt(lambda1);
  const r2 = Math.sqrt(lambda2);

  return {
    x: Math.sqrt((r1 * cos) ** 2 + (r2 * sin) ** 2),
    y: Math.sqrt((r1 * sin) ** 2 + (r2 * cos) ** 2),
  };
}

function EmitterFeatureSpace({
  featureSpace,
  emitterLabels,
}: EmitterFeatureSpaceProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const plotContainerRef = useRef<HTMLDivElement>(null);
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);
  const [showEllipses, setShowEllipses] = useState(true);
  const [showCentroids, setShowCentroids] = useState(true);
  const [viewBoxWidth, setViewBoxWidth] = useState(MIN_VIEWBOX_WIDTH);

  useEffect(() => {
    const container = plotContainerRef.current;
    if (!container) return;

    const updateViewBox = () => {
      const { width, height } = container.getBoundingClientRect();
      if (width <= 0 || height <= 0) return;

      const nextWidth = Math.max(
        MIN_VIEWBOX_WIDTH,
        Number(((width / height) * VIEWBOX_HEIGHT).toFixed(2))
      );
      setViewBoxWidth((currentWidth) =>
        Math.abs(currentWidth - nextWidth) > 0.5 ? nextWidth : currentWidth
      );
    };

    updateViewBox();
    const observer = new ResizeObserver(updateViewBox);
    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  const plotWidth = Math.max(
    1,
    viewBoxWidth - PLOT_MARGIN.left - PLOT_MARGIN.right
  );
  const plotHeight = VIEWBOX_HEIGHT - PLOT_MARGIN.top - PLOT_MARGIN.bottom;

  const labelToColor = useMemo(() => {
    const map = new Map<number, string>();
    const sortedLabels = [...emitterLabels].sort((a, b) => a - b);
    sortedLabels.forEach((lbl, i) => {
      map.set(lbl, PALETTE[i % PALETTE.length]);
    });
    return map;
  }, [emitterLabels]);

  // Compute bounding box and scales
  const { xScale, yScale, bounds } = useMemo(() => {
    const coords = featureSpace.coordinates;
    if (!coords.length)
      return {
        xScale: () => 0,
        yScale: () => 0,
        bounds: { xMin: 0, xMax: 1, yMin: 0, yMax: 1 },
      };

    let xMin = Infinity,
      xMax = -Infinity,
      yMin = Infinity,
      yMax = -Infinity;
    for (const [x, y] of coords) {
      if (x < xMin) xMin = x;
      if (x > xMax) xMax = x;
      if (y < yMin) yMin = y;
      if (y > yMax) yMax = y;
    }

    for (const cluster of Object.values(featureSpace.clusters)) {
      const [cx, cy] = cluster.centroid;
      const extents = getCovarianceExtents(cluster.covariance);
      xMin = Math.min(xMin, cx - extents.x);
      xMax = Math.max(xMax, cx + extents.x);
      yMin = Math.min(yMin, cy - extents.y);
      yMax = Math.max(yMax, cy + extents.y);
    }

    const xRange = xMax - xMin || 1;
    const yRange = yMax - yMin || 1;

    const pad = 0.12;
    xMin -= xRange * pad;
    xMax += xRange * pad;
    yMin -= yRange * pad;
    yMax += yRange * pad;

    const xScale = (v: number) =>
      ((v - xMin) / (xMax - xMin)) * plotWidth;
    const yScale = (v: number) =>
      plotHeight - ((v - yMin) / (yMax - yMin)) * plotHeight;

    return {
      xScale,
      yScale,
      bounds: { xMin, xMax, yMin, yMax },
    };
  }, [featureSpace.coordinates, featureSpace.clusters, plotHeight, plotWidth]);

  // Compute ellipse path from covariance matrix (1 std dev)
  const computeEllipsePath = useCallback(
    (
      centroid: number[],
      covariance: number[][],
      scaleX: (v: number) => number,
      scaleY: (v: number) => number
    ) => {
      const cx = scaleX(centroid[0]);
      const cy = scaleY(centroid[1]);

      // Eigen decomposition after projecting covariance into SVG units.
      const xRange = bounds.xMax - bounds.xMin;
      const yRange = bounds.yMax - bounds.yMin;
      const sx = plotWidth / (xRange || 1);
      const sy = plotHeight / (yRange || 1);
      const a = covariance[0][0] * sx * sx;
      const b = covariance[0][1] * sx * sy;
      const d = covariance[1][1] * sy * sy;
      const trace = a + d;
      const det = a * d - b * b;
      const disc = Math.sqrt(Math.max(0, trace * trace / 4 - det));

      const lambda1 = trace / 2 + disc;
      const lambda2 = trace / 2 - disc;

      const r1 = Math.max(Math.sqrt(Math.max(0, lambda1)), 0.5);
      const r2 = Math.max(Math.sqrt(Math.max(0, lambda2)), 0.5);

      // Angle of first eigenvector
      let angle = 0;
      if (Math.abs(b) > 1e-10) {
        angle = Math.atan2(lambda1 - a, b);
      } else if (a > d) {
        angle = 0;
      } else {
        angle = Math.PI / 2;
      }

      const angleDeg = (angle * 180) / Math.PI;

      return {
        cx,
        cy,
        rx: Math.max(r1, 0.5),
        ry: Math.max(r2, 0.5),
        angle: angleDeg,
      };
    },
    [bounds, plotHeight, plotWidth]
  );

  // Ellipse data for each cluster
  const ellipses = useMemo(() => {
    if (!showEllipses) return [];
    return Object.entries(featureSpace.clusters).map(([lbl, cluster]) => {
      const color = labelToColor.get(Number(lbl)) ?? "#9BA3AD";
      const e = computeEllipsePath(
        cluster.centroid,
        cluster.covariance,
        xScale,
        yScale
      );
      return { label: Number(lbl), color, ...e, count: cluster.count };
    });
  }, [
    featureSpace.clusters,
    labelToColor,
    showEllipses,
    xScale,
    yScale,
    computeEllipsePath,
  ]);

  // Centroid data
  const centroids = useMemo(() => {
    if (!showCentroids) return [];
    return Object.entries(featureSpace.clusters).map(([lbl, cluster]) => {
      const color = labelToColor.get(Number(lbl)) ?? "#9BA3AD";
      return {
        label: Number(lbl),
        color,
        x: xScale(cluster.centroid[0]),
        y: yScale(cluster.centroid[1]),
        count: cluster.count,
      };
    });
  }, [featureSpace.clusters, labelToColor, showCentroids, xScale, yScale]);

  // Axis tick marks
  const xTicks = useMemo(() => {
    const { xMin, xMax } = bounds;
    const nTicks = 6;
    const step = (xMax - xMin) / (nTicks - 1);
    return Array.from({ length: nTicks }, (_, i) => {
      const val = xMin + step * i;
      return { val, pos: xScale(val) };
    });
  }, [bounds, xScale]);

  const yTicks = useMemo(() => {
    const { yMin, yMax } = bounds;
    const nTicks = 5;
    const step = (yMax - yMin) / (nTicks - 1);
    return Array.from({ length: nTicks }, (_, i) => {
      const val = yMin + step * i;
      return { val, pos: yScale(val) };
    });
  }, [bounds, yScale]);

  const separabilityLabel = useMemo(() => {
    const s = featureSpace.separability;
    if (s > 2) return { text: "Well Separated", color: "#5E8C6A" };
    if (s > 1) return { text: "Moderately Separated", color: "#D98E33" };
    return { text: "Overlapping", color: "#C4523B" };
  }, [featureSpace.separability]);

  if (!featureSpace.coordinates.length) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-3 py-2 border-b border-[#22262D]">
          <span className="section-label">Emitter Feature Space</span>
        </div>
        <div className="flex-1 flex items-center justify-center text-[11px] font-mono text-[#5C636D]">
          No feature data available
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-[#22262D] flex items-center justify-between">
        <span className="section-label">Emitter Feature Space (t-SNE)</span>
        <div className="flex items-center gap-3">
          <span
            className="text-[10px] font-mono tabular-nums"
            style={{ color: separabilityLabel.color }}
          >
            {separabilityLabel.text} ({featureSpace.separability.toFixed(2)})
          </span>
          <span className="text-[10px] font-mono text-[#5C636D] tabular-nums">
            {featureSpace.coordinates.length.toLocaleString()} pulses
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="px-3 py-1 flex items-center gap-3 border-b border-[#22262D]">
        <label className="flex items-center gap-1.5 text-[10px] font-mono text-[#5C636D] cursor-pointer">
          <input
            type="checkbox"
            checked={showEllipses}
            onChange={(e) => setShowEllipses(e.target.checked)}
            className="accent-[#D98E33] w-3 h-3"
          />
          Variance Ellipses
        </label>
        <label className="flex items-center gap-1.5 text-[10px] font-mono text-[#5C636D] cursor-pointer">
          <input
            type="checkbox"
            checked={showCentroids}
            onChange={(e) => setShowCentroids(e.target.checked)}
            className="accent-[#D98E33] w-3 h-3"
          />
          Centroids
        </label>
      </div>

      {/* SVG Plot */}
      <div
        ref={plotContainerRef}
        className="flex-1 min-h-0 overflow-hidden p-2 relative"
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${viewBoxWidth} ${VIEWBOX_HEIGHT}`}
          className="block w-full h-full"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Grid lines */}
          {xTicks.map((t, i) => (
            <line
              key={`xgrid-${i}`}
              x1={t.pos + PLOT_MARGIN.left}
              y1={PLOT_MARGIN.top}
              x2={t.pos + PLOT_MARGIN.left}
              y2={PLOT_MARGIN.top + plotHeight}
              stroke="#22262D"
              strokeWidth={0.15}
              strokeDasharray="0.5,0.5"
            />
          ))}
          {yTicks.map((t, i) => (
            <line
              key={`ygrid-${i}`}
              x1={PLOT_MARGIN.left}
              y1={t.pos + PLOT_MARGIN.top}
              x2={PLOT_MARGIN.left + plotWidth}
              y2={t.pos + PLOT_MARGIN.top}
              stroke="#22262D"
              strokeWidth={0.15}
              strokeDasharray="0.5,0.5"
            />
          ))}

          {/* Axes */}
          <line
            x1={PLOT_MARGIN.left}
            y1={PLOT_MARGIN.top + plotHeight}
            x2={PLOT_MARGIN.left + plotWidth}
            y2={PLOT_MARGIN.top + plotHeight}
            stroke="#343A42"
            strokeWidth={0.2}
          />
          <line
            x1={PLOT_MARGIN.left}
            y1={PLOT_MARGIN.top}
            x2={PLOT_MARGIN.left}
            y2={PLOT_MARGIN.top + plotHeight}
            stroke="#343A42"
            strokeWidth={0.2}
          />

          {/* Axis labels */}
          {xTicks.map((t, i) => (
            <text
              key={`xlabel-${i}`}
              x={t.pos + PLOT_MARGIN.left}
              y={PLOT_MARGIN.top + plotHeight + 3}
              textAnchor="middle"
              fill="#5C636D"
              fontSize={2.2}
              fontFamily="IBM Plex Mono, monospace"
            >
              {t.val.toFixed(1)}
            </text>
          ))}
          {yTicks.map((t, i) => (
            <text
              key={`ylabel-${i}`}
              x={PLOT_MARGIN.left - 2}
              y={t.pos + PLOT_MARGIN.top + 0.5}
              textAnchor="end"
              fill="#5C636D"
              fontSize={2.2}
              fontFamily="IBM Plex Mono, monospace"
            >
              {t.val.toFixed(1)}
            </text>
          ))}

          {/* Axis titles */}
          <text
            x={PLOT_MARGIN.left + plotWidth / 2}
            y={VIEWBOX_HEIGHT - 3}
            textAnchor="middle"
            fill="#5C636D"
            fontSize={2.5}
            fontFamily="IBM Plex Mono, monospace"
          >
            t-SNE 1
          </text>
          <text
            x={3}
            y={52.5}
            textAnchor="middle"
            fill="#5C636D"
            fontSize={2.5}
            fontFamily="IBM Plex Mono, monospace"
            transform="rotate(-90, 3, 52.5)"
          >
            t-SNE 2
          </text>

          {/* Variance ellipses */}
          {ellipses.map((e) => (
            <ellipse
              key={`ellipse-${e.label}`}
              cx={e.cx + PLOT_MARGIN.left}
              cy={e.cy + PLOT_MARGIN.top}
              rx={e.rx}
              ry={e.ry}
              transform={`rotate(${e.angle}, ${e.cx + PLOT_MARGIN.left}, ${
                e.cy + PLOT_MARGIN.top
              })`}
              fill={e.color}
              fillOpacity={0.04}
              stroke={e.color}
              strokeWidth={0.2}
              strokeOpacity={0.3}
              strokeDasharray="0.8,0.4"
            />
          ))}

          {/* Data points */}
          {featureSpace.coordinates.map((coord, i) => {
            const lbl = featureSpace.labels[i];
            const color = labelToColor.get(lbl) ?? "#9BA3AD";
            const cx = xScale(coord[0]) + PLOT_MARGIN.left;
            const cy = yScale(coord[1]) + PLOT_MARGIN.top;
            const isHovered = hoveredPoint === i;
            return (
              <circle
                key={i}
                cx={cx}
                cy={cy}
                r={isHovered ? 1.5 : 0.8}
                fill={color}
                fillOpacity={isHovered ? 1 : 0.7}
                stroke={color}
                strokeWidth={isHovered ? 0.3 : 0.15}
                strokeOpacity={0.9}
                style={{ cursor: "pointer", transition: "r 100ms, fill-opacity 100ms" }}
                onMouseEnter={() => setHoveredPoint(i)}
                onMouseLeave={() => setHoveredPoint(null)}
              />
            );
          })}

          {/* Centroid markers */}
          {centroids.map((c) => (
            <g key={`centroid-${c.label}`}>
              <line
                x1={c.x + PLOT_MARGIN.left - 1.2}
                y1={c.y + PLOT_MARGIN.top}
                x2={c.x + PLOT_MARGIN.left + 1.2}
                y2={c.y + PLOT_MARGIN.top}
                stroke={c.color}
                strokeWidth={0.3}
                strokeOpacity={0.9}
              />
              <line
                x1={c.x + PLOT_MARGIN.left}
                y1={c.y + PLOT_MARGIN.top - 1.2}
                x2={c.x + PLOT_MARGIN.left}
                y2={c.y + PLOT_MARGIN.top + 1.2}
                stroke={c.color}
                strokeWidth={0.3}
                strokeOpacity={0.9}
              />
              <circle
                cx={c.x + PLOT_MARGIN.left}
                cy={c.y + PLOT_MARGIN.top}
                r={0.5}
                fill="none"
                stroke={c.color}
                strokeWidth={0.3}
                strokeOpacity={0.9}
              />
            </g>
          ))}
        </svg>

        {/* Hover tooltip */}
        {hoveredPoint !== null && (
          <div className="absolute top-3 right-3 bg-[#181C22] border border-[#343A42] px-3 py-2 text-[11px] font-mono leading-relaxed pointer-events-none z-10">
            <div className="text-[#E8EAED]">
              Emitter:{" "}
              <span style={{ color: labelToColor.get(featureSpace.labels[hoveredPoint]) ?? "#9BA3AD" }}>
                #{featureSpace.labels[hoveredPoint]}
              </span>
            </div>
            <div className="text-[#5C636D]">
              t-SNE 1: <span className="tabular-nums text-[#E8EAED]">{featureSpace.coordinates[hoveredPoint][0].toFixed(2)}</span>
            </div>
            <div className="text-[#5C636D]">
              t-SNE 2: <span className="tabular-nums text-[#E8EAED]">{featureSpace.coordinates[hoveredPoint][1].toFixed(2)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="px-3 pb-2 flex flex-wrap gap-x-3 gap-y-1">
        {emitterLabels.map((lbl) => {
          const color = labelToColor.get(lbl) ?? "#9BA3AD";
          const cluster = featureSpace.clusters[lbl];
          return (
            <div key={lbl} className="flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: color, opacity: 0.7 }}
              />
              <span className="text-[9px] font-mono text-[#5C636D]">
                Emitter #{lbl}
                {cluster ? ` (${cluster.count})` : ""}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default memo(EmitterFeatureSpace);
