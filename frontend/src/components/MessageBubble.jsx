import EmailCard from "./EmailCard";
import EventCard from "./EventCard";
import MediaPlayer from "./MediaPlayer";

export default function MessageBubble({ message }) {
  const text = message?.content || message?.text || "";

  const sources = Array.isArray(message?.sources)
    ? message.sources
        .map((src, idx) => {
          if (src && typeof src === "object") {
            return {
              id: Number(src.id) || idx + 1,
              document: src.document || src.title || "Uploaded Doc",
              page: src.page ?? null,
              text: String(src.text || "").trim(),
            };
          }
          if (typeof src === "string") {
            return { id: idx + 1, document: "Uploaded Doc", page: null, text: src };
          }
          return null;
        })
        .filter(Boolean)
    : [];

  const gmailResults    = Array.isArray(message?.gmail_results)    ? message.gmail_results    : [];
  const calendarResults = Array.isArray(message?.calendar_results) ? message.calendar_results : [];

  const scrollToSource = (sourceId) => {
    const el = document.getElementById(`source-${sourceId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    const original = el.style.background;
    el.style.background = "rgba(99,102,241,0.18)";
    window.setTimeout(() => { el.style.background = original; }, 900);
  };

  const renderTextWithCitations = (value) => {
    if (!value) return null;
    const parts = String(value).split(/(\[\d+\])/g);
    return parts.map((part, idx) => {
      const match = part.match(/^\[(\d+)\]$/);
      if (!match) return <span key={idx}>{part}</span>;
      return (
        <span
          key={idx}
          className="cursor-pointer font-medium text-indigo-400 hover:underline"
          onClick={() => scrollToSource(Number(match[1]))}
        >
          {part}
        </span>
      );
    });
  };

  return (
    <div>
      {/* Answer text */}
      <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-100">
        {renderTextWithCitations(text)}
      </div>

      {/* Media player */}
      {message?.media_result && <MediaPlayer media_result={message.media_result} />}

      {/* Gmail results */}
      {gmailResults.length > 0 && (
        <div className="mt-3 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            📧 Gmail · {gmailResults.length} email{gmailResults.length !== 1 ? "s" : ""}
          </p>
          {gmailResults.map((email, i) => (
            <EmailCard key={i} email={email} />
          ))}
        </div>
      )}

      {/* Calendar results */}
      {calendarResults.length > 0 && (
        <div className="mt-3 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            📅 Calendar · {calendarResults.length} event{calendarResults.length !== 1 ? "s" : ""}
          </p>
          {calendarResults.map((event, i) => (
            <EventCard key={i} event={event} />
          ))}
        </div>
      )}

      {/* RAG source citations */}
      {sources.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Sources
          </p>
          <div className="space-y-1.5">
            {sources.map((src) => (
              <div
                id={`source-${src.id}`}
                key={src.id}
                className="rounded-lg border border-white/[0.07] bg-slate-950/60 p-2 transition-colors duration-300"
              >
                <p className="text-[10px] font-semibold text-slate-400">
                  [{src.id}] {src.document}
                  {src.page ? ` · Page ${src.page}` : ""}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-400">{src.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
