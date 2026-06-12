import { useState } from "react";
import { HiChevronDown, HiChevronUp } from "react-icons/hi2";

function getInitials(sender) {
  if (!sender) return "?";
  const name = sender.replace(/<[^>]+>/, "").trim();
  if (!name) return "?";
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function formatDate(raw) {
  if (!raw) return "";
  try {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return raw;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return raw;
  }
}

// Derive a stable hue from the sender string for the avatar background
function senderHue(sender) {
  let h = 0;
  for (let i = 0; i < (sender || "").length; i++) h = (h * 31 + sender.charCodeAt(i)) & 0xffff;
  return h % 360;
}

export default function EmailCard({ email }) {
  const [expanded, setExpanded] = useState(false);

  const initials = getInitials(email.sender);
  const hue = senderHue(email.sender);

  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-900/80">
      <div className="flex items-start gap-3 p-3">
        {/* Avatar */}
        <div
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border text-xs font-bold"
          style={{
            background: `hsl(${hue},40%,18%)`,
            borderColor: `hsl(${hue},50%,35%)`,
            color: `hsl(${hue},80%,75%)`,
          }}
        >
          {initials}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-xs font-semibold text-slate-200">
              {email.sender || "Unknown sender"}
            </span>
            <span className="flex-shrink-0 text-[10px] text-slate-500">
              {formatDate(email.date)}
            </span>
          </div>
          <p className="mt-0.5 text-xs font-semibold text-slate-100">
            {email.subject || "(no subject)"}
          </p>
          <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-slate-400">
            {email.snippet}
          </p>
        </div>
      </div>

      {email.body && (
        <>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex w-full items-center gap-1 border-t border-white/[0.06] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-indigo-400 transition hover:text-indigo-300"
          >
            {expanded ? <HiChevronUp className="text-sm" /> : <HiChevronDown className="text-sm" />}
            {expanded ? "Hide body" : "Show full body"}
          </button>

          {expanded && (
            <div className="whitespace-pre-wrap border-t border-white/[0.06] px-3 py-2.5 text-[11px] leading-relaxed text-slate-300">
              {email.body}
            </div>
          )}
        </>
      )}
    </div>
  );
}
