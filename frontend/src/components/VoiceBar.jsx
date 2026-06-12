import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { HiMicrophone, HiSpeakerWave } from "react-icons/hi2";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8003";
const API_HEADERS = { "X-API-Key": import.meta.env.VITE_API_KEY || "12345" };

function VoiceBar({ onTranscript, answerToSpeak }) {
  const [mode, setModeState] = useState("idle"); // idle | recording | transcribing | speaking
  const modeRef = useRef("idle");
  const prevAnswerRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  function setMode(m) {
    modeRef.current = m;
    setModeState(m);
  }

  useEffect(() => {
    if (!answerToSpeak || answerToSpeak === prevAnswerRef.current) return;
    prevAnswerRef.current = answerToSpeak;
    if (modeRef.current === "recording" || modeRef.current === "transcribing") return;
    speakAnswer(answerToSpeak);
  }, [answerToSpeak]);

  async function speakAnswer(text) {
    setMode("speaking");
    try {
      const res = await fetch(`${API_BASE}/voice/speak`, {
        method: "POST",
        headers: { ...API_HEADERS, "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (data.fallback || !data.audio_base64) {
        browserTTS(text);
      } else {
        const audio = new Audio(`data:audio/mp3;base64,${data.audio_base64}`);
        audio.onended = () => setMode("idle");
        audio.onerror = () => browserTTS(text);
        audio.play();
      }
    } catch {
      browserTTS(text);
    }
  }

  function browserTTS(text) {
    if (!window.speechSynthesis) { setMode("idle"); return; }
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.onend = () => setMode("idle");
    utt.onerror = () => setMode("idle");
    window.speechSynthesis.speak(utt);
  }

  async function handleClick() {
    if (mode === "recording") {
      mediaRecorderRef.current?.stop();
      return;
    }
    if (mode === "speaking") {
      window.speechSynthesis?.cancel();
      setMode("idle");
      return;
    }
    if (mode !== "idle") return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setMode("transcribing");
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        await transcribe(blob);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setMode("recording");
    } catch {
      setMode("idle");
    }
  }

  async function transcribe(blob) {
    try {
      const form = new FormData();
      form.append("file", blob, "audio.webm");
      const res = await fetch(`${API_BASE}/voice/transcribe`, {
        method: "POST",
        headers: API_HEADERS,
        body: form,
      });
      if (!res.ok) return;
      const data = await res.json();
      const text = data.text?.trim();
      if (text) onTranscript?.(text);
    } catch {
      // silently ignore network errors
    } finally {
      setMode("idle");
    }
  }

  const label = {
    idle: "Start voice input",
    recording: "Stop recording",
    transcribing: "Transcribing…",
    speaking: "Stop speaking",
  }[mode];

  return (
    <div className="fixed bottom-[88px] left-1/2 z-20 -translate-x-1/2">
      <motion.button
        type="button"
        onClick={handleClick}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.94 }}
        aria-label={label}
        title={label}
        className={`relative flex h-11 w-11 items-center justify-center rounded-full border shadow-lg transition-colors ${
          mode === "recording"
            ? "border-rose-400/60 bg-rose-500/20 text-rose-300"
            : mode === "speaking"
            ? "border-indigo-400/60 bg-indigo-500/20 text-indigo-300"
            : mode === "transcribing"
            ? "border-slate-400/30 bg-slate-800/90 text-slate-400"
            : "border-white/15 bg-slate-900/90 text-slate-300 hover:border-indigo-400/50 hover:text-indigo-200"
        }`}
      >
        {mode === "transcribing" ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
        ) : mode === "speaking" ? (
          <HiSpeakerWave className="h-5 w-5" />
        ) : (
          <HiMicrophone className="h-5 w-5" />
        )}

        {mode === "recording" && (
          <span className="absolute inset-0 animate-ping rounded-full bg-rose-500/25" />
        )}

        {mode === "speaking" && (
          <span className="absolute inset-0 animate-pulse rounded-full bg-indigo-500/15" />
        )}
      </motion.button>
    </div>
  );
}

export default VoiceBar;
