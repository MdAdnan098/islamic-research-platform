import { NotFoundState } from "../../components/ui/feedback.jsx";
import { useMeta } from "../../lib/useMeta.js";

export default function NotFound() {
  useMeta({ title: "Page nahi mila (404)", description: "Ye page maujood nahi hai.", noindex: true });
  return <NotFoundState />;
}
