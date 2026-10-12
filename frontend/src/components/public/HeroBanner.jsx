import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "../../i18n/index.jsx";
import { useNow } from "../../lib/useNow.js";
import { hourOf, sceneSvg, skyAt, skyGradient } from "../../lib/sky.js";
import { HERO_SEARCH_PLACEHOLDER, HERO_TEXT } from "../../config/hero.js";
import { Icon } from "../ui/icons.jsx";

const SPEECH_LANG = { en: "en-IN", hi: "hi-IN", ur: "ur-PK" };
const SpeechRecognition = typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

/** Test helper: open the site with ?sky=18.5 to preview 18:30 (any 0-24 hour). Normal visitors never see this. */
function previewHour() {
  try {
    const v = parseFloat(new URLSearchParams(window.location.search).get("sky"));
    return Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

function MicIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="3" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}

/** Search pill that sits under the banner: search icon, text field, mic (only where the browser supports voice input). */
export function HeroSearch({ overlap = true }) {
  const navigate = useNavigate();
  const { contentLang } = useI18n();
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const recRef = useRef(null);

  const go = (value) => {
    const v = (value ?? text).trim();
    if (v) navigate(`/search?q=${encodeURIComponent(v)}`);
  };

  const toggleMic = () => {
    if (!SpeechRecognition) return;
    if (listening && recRef.current) { recRef.current.stop(); return; }
    const rec = new SpeechRecognition();
    rec.lang = SPEECH_LANG[contentLang] || "ur-PK";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      const heard = e.results?.[0]?.[0]?.transcript || "";
      setText(heard);
      go(heard);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    try { rec.start(); } catch { setListening(false); }
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); go(); }} role="search"
      className={`relative z-10 mx-auto flex w-[92%] max-w-2xl items-center gap-2 rounded-full border border-rule bg-field py-2 ps-4 pe-3 shadow-[0_4px_18px_rgb(0_0_0/0.14)] sm:py-2.5 sm:ps-5 ${overlap ? "-mt-7 sm:-mt-8" : "mt-1 sm:mt-2"}`}>
      <button type="submit" aria-label="Search" className="shrink-0 text-ink"><Icon name="search" size={24} /></button>
      <input type="search" value={text} onChange={(e) => setText(e.target.value)} maxLength={100} dir="auto" enterKeyHint="search"
        placeholder={HERO_SEARCH_PLACEHOLDER} aria-label={HERO_SEARCH_PLACEHOLDER}
        className="min-w-0 flex-1 bg-transparent py-1.5 text-base text-ink placeholder:text-ink/80 focus:outline-none [&::-webkit-search-cancel-button]:hidden" />
      {SpeechRecognition && (
        <button type="button" onClick={toggleMic} aria-label="Voice search" aria-pressed={listening}
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-full transition ${listening ? "animate-pulse bg-red-500/15 text-red-600" : "text-ink hover:bg-tint"}`}>
          <MicIcon />
        </button>
      )}
    </form>
  );
}

/** Home hero: desert + mosque banner whose sky follows the visitor's clock (dawn red, yellow day, sunset violet, blue night), then the search bar. */
export function HeroBanner() {
  const now = useNow(true, 30000); // re-colours every 30 s, so the sky drifts smoothly
  const preview = previewHour();
  const hour = preview ?? hourOf(new Date(now));
  const sky = useMemo(() => skyAt(hour), [hour]);
  const scene = useMemo(() => sceneSvg(sky), [sky]);

  return (
    <section className="px-2 pb-2 pt-3 sm:px-8 sm:pt-5">
      <div className="mx-auto max-w-3xl">
        <div className="relative h-[19rem] overflow-hidden rounded-2xl shadow-[0_2px_10px_rgb(0_0_0/0.12)] sm:h-[21rem]" style={{ background: skyGradient(sky), transition: "background 2s linear" }}>
          <div className="absolute inset-0" dangerouslySetInnerHTML={{ __html: scene }} />
          <h1 dir="rtl" lang="ur" className="script-urdu relative z-10 mx-auto max-w-[34rem] px-5 pt-6 text-center text-[1.2rem] sm:pt-8 sm:text-[1.6rem]" style={{ color: sky.text, textShadow: sky.shadow }}>
            {HERO_TEXT}
          </h1>
        </div>
        <HeroSearch />
      </div>
    </section>
  );
}
