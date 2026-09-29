import Container from "../common/Container.jsx";
import SectionHeading from "../common/SectionHeading.jsx";
import { LibraryIcon } from "../common/Icons.jsx";

/**
 * The library is intentionally empty until an admin publishes articles.
 * This renders a genuine empty state rather than any placeholder/sample
 * research content, and is where a real article grid will render once
 * the articles API exists.
 */
export default function LibrarySection() {
  return (
    <section className="bg-slate-50 py-16 sm:py-20">
      <Container className="flex flex-col gap-10">
        <SectionHeading
          eyebrow="Research library"
          title="Published research"
          subtitle="Articles will appear here as soon as they're reviewed and published by an admin."
        />

        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <LibraryIcon className="h-6 w-6" />
          </span>
          <h3 className="mt-5 font-serif text-lg font-semibold text-slate-900">
            No research published yet
          </h3>
          <p className="mt-2 max-w-sm text-sm text-slate-500">
            This library is admin-driven — new Aqeedah and Masail articles
            will show up here as soon as they go live.
          </p>
        </div>
      </Container>
    </section>
  );
}
