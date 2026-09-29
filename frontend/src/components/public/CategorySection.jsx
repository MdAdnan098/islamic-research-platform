import Container from "../common/Container.jsx";
import SectionHeading from "../common/SectionHeading.jsx";
import CategoryCard from "./CategoryCard.jsx";
import { BookOpenIcon, ScaleIcon } from "../common/Icons.jsx";

/**
 * Static category shell for now (Aqeedah / Masail are core, fixed
 * sections of the platform). Once the backend exposes a categories
 * endpoint, this array can be replaced with fetched data without
 * changing CategoryCard itself.
 */
const CATEGORIES = [
  {
    key: "aqeedah",
    icon: <BookOpenIcon />,
    title: "Aqeedah",
    description:
      "Core matters of belief, organized by topic with structured, traceable references.",
    href: "/aqeedah",
  },
  {
    key: "masail",
    icon: <ScaleIcon />,
    title: "Masail",
    description:
      "Applied questions and rulings, presented with clear sourcing for further study.",
    href: "/masail",
  },
];

export default function CategorySection() {
  return (
    <section className="bg-white py-16 sm:py-20">
      <Container className="flex flex-col gap-10">
        <SectionHeading
          eyebrow="Browse by category"
          title="Start with a core research area"
          subtitle="Every entry is organized under a category and backed by a structured reference, ready to expand as the library grows."
        />

        <div className="grid gap-5 sm:grid-cols-2">
          {CATEGORIES.map((category) => (
            <CategoryCard
              key={category.key}
              icon={category.icon}
              title={category.title}
              description={category.description}
              href={category.href}
            />
          ))}
        </div>
      </Container>
    </section>
  );
}
