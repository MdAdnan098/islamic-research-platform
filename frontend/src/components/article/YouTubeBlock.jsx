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

const PlayIcon = ({ size = 20 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l13-7.5z" /></svg>;
const PauseIcon = ({ size = 20 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 4h4v16H6zM14 4h4v16h-4z" /></svg>;

/**
 * A YouTube video inside the article: a sharp-cornered 16:9 window (like the cover images), plays right here (never
 * opens YouTube, no full screen), with its own play / pause button and a slider to move forward and back.
 */
export function YouTubeBlock({ videoId, caption }) {
  const [active, setActive] = useState(false);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);
  const [failed, setFailed] = useState(false);
  const host = useRef(null);
  const player = useRef(null);
  const dragging = useRef(false);

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
          onReady: (e) => { if (dead) return; setReady(true); setDur(e.target.getDuration() || 0); e.target.playVideo(); },
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
      try { player.current?.destroy(); } catch { /* ignore */ }
      player.current = null;
    };
  }, [active, videoId]);

  const toggle = () => {
    const p = player.current;
    if (!p || !ready) return;
    if (playing) p.pauseVideo(); else p.playVideo();
  };
  const move = (e) => { const v = Number(e.target.value); dragging.current = true; setCur(v); try { player.current?.seekTo(v, false); } catch { /* ignore */ } };
  const release = (e) => { const v = Number(e.currentTarget.value); dragging.current = false; try { player.current?.seekTo(v, true); } catch { /* ignore */ } };

  return (
    <figure className="my-7" dir="ltr">
      <div className="relative aspect-video w-full overflow-hidden rounded-none border border-rule bg-black">
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
                  : <span className="grid h-14 w-20 place-items-center rounded-xl bg-[#f00] text-white shadow-lg transition group-hover:scale-105"><PlayIcon size={28} /></span>}
            </span>
          </button>
        )}
        {ready && (
          <div className="absolute inset-0 z-10 grid cursor-pointer place-items-center" onClick={toggle} role="presentation">
            {!playing && <span className="grid h-14 w-20 place-items-center rounded-xl bg-[#f00]/95 text-white shadow-lg"><PlayIcon size={28} /></span>}
          </div>
        )}
      </div>
      {active && ready && (
        <div className="flex items-center gap-3 border border-t-0 border-rule bg-card px-3 py-2 text-ink">
          <button type="button" onClick={toggle} aria-label={playing ? "Pause" : "Play"} className="grid h-8 w-8 shrink-0 place-items-center text-ink hover:text-accent">
            {playing ? <PauseIcon /> : <PlayIcon />}
          </button>
          <input type="range" min={0} max={Math.max(dur, 1)} step={1} value={Math.min(cur, Math.max(dur, 1))} onChange={move} onPointerUp={release} onKeyUp={release} aria-label="Seek"
            className="h-1.5 min-w-0 flex-1 cursor-pointer accent-[#f00]" />
          <span className="shrink-0 text-xs tabular-nums text-mute">{clock(cur)} / {clock(dur)}</span>
        </div>
      )}
      {caption ? <figcaption className="mt-2 text-center text-sm text-mute">{caption}</figcaption> : null}
    </figure>
  );
}
