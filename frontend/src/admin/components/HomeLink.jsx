import { Link } from "react-router-dom";
import { Icon } from "../../components/ui/icons.jsx";

/** Small corner link on the signed-out admin pages (login / register / forgot password) back to the main website. */
export function HomeLink() {
  return (
    <Link to="/" className="a-btn fixed start-3 top-3 z-10 gap-1.5 !px-3 !py-1.5 text-xs">
      <Icon name="arrow" size={14} className="rotate-180" />Home
    </Link>
  );
}
