import { useState } from "react";

export default function MediaPlayer({ media_result }) {
  const [minimized, setMinimized] = useState(false);

  if (!media_result?.video_id) return null;

  const { video_id, title } = media_result;

  return (
    <div className="mt-3 w-full max-w-[480px]">
      <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0f172a] shadow-lg">
        {/* Title bar */}
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <span
            className="truncate text-sm font-medium text-slate-200"
            title={title}
          >
            {title}
          </span>
          <button
            onClick={() => setMinimized((v) => !v)}
            className="shrink-0 rounded p-1 text-slate-400 transition hover:bg-white/10 hover:text-slate-100"
            aria-label={minimized ? "Expand player" : "Minimize player"}
          >
            {minimized ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
                <path fillRule="evenodd" d="M4.22 10.22a.75.75 0 0 1 1.06 0L8 12.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 11.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                <path fillRule="evenodd" d="M4.22 5.78a.75.75 0 0 0 1.06 0L8 3.06l2.72 2.72a.75.75 0 0 0 1.06-1.06L8.53 1.47a.75.75 0 0 0-1.06 0L4.22 4.72a.75.75 0 0 0 0 1.06Z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
                <path fillRule="evenodd" d="M11.78 5.78a.75.75 0 0 0-1.06 0L8 8.44 5.28 5.72a.75.75 0 0 0-1.06 1.06l3.25 3.25a.75.75 0 0 0 1.06 0l3.25-3.25a.75.75 0 0 0 0-1.06Z" clipRule="evenodd" />
              </svg>
            )}
          </button>
        </div>

        {/* 16:9 iframe */}
        {!minimized && (
          <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
            <iframe
              src={`https://www.youtube.com/embed/${video_id}?autoplay=1`}
              title={title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="absolute inset-0 h-full w-full border-0"
            />
          </div>
        )}
      </div>
    </div>
  );
}
