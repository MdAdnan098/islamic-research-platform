import { useEffect, useState } from "react";
import { HERO_TEXT } from "../../config/hero.js";
import { HeroSearch } from "./HeroBanner.jsx";

/** Part of the day from the clock: drives the colour wash over the photo. */
function dayPart(date = new Date()) {
  const h = date.getHours();
  if (h >= 5 && h < 10) return "morning";
  if (h >= 10 && h < 16) return "noon";
  if (h >= 16 && h < 19) return "evening";
  return "night";
}

/** Home hero, "live" version of HeroImage: the SAME photo (public/images/hero-gumbad.jpg) with a very slow zoom,
 *  a soft glow and a time-of-day colour wash on top. Frame, Urdu line and search bar are identical to HeroImage.
 *  Styles: .hero-live-* in index.css. Motion is off for "reduce motion" and for Data Saver. */
export function HeroLive() {
  const [part, setPart] = useState(() => dayPart());
  useEffect(() => {
    const id = setInterval(() => setPart(dayPart()), 10 * 60 * 1000);
    return () => clearInterval(id);
  }, []);
  // If the photo fails to load (flaky mobile network, or a deploy still switching over), retry twice with a fresh URL.
  const [tries, setTries] = useState(0);
  const retry = () => { if (tries < 2) setTimeout(() => setTries((n) => n + 1), 1200); };
  const still = typeof navigator !== "undefined" && navigator.connection?.saveData;

  return (
    <section className="px-3 pb-2 pt-3 sm:px-8 sm:pt-5">
      <div className="mx-auto max-w-3xl">
        {/* The photo keeps its natural height (same as HeroImage); the tint and glow are plain layers on top of it. */}
        <div className="relative isolate mx-auto w-full max-w-[700px] overflow-hidden rounded-xl shadow-[0_2px_10px_rgb(0_0_0/0.12)]">
          <img src={tries ? `/images/hero-gumbad.jpg?r=${tries}` : "/images/hero-gumbad.jpg"} onError={retry} width="700" height="467" alt="مسجد نبوی ﷺ، گنبد خضریٰ" fetchpriority="high" decoding="async"
            className={`block h-auto w-full ${still ? "" : "hero-live-zoom"}`} />
          <div key={part} data-part={part} className="hero-live-tint pointer-events-none absolute inset-0" aria-hidden="true" />
          {!still && <div className="hero-live-glow pointer-events-none absolute inset-0" aria-hidden="true" />}
        </div>
        <h1 dir="rtl" lang="ur" className="script-arabic hero-ink mx-auto mt-3 max-w-[34rem] px-2 text-center text-[1.3rem] sm:mt-4 sm:text-[1.75rem]">{HERO_TEXT}</h1>
        <HeroSearch overlap={false} />
      </div>
    </section>
  );
}
