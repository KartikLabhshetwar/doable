import React from "react";
import { useId } from "react";

export default function FeaturesSectionDemo() {
  return (
    <div id="features" className="py-20 lg:py-40 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 md:px-8 lg:px-12 relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-light tracking-tight mb-6 bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
            Everything you need to manage tasks
          </h2>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
          {grid.map((feature) => (
            <div
              key={feature.title}
              className="group relative bg-gradient-to-b from-card to-card/50 p-8 rounded-2xl border border-border overflow-hidden backdrop-blur-sm hover:bg-card/80 transition-all duration-300"
            >
              <Grid size={20} />
              <p className="text-xl font-semibold mb-3 text-foreground group-hover:text-primary transition-colors relative z-20">
                {feature.title}
              </p>
              <p className="text-muted-foreground leading-relaxed relative z-20">
                {feature.description}
              </p>
              
              {/* Hover Effect */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary/5 to-primary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-20">
          <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-border bg-card/50 backdrop-blur-sm text-sm font-medium text-muted-foreground">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span>All features included in the free plan</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const grid = [
  {
    title: "Doable AI",
    description: "Built-in AI assistant powered by Groq. Create, update, and manage issues with natural language commands. Just ask and get things done. Powered by Groq.",
  },
  {
    title: "Modern Interface",
    description: "Clean, intuitive design inspired by Swiss design principles. Every pixel serves a purpose.",
  },
  {
    title: "Team Collaboration",
    description: "Built-in team management with role-based permissions. Work together seamlessly.",
  },
  {
    title: "Lightning Fast",
    description: "Built with Next.js 15 and optimized for performance. Experience the speed difference.",
  },
  {
    title: "Secure & Reliable",
    description: "Enterprise-grade security with Stack Auth. Your data is always protected.",
  },
  {
    title: "Open Source",
    description: "Full source code available. Customize, extend, and contribute to the project.",
  },
];

export const Grid = ({
  pattern,
  size,
}: {
  pattern?: number[][];
  size?: number;
}) => {
  const p = pattern ?? [
    [Math.floor(Math.random() * 4) + 7, Math.floor(Math.random() * 6) + 1],
    [Math.floor(Math.random() * 4) + 7, Math.floor(Math.random() * 6) + 1],
    [Math.floor(Math.random() * 4) + 7, Math.floor(Math.random() * 6) + 1],
    [Math.floor(Math.random() * 4) + 7, Math.floor(Math.random() * 6) + 1],
    [Math.floor(Math.random() * 4) + 7, Math.floor(Math.random() * 6) + 1],
  ];
  return (
    <div className="pointer-events-none absolute left-1/2 top-0 -ml-20 -mt-2 h-full w-full [mask-image:linear-gradient(white,transparent)]">
      <div className="absolute inset-0 bg-gradient-to-r [mask-image:radial-gradient(farthest-side_at_top,white,transparent)] from-border/20 to-border/10 opacity-100">
        <GridPattern
          width={size ?? 20}
          height={size ?? 20}
          x="-12"
          y="4"
          squares={p}
          className="absolute inset-0 h-full w-full  mix-blend-overlay dark:fill-white/10 dark:stroke-white/10 stroke-black/10 fill-black/10"
        />
      </div>
    </div>
  );
};

export function GridPattern({ width, height, x, y, squares, ...props }: any) {
  const patternId = useId();

  return (
    <svg aria-hidden="true" {...props}>
      <defs>
        <pattern
          id={patternId}
          width={width}
          height={height}
          patternUnits="userSpaceOnUse"
          x={x}
          y={y}
        >
          <path d={`M.5 ${height}V.5H${width}`} fill="none" />
        </pattern>
      </defs>
      <rect
        width="100%"
        height="100%"
        strokeWidth={0}
        fill={`url(#${patternId})`}
      />
      {squares && (
        <svg x={x} y={y} className="overflow-visible">
          {squares.map(([x, y]: any) => (
            <rect
              strokeWidth="0"
              key={`${x}-${y}`}
              width={width + 1}
              height={height + 1}
              x={x * width}
              y={y * height}
            />
          ))}
        </svg>
      )}
    </svg>
  );
}
