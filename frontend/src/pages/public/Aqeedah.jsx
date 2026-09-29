import Container from "../../components/common/Container.jsx";
import { BookOpenIcon } from "../../components/common/Icons.jsx";

/**
 * Placeholder shell. The real Aqeedah listing (topics, published
 * articles) will be built once the categories/articles API exists.
 */
export default function Aqeedah() {
  return (
    <Container className="flex flex-col items-center gap-4 py-20 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
        <BookOpenIcon className="h-6 w-6" />
      </span>
      <h1 className="font-serif text-2xl font-semibold text-slate-900">Aqeedah</h1>
      <p className="max-w-md text-sm text-slate-500">
        This section will list Aqeedah topics and published research once
        content is added by an admin.
      </p>
    </Container>
  );
}
