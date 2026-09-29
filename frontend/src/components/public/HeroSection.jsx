import Container from "../common/Container.jsx";
import Button from "../common/Button.jsx";
import QuoteCard from "./QuoteCard.jsx";
import { ChevronRightIcon, ShieldCheckIcon } from "../common/Icons.jsx";

export default function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-hero-radial">
      {/* Decorative geometric backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(30deg, #0f172a 12%, transparent 12.5%, transparent 87%, #0f172a 87.5%, #0f172a), linear-gradient(150deg, #0f172a 12%, transparent 12.5%, transparent 87%, #0f172a 87.5%, #0f172a), linear-gradient(30deg, #0f172a 12%, transparent 12.5%, transparent 87%, #0f172a 87.5%, #0f172a), linear-gradient(150deg, #0f172a 12%, transparent 12.5%, transparent 87%, #0f172a 87.5%, #0f172a)",
          backgroundSize: "80px 140px",
        }}
      />

      <Container className="grid items-center gap-12 py-16 sm:py-20 lg:grid-cols-2 lg:py-28">
        <div className="flex flex-col items-start gap-6">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-100">
            <ShieldCheckIcon className="h-3.5 w-3.5" />
            Verified Islamic Research
          </span>

          <h1 className="font-serif text-4xl font-bold leading-tight text-slate-900 sm:text-5xl lg:text-[3.25rem]">
            Structured, source-referenced{" "}
            <span className="bg-gradient-to-r from-emerald-700 to-emerald-500 bg-clip-text text-transparent">
              Islamic research
            </span>
            , organized for clarity.
          </h1>

          <p className="max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
            A growing, admin-curated library covering Aqeedah and Masail —
            every entry built on structured references so you can trace each
            point back to its source.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button to="/aqeedah" variant="primary" size="lg" icon={<ChevronRightIcon />}>
              Explore Research
            </Button>
            <Button to="/masail" variant="secondary" size="lg">
              View References
            </Button>
          </div>
        </div>

        <div className="flex justify-center lg:justify-end">
          <QuoteCard />
        </div>
      </Container>
    </section>
  );
}
