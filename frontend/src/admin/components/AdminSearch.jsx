import { useRef, useState } from "react";
import { useI18n } from "../../i18n/index.jsx";
import { Icon } from "../../components/ui/icons.jsx";

const SPEECH_LANG = { en: "en-IN", hi: "hi-IN", ur: "ur-PK" };
const SpeechRecognition = typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

const MicIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="9" y="3" width="6" height="12" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
  </svg>
);

/**
 * The admin's article search box (Dashboard and Articles page): type in any script, or speak.
 * It only holds the text; the page runs the search, and the server uses the SAME sounds-alike matching as the
 * home page search (Roman / Hindi / Urdu spellings meet, small spelling slips still match).
 */
export default function AdminSearch({ value, onChange, placeholder = "Article search karein…", className = "" }) {
  const { contentLang } = useI18n();
  const [listening, setListening] = useState(false);
  const recRef = useRef(null);

  const toggleMic = () => {
    if (!SpeechRecognition) return;
    if (listening && recRef.current) { recRef.current.stop(); return; }
    const rec = new SpeechRecognition();
    rec.lang = SPEECH_LANG[contentLang] || "ur-PK";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => { const heard = e.results?.[0]?.[0]?.transcript || ""; if (heard) onChange(heard); };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    try { rec.start(); } catch { setListening(false); }
  };

  return (
    <div role="search" className={`flex items-center gap-1 rounded-full border border-ad-rule bg-ad-card py-1 ps-4 pe-1.5 focus-within:border-ad-brand ${className}`}>
      <Icon name="search" size={16} />
      <input
        type="search" value={value} onChange={(e) => onChange(e.target.value)} maxLength={100} dir="auto" enterKeyHint="search"
        placeholder={placeholder} aria-label="Search articles"
        className="min-w-0 flex-1 bg-transparent px-2 py-1.5 text-sm text-ad-ink placeholder:text-ad-mute focus:outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button type="button" onClick={() => onChange("")} aria-label="Clear search" className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ad-mute hover:bg-ad-bg hover:text-ad-ink"><Icon name="x" size={15} /></button>
      )}
      {SpeechRecognition && (
        <button type="button" onClick={toggleMic} aria-label="Voice search" aria-pressed={listening}
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-full transition ${listening ? "animate-pulse bg-red-500/15 text-red-600" : "text-ad-mute hover:bg-ad-bg hover:text-ad-ink"}`}>
          <MicIcon />
        </button>
      )}
    </div>
  );
}
