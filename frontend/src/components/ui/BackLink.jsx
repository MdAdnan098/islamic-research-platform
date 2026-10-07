import { Link } from "react-router-dom";
import { Icon } from "./icons.jsx";

/** Small "← label" link used at the top of detail / list pages so there is always a way back. */
export function BackLink({ to, children }) {
  return (
    <Link to={to} className="inline-flex items-center gap-1.5 rounded-md py-1 text-sm font-medium text-mute transition hover:text-accent">
      <Icon name="chevL" size={16} className="rtl:rotate-180" />{children}
    </Link>
  );
}
