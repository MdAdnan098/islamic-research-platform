import { HERO_TEXT } from "../../config/hero.js";
import { HeroSearch } from "./HeroBanner.jsx";

/** Home hero (sunnah.com style): photo banner (Gumbad-e-Khazra), the Urdu line right under it, then the search bar.
 *  Photo file: public/images/hero-gumbad.jpg (replace the file, same name, to change the picture).
 *  The banner keeps the photo's own proportions (700x467) - only a small side padding, corners lightly rounded. */
export function HeroImage() {
  return (
    <section className="px-3 pb-2 pt-3 sm:px-8 sm:pt-5">
      <div className="mx-auto max-w-3xl">
        <img src="/images/hero-gumbad.jpg" width="700" height="467" alt="مسجد نبوی ﷺ، گنبد خضریٰ" fetchpriority="high" decoding="async"
          className="mx-auto block h-auto w-full max-w-[700px] rounded-xl shadow-[0_2px_10px_rgb(0_0_0/0.12)]" />
        <h1 dir="rtl" lang="ur" className="script-arabic hero-ink mx-auto mt-3 max-w-[34rem] px-2 text-center text-[1.3rem] sm:mt-4 sm:text-[1.75rem]">{HERO_TEXT}</h1>
        <HeroSearch overlap={false} />
      </div>
    </section>
  );
}
