import { useMemo } from "react";

const NODE_DEFS = [
  { id: "orchestrator", label: "Orchestrator" },
  { id: "rag",          label: "RAG"          },
  { id: "web",          label: "Web"          },
  { id: "gmail",        label: "Gmail"        },
  { id: "calendar",     label: "Calendar"     },
  { id: "memory",       label: "Memory"       },
  { id: "media",        label: "Media"        },
  { id: "synthesis",    label: "Synthesis"    },
  { id: "code_writer",  label: "Code Writer"  },
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
  code_writer:  (s) => s.includes("Code Writer"),
};

function getActiveLabels(steps) {
  const joined = (steps || []).join("\n");
  return NODE_DEFS
    .filter(({ id }) => MATCHERS[id](joined))
    .map(({ label }) => label);
}

export default function AgentTheatre({ agent_steps = [] }) {
  const labels = useMemo(() => getActiveLabels(agent_steps), [agent_steps]);

  if (labels.length === 0) return null;

  return (
    <p style={{
      fontSize: "10px",
      fontWeight: 600,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      color: "#6b7280",
      margin: 0,
    }}>
      {labels.join(" → ")}
    </p>
  );
}
