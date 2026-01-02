// src/components/HeroRelationDiagram.tsx
import { useEffect, useMemo, useState } from "react";

type Node = {
  id: string;
  label: string;
  x: number;
  y: number;
};

type Link = {
  from: string;
  to: string;
  d: string; // SVG path
};

export default function HeroRelationDiagram() {
  const nodes: Node[] = useMemo(
    () => [
      { id: "guest", label: "하객", x: 92, y: 92 },
      { id: "congrats", label: "축하", x: 270, y: 72 },
      { id: "hosts", label: "혼주", x: 340, y: 170 },
      { id: "report", label: "리포트", x: 250, y: 272 },
      { id: "thanks", label: "감사", x: 92, y: 252 },
    ],
    []
  );

  const links: Link[] = useMemo(
    () => [
      {
        from: "guest",
        to: "congrats",
        d: "M 92 92 C 150 30, 210 30, 270 72",
      },
      {
        from: "congrats",
        to: "hosts",
        d: "M 270 72 C 330 78, 360 110, 340 170",
      },
      {
        from: "hosts",
        to: "report",
        d: "M 340 170 C 330 240, 305 260, 250 272",
      },
      {
        from: "report",
        to: "thanks",
        d: "M 250 272 C 170 312, 120 300, 92 252",
      },
      {
        from: "thanks",
        to: "guest",
        d: "M 92 252 C 50 190, 48 135, 92 92",
      },
    ],
    []
  );

  const [active, setActive] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      setActive((v) => (v + 1) % links.length);
    }, 2400);
    return () => clearInterval(t);
  }, [links.length]);

  const activeLink = links[active];
  const activeNodeId = activeLink?.to;

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white/70 backdrop-blur shadow-xl overflow-hidden">
      <div className="p-6">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm text-zinc-500">한 번의 결혼식, 한 번의 기록</div>
          <div className="text-xs text-zinc-400">자동 정리</div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-[#FBFAF7] overflow-hidden">
          <svg viewBox="0 0 420 340" className="w-full h-[340px]" role="img" aria-label="관계 흐름 도식">
            <defs>
              <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="5" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              <linearGradient id="activeStroke" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="rgb(24 24 27)" stopOpacity="0.9" />
                <stop offset="100%" stopColor="rgb(24 24 27)" stopOpacity="0.35" />
              </linearGradient>
            </defs>

            {/* base dotted paths */}
            {links.map((l) => (
              <path
                key={`${l.from}-${l.to}-base`}
                d={l.d}
                fill="none"
                stroke="rgb(161 161 170)" // zinc-400
                strokeWidth="2"
                strokeDasharray="4 7"
                opacity={0.5}
              />
            ))}

            {/* active animated path */}
            {activeLink && (
              <path
                d={activeLink.d}
                fill="none"
                stroke="url(#activeStroke)"
                strokeWidth="2.6"
                strokeDasharray="6 10"
                style={{ animation: "dash 1.8s linear infinite" }}
                opacity={0.95}
              />
            )}

            {/* nodes */}
            {nodes.map((n) => {
              const isActive = n.id === activeNodeId;
              return (
                <g key={n.id} transform={`translate(${n.x}, ${n.y})`}>
                  {/* dot anchor */}
                  <circle
                    cx={-58}
                    cy={0}
                    r={3}
                    fill={isActive ? "rgb(24 24 27)" : "rgb(161 161 170)"}
                    opacity={0.9}
                  />

                  {/* node pill */}
                  <rect
                    x={-52}
                    y={-18}
                    width={104}
                    height={36}
                    rx={12}
                    fill={isActive ? "rgb(255 255 255)" : "rgb(244 244 245)"} // white / zinc-100
                    stroke={isActive ? "rgb(24 24 27)" : "rgb(228 228 231)"} // zinc-900 / zinc-200
                    strokeWidth={isActive ? 1.2 : 1}
                    filter={isActive ? "url(#softGlow)" : "none"}
                    opacity={isActive ? 1 : 0.95}
                  />

                  <text
                    x="0"
                    y="6"
                    textAnchor="middle"
                    fontSize="12"
                    fill="rgb(24 24 27)"
                    style={{ fontWeight: 650 }}
                  >
                    {n.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      <style>{`
        @keyframes dash {
          from { stroke-dashoffset: 0; }
          to { stroke-dashoffset: -44; }
        }
      `}</style>
    </div>
  );
}
