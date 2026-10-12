import { HERO_TEXT } from "../../config/hero.js";
import { HeroSearch } from "./HeroBanner.jsx";

/** Home hero with a photo of Masjid-e-Nabawi (green dome) on top, the Urdu line beneath it, then the search bar.
 *  Photo file: public/images/hero-nabawi.jpg (replace the file to change the picture, same name). */
export function HeroPhoto() {
  return (
    <section className="px-2 pb-2 pt-3 sm:px-8 sm:pt-5">
      <div className="mx-auto max-w-3xl">
        <div className="sanad-hero overflow-hidden rounded-xl shadow-[0_2px_10px_rgb(0_0_0/0.14)]">
          <img src="/images/hero-nabawi.jpg" width="736" height="414" alt="مسجد نبوی ﷺ، گنبد خضریٰ" fetchpriority="high" decoding="async" className="block aspect-[16/10] w-full object-cover sm:aspect-[16/9]" />
          <h1 dir="rtl" lang="ur" className="script-urdu mx-auto max-w-[34rem] px-5 pb-12 pt-4 text-center text-[1.2rem] text-[#fbf3dc] sm:pb-14 sm:pt-5 sm:text-[1.6rem]">{HERO_TEXT}</h1>
        </div>
        <HeroSearch />
      </div>
    </section>
  );
}
