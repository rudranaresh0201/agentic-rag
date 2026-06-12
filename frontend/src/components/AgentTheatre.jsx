import { useMemo } from "react";
import { HiChevronRight } from "react-icons/hi2";

const NODE_DEFS = [
  { id: "orchestrator", icon: "🧠", label: "Orch",  group: "left"  },
  { id: "rag",          icon: "📚", label: "RAG",   group: "mid"   },
  { id: "web",          icon: "🌐", label: "Web",   group: "mid"   },
  { id: "gmail",        icon: "📧", label: "Gmail", group: "mid"   },
  { id: "calendar",     icon: "📅", label: "Cal",   group: "mid"   },
  { id: "memory",       icon: "💾", label: "Mem",   group: "mid"   },
  { id: "media",        icon: "🎬", label: "Media", group: "mid"   },
  { id: "synthesis",    icon: "✅", label: "Synth", group: "right" },
];

const MATCHERS = {
  orchestrator: (s) => s.includes("Orchestrator"),
  rag:          (s) => s.includes("RAG"),
  web:          (s) => /Web\s*→/.test(s) || s.includes("Web →"),
  gmail:        (s) => s.includes("Gmail"),
  calendar:     (s) => s.includes("Calendar"),
  memory:       (s) => s.includes("Memory"),
  media:        (s) => s.includes("Media"),
  synthesis:    (s) => s.includes("Synthesis"),
};

function getActiveSet(steps) {
  const joined = (steps || []).join("\n");
  return new Set(
    Object.entries(MATCHERS)
      .filter(([, test]) => test(joined))
      .map(([id]) => id),
  );
}

function Node({ icon, label, active }) {
  return (
    <div
      className={[
        "flex flex-col items-center justify-center gap-[3px]",
        "rounded-lg border px-2 py-1.5 min-w-[46px]",
        "select-none cursor-default",
        "transition-all duration-500 ease-out",
        active
          ? "border-indigo-400/70 bg-indigo-500/15 text-slate-100 shadow-[0_0_10px_rgba(99,102,241,0.45)] scale-105"
          : "border-white/[0.07] bg-white/[0.02] text-slate-500",
      ].join(" ")}
    >
      <span className="text-sm leading-none">{icon}</span>
      <span className="text-[9px] font-bold uppercase tracking-wide leading-none">{label}</span>
    </div>
  );
}

export default function AgentTheatre({ agent_steps = [] }) {
  const active = useMemo(() => getActiveSet(agent_steps), [agent_steps]);

  const left = NODE_DEFS.filter((n) => n.group === "left");
  const mid  = NODE_DEFS.filter((n) => n.group === "mid");
  const right = NODE_DEFS.filter((n) => n.group === "right");

  return (
    <div className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2">
      {left.map((n) => (
        <Node key={n.id} icon={n.icon} label={n.label} active={active.has(n.id)} />
      ))}

      <HiChevronRight className="flex-shrink-0 text-slate-700 text-base" />

      {/* middle agents in a 2-row × 3-col grid */}
      <div className="grid grid-cols-3 gap-1.5">
        {mid.map((n) => (
          <Node key={n.id} icon={n.icon} label={n.label} active={active.has(n.id)} />
        ))}
      </div>

      <HiChevronRight className="flex-shrink-0 text-slate-700 text-base" />

      {right.map((n) => (
        <Node key={n.id} icon={n.icon} label={n.label} active={active.has(n.id)} />
      ))}
    </div>
  );
}
