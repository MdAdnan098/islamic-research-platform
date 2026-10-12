import { HERO_TEXT } from "../../config/hero.js";
import { HeroSearch } from "./HeroBanner.jsx";

/** Chain of transmission, Rasool (SAW) first. Right-to-left, so the first link sits on the right. */
const CHAIN = ["رسول اللہ ﷺ", "صحابہ کرام", "تابعین", "ائمہ محدثین", "کتب", "ہم تک"];

/** Home hero "sanad ka silsila": links light up one by one from Rasoolullah (SAW) to us, then the cycle repeats. Search bar below. */
export function HeroSanad() {
  return (
    <section className="px-2 pb-2 pt-3 sm:px-8 sm:pt-5">
      <div className="mx-auto max-w-3xl">
        <div className="sanad-hero relative overflow-hidden rounded-2xl px-4 pb-12 pt-6 text-center shadow-[0_2px_10px_rgb(0_0_0/0.14)] sm:px-10 sm:pb-14 sm:pt-8">
          <h1 dir="rtl" lang="ur" className="script-urdu mx-auto max-w-[34rem] text-[1.2rem] text-[#fbf3dc] sm:text-[1.6rem]">{HERO_TEXT}</h1>
          <div dir="rtl" className="mx-auto mt-5 flex max-w-xl items-start sm:mt-7" aria-label="سند کا سلسلہ">
            {CHAIN.map((label, i) => (
              <div key={label} className="contents">
                <div className="flex w-[3.3rem] shrink-0 flex-col items-center sm:w-20">
                  <span className="sanad-node block h-[22px] w-[22px] rounded-full border-2 sm:h-7 sm:w-7" style={{ "--i": i }} />
                  <span lang="ur" className="script-urdu mt-1 text-[0.72rem] text-[#f3e6bd] sm:text-[0.95rem]" style={{ lineHeight: "1.7" }}>{label}</span>
                </div>
                {i < CHAIN.length - 1 && <span className="sanad-link mt-[10px] h-[2px] min-w-[4px] flex-1 sm:mt-[13px]" style={{ "--i": i }} />}
              </div>
            ))}
          </div>
          <p dir="rtl" lang="ar" className="script-arabic mt-3 text-[1.05rem] text-[#e8c873] sm:text-[1.3rem]">الإسناد من الدين</p>
        </div>
        <HeroSearch />
      </div>
    </section>
  );
}
