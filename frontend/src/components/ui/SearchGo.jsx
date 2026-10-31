import { Icon } from "./icons.jsx";

/** Content of a search submit button: the magnifier while the box is empty, "Go" as soon as something is typed
 *  (so it is clear that tapping it runs the search). The button's own background stays untouched. */
export function SearchGo({ active, size = 20 }) {
  return active
    ? <span className="text-sm font-bold leading-none">Go</span>
    : <Icon name="search" size={size} />;
}
