import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8003";
const API_HEADERS = { "X-API-Key": import.meta.env.VITE_API_KEY || "12345" };
const SESSION_KEY = "briefing_dismissed";

function isToday(isoString) {
  if (!isoString) return false;
  const d = new Date(isoString);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function BriefingBanner() {
  const [text, setText] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY)) return;
    fetch(`${API_BASE}/scheduler/briefing`, { headers: API_HEADERS })
      .then((r) => r.json())
      .then((data) => {
        if (data.text && isToday(data.generated_at)) {
          setText(data.text);
          setVisible(true);
        }
      })
      .catch(() => {});
  }, []);

  function dismiss() {
    sessionStorage.setItem(SESSION_KEY, "1");
    setVisible(false);
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.25 }}
          className="mb-4 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 shadow-[0_0_20px_rgba(245,158,11,0.08)]"
        >
          <div className="flex items-start gap-3">
            <span className="mt-0.5 select-none text-lg leading-none">☀️</span>
            <div className="min-w-0 flex-1">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-amber-300/80">
                Morning Briefing
              </p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-amber-100/90">
                {text}
              </p>
            </div>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Dismiss briefing"
              className="mt-0.5 flex-shrink-0 rounded-full p-1 text-amber-300/50 transition hover:bg-amber-400/15 hover:text-amber-200"
            >
              ✕
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default BriefingBanner;
