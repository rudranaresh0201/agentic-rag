function fmt(dt) {
  if (!dt) return "";
  try {
    const d = new Date(dt);
    if (isNaN(d.getTime())) return dt;
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return dt;
  }
}

export default function EventCard({ event }) {
  return (
    <div className="flex overflow-hidden rounded-xl border border-white/10 bg-slate-900/80">
      {/* Colored left accent bar */}
      <div className="w-1 flex-shrink-0 bg-gradient-to-b from-emerald-500 to-cyan-500" />

      <div className="flex-1 px-3 py-2.5">
        <p className="text-xs font-semibold text-slate-100">
          {event.title || "Untitled event"}
        </p>

        <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-400">
          <span>🕐</span>
          <span>{fmt(event.start)}</span>
          {event.end && (
            <>
              <span className="text-slate-600">→</span>
              <span>{fmt(event.end)}</span>
            </>
          )}
        </div>

        {event.location && (
          <div className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-400">
            <span>📍</span>
            <span>{event.location}</span>
          </div>
        )}

        {event.description && (
          <p className="mt-1 line-clamp-2 text-[10px] text-slate-500">
            {event.description}
          </p>
        )}
      </div>
    </div>
  );
}
