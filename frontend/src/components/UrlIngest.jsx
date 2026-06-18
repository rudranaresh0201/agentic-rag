import { useState } from "react";
import { HiLink, HiArrowPath, HiCheckCircle } from "react-icons/hi2";

function UrlIngest({ onIngest, collapsed }) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null); // "ok" | "duplicate" | "error"
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setStatus(null);
    setErrorMsg("");

    try {
      const result = await onIngest(trimmed);
      setStatus(result?.status === "already_ingested" ? "duplicate" : "ok");
      setUrl("");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err?.message || "Failed to ingest URL");
    } finally {
      setLoading(false);
    }
  };

  if (collapsed) {
    return (
      <button
        type="button"
        title="Ingest URL"
        className="flex w-full items-center justify-center rounded-xl border border-white/10 bg-slate-950/60 p-2 text-slate-300 transition hover:border-indigo-400/50 hover:text-indigo-200"
        onClick={() => {}}
      >
        <HiLink className="text-base" />
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
        Ingest URL
      </p>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => { setUrl(e.target.value); setStatus(null); }}
          placeholder="https://example.com/article"
          disabled={loading}
          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-slate-900 px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-indigo-400/60 focus:outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={loading || !url.trim()}
          className="flex items-center gap-1 rounded-lg border border-indigo-400/40 bg-indigo-500/20 px-3 py-1.5 text-xs font-semibold text-indigo-100 transition hover:bg-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <HiArrowPath className="animate-spin text-sm" />
          ) : (
            <HiLink className="text-sm" />
          )}
          {loading ? "Fetching…" : "Add"}
        </button>
      </form>

      {status === "ok" && (
        <p className="mt-1.5 flex items-center gap-1 text-xs text-emerald-300">
          <HiCheckCircle /> Ingested successfully
        </p>
      )}
      {status === "duplicate" && (
        <p className="mt-1.5 text-xs text-slate-400">Already in knowledge base.</p>
      )}
      {status === "error" && (
        <p className="mt-1.5 text-xs text-rose-300">{errorMsg}</p>
      )}
    </div>
  );
}

export default UrlIngest;
