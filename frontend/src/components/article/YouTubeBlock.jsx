import { useEffect, useRef, useState } from "react";
import { youtubeThumb } from "../../lib/youtube.js";

/* The YouTube player script is loaded once, and only when a reader actually presses play. */
let apiPromise = null;
function loadYouTubeApi() {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!apiPromise) {
    apiPromise = new Promise((resolve, reject) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { if (typeof prev === "function") prev(); resolve(window.YT); };
      const s = document.createElement("script");
      s.src = "https://www.youtube.com/iframe_api";
      s.async = true;
      s.onerror = () => { apiPromise = null; reject(new Error("YouTube load nahi hua")); };
      document.head.appendChild(s);
    });
  }
  return apiPromise;
}

const clock = (sec) => {
  const t = Math.max(0, Math.floor(sec || 0));
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
};

const GREEN = "#16a34a"; // play button + sliders (fixed green, same in every theme)
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const HIDE_AFTER = 2500; // ms of playing before the controls fade away

const PlayIcon = ({ size = 20 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l13-7.5z" /></svg>;
const PauseIcon = ({ size = 20 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 4h4v16H6zM14 4h4v16h-4z" /></svg>;
const VolIcon = ({ muted, size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor" stroke="none" />
    {muted ? <path d="M17 9l5 6m0-6-5 6" /> : <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />}
  </svg>
);
const GearIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </svg>
);
const FullIcon = ({ on, size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {on ? <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /> : <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />}
  </svg>
);

/**
 * A YouTube video inside the article: a sharp-cornered 16:9 window (like the cover images) that plays right here and
 * never opens YouTube. One big play / pause button sits in the centre; touching the video only shows or hides the
 * controls (time + seek slider, volume, speed, maximize), it never pauses. While playing, the controls fade away by themselves.
 */
export function YouTubeBlock({ videoId, caption }) {
  const [active, setActive] = useState(false);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);
  const [failed, setFailed] = useState(false);
  const [show, setShow] = useState(true);
  const [muted, setMuted] = useState(false);
  const [vol, setVol] = useState(100);
  const [rate, setRate] = useState(1);
  const [menu, setMenu] = useState(false);
  const [full, setFull] = useState(false); // maximized (real full screen, or a page-filling window where the browser has none)
  const box = useRef(null);
  const host = useRef(null);
  const player = useRef(null);
  const dragging = useRef(false);
  const hideTimer = useRef(null);

  useEffect(() => {
    if (!active) return undefined;
    let dead = false;
    let timer;
    loadYouTubeApi().then((YT) => {
      if (dead || !host.current) return;
      const mount = document.createElement("div"); // the player replaces this element by its iframe
      host.current.appendChild(mount);
      player.current = new YT.Player(mount, {
        videoId,
        width: "100%",
        height: "100%",
        playerVars: { autoplay: 1, controls: 0, fs: 0, rel: 0, modestbranding: 1, playsinline: 1, iv_load_policy: 3, disablekb: 1, cc_load_policy: 0 },
        events: {
          onReady: (e) => { if (dead) return; setReady(true); setDur(e.target.getDuration() || 0); setVol(e.target.getVolume?.() ?? 100); setMuted(!!e.target.isMuted?.()); e.target.playVideo(); },
          onStateChange: (e) => {
            if (dead) return;
            if (e.data === 0) { e.target.seekTo(0, true); e.target.pauseVideo(); setPlaying(false); return; } // ended: back to the start (no "more videos" screen)
            setPlaying(e.data === 1 || e.data === 3);
            if (e.data === 1) setDur(e.target.getDuration() || 0);
          },
          onError: () => { if (!dead) setFailed(true); },
        },
      });
      timer = setInterval(() => {
        const p = player.current;
        if (p?.getCurrentTime && !dragging.current) setCur(p.getCurrentTime() || 0);
      }, 400);
    }).catch(() => { if (!dead) setFailed(true); });
    return () => {
      dead = true;
      clearInterval(timer);
      clearTimeout(hideTimer.current);
      try { player.current?.destroy(); } catch { /* ignore */ }
      player.current = null;
    };
  }, [active, videoId]);

  // Controls: always visible while paused; while playing they hide after a short while.
  const wake = () => {
    setShow(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => { setShow(false); setMenu(false); }, HIDE_AFTER);
  };
  useEffect(() => {
    clearTimeout(hideTimer.current);
    if (!playing) { setShow(true); return undefined; }
    hideTimer.current = setTimeout(() => { setShow(false); setMenu(false); }, HIDE_AFTER);
    return () => clearTimeout(hideTimer.current);
  }, [playing]);

  useEffect(() => {
    const onChange = () => setFull(!!document.fullscreenElement && document.fullscreenElement === box.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggle = () => {
    const p = player.current;
    if (!p || !ready) return;
    if (playing) p.pauseVideo(); else { p.playVideo(); wake(); }
  };
  const move = (e) => { const v = Number(e.target.value); dragging.current = true; setCur(v); try { player.current?.seekTo(v, false); } catch { /* ignore */ } };
  const release = (e) => { const v = Number(e.currentTarget.value); dragging.current = false; try { player.current?.seekTo(v, true); } catch { /* ignore */ } wake(); };
  const toggleMute = () => { const p = player.current; if (!p) return; if (muted || vol === 0) { p.unMute(); if (vol === 0) { p.setVolume(60); setVol(60); } setMuted(false); } else { p.mute(); setMuted(true); } wake(); };
  const setVolume = (e) => { const v = Number(e.target.value); setVol(v); const p = player.current; if (!p) return; p.setVolume(v); if (v > 0 && muted) { p.unMute(); setMuted(false); } wake(); };
  const pickRate = (r) => { try { player.current?.setPlaybackRate(r); } catch { /* ignore */ } setRate(r); setMenu(false); wake(); };
  const maximize = async () => {
    const el = box.current;
    if (!el) return;
    if (full) {
      if (document.fullscreenElement) { try { await document.exitFullscreen(); } catch { /* ignore */ } }
      setFull(false);
    } else if (el.requestFullscreen) {
      try { await el.requestFullscreen(); } catch { setFull(true); }
    } else setFull(true); // iPhone browsers: fill the page instead
    wake();
  };

  const visible = ready && (show || !playing);
  const frame = full
    ? "fixed inset-0 z-[300] h-full w-full border-0"
    : "relative aspect-video w-full border border-rule";

  return (
    <figure className="my-7" dir="ltr">
      <div ref={box} className={`${frame} overflow-hidden rounded-none bg-black`}>
        <div ref={host} className="absolute inset-0 [&_iframe]:h-full [&_iframe]:w-full" />

        {(!active || !ready) && (
          <button type="button" disabled={active} onClick={() => { setFailed(false); setActive(true); }} aria-label="Play video"
            className="group absolute inset-0 z-10 block h-full w-full bg-black p-0">
            <img src={youtubeThumb(videoId)} alt="" loading="lazy" className="h-full w-full object-cover" />
            <span className="absolute inset-0 grid place-items-center">
              {failed
                ? <span className="rounded bg-black/70 px-3 py-1.5 text-sm text-white">Video load nahi ho paya</span>
                : active
                  ? <span className="rounded bg-black/60 px-3 py-1.5 text-sm text-white">Loading…</span>
                  : <span className="grid h-16 w-16 place-items-center rounded-full text-white shadow-lg transition group-hover:scale-105" style={{ background: GREEN }}><PlayIcon size={30} /></span>}
            </span>
          </button>
        )}

        {ready && (
          <>
            {/* Touching the video only shows / hides the controls - it never pauses. It also keeps taps away from YouTube's own page. */}
            <div className="absolute inset-0 z-10" onClick={wake} role="presentation" />

            <div className={`pointer-events-none absolute inset-0 z-20 grid place-items-center transition-opacity duration-200 ${visible ? "opacity-100" : "opacity-0"}`}>
              <button type="button" onClick={toggle} aria-label={playing ? "Pause" : "Play"} tabIndex={visible ? 0 : -1}
                className={`grid h-16 w-16 place-items-center rounded-full text-white shadow-lg transition active:scale-95 ${visible ? "pointer-events-auto" : ""}`} style={{ background: GREEN }}>
                {playing ? <PauseIcon size={30} /> : <PlayIcon size={30} />}
              </button>
            </div>

            <div className={`absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/80 via-black/50 to-transparent px-3 pb-2 pt-8 text-white transition-opacity duration-200 ${visible ? "opacity-100" : "pointer-events-none opacity-0"}`}>
              <input type="range" min={0} max={Math.max(dur, 1)} step={1} value={Math.min(cur, Math.max(dur, 1))} onChange={move} onPointerUp={release} onKeyUp={release} aria-label="Seek"
                className="block h-1.5 w-full cursor-pointer" style={{ accentColor: GREEN }} />
              <div className="mt-1 flex items-center gap-2 text-xs sm:gap-3">
                <span className="shrink-0 tabular-nums">{clock(cur)} / {clock(dur)}</span>
                <span className="flex-1" />
                <button type="button" onClick={toggleMute} aria-label={muted || vol === 0 ? "Unmute" : "Mute"} className="grid h-8 w-8 shrink-0 place-items-center"><VolIcon muted={muted || vol === 0} /></button>
                <input type="range" min={0} max={100} step={1} value={muted ? 0 : vol} onChange={setVolume} aria-label="Volume" className="hidden h-1 w-16 cursor-pointer sm:block" style={{ accentColor: GREEN }} />
                <div className="relative">
                  <button type="button" onClick={() => { setMenu((m) => !m); wake(); }} aria-label="Speed" aria-expanded={menu} className="grid h-8 w-8 shrink-0 place-items-center"><GearIcon /></button>
                  {menu && (
                    <div className="absolute bottom-10 end-0 min-w-[7.5rem] rounded-none border border-white/20 bg-black/90 py-1 text-sm shadow-lg">
                      <p className="px-3 pb-1 text-[11px] uppercase tracking-wide text-white/60">Speed</p>
                      {SPEEDS.map((r) => (
                        <button key={r} type="button" onClick={() => pickRate(r)} className="flex w-full items-center justify-between gap-3 px-3 py-1.5 text-start hover:bg-white/10">
                          <span>{r === 1 ? "Normal" : `${r}x`}</span>{rate === r && <span style={{ color: GREEN }}>✓</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button type="button" onClick={maximize} aria-label={full ? "Exit full screen" : "Maximize"} className="grid h-8 w-8 shrink-0 place-items-center"><FullIcon on={full} /></button>
              </div>
            </div>
          </>
        )}
      </div>
      {caption ? <figcaption className="mt-2 text-center text-sm text-mute">{caption}</figcaption> : null}
    </figure>
  );
}
