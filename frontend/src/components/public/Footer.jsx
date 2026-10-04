import { Link } from "react-router-dom";
import { BRAND, SOCIAL } from "../../config/env.js";
import { useI18n } from "../../i18n/index.jsx";
import { Logo } from "../brand/Logo.jsx";
import { Icon } from "../ui/icons.jsx";

export function Footer() {
  const { t } = useI18n();
  const links = [["/", t.nav.home], ["/aqaid", t.nav.aqaid], ["/masail", t.nav.masail]];
  return (
    <footer className="mt-20 border-t border-rule bg-card">
      <div className="container-page grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Logo size={42} />
          <p className="mt-5 max-w-sm text-sm text-mute">{t.footer.about}</p>
        </div>
        <div>
          <p className="text-sm font-semibold">{t.footer.links}</p>
          <ul className="mt-4 space-y-2.5 text-sm">
            {links.map(([to, label]) => (
              <li key={to}><Link to={to} className="text-mute transition-colors hover:text-ink">{label}</Link></li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold">{t.footer.follow}</p>
          <div className="mt-4 flex gap-3">
            {[["youtube", "YouTube", SOCIAL.youtube], ["instagram", "Instagram", SOCIAL.instagram]].map(([icon, label, href]) => (
              <a key={icon} href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className="grid h-10 w-10 place-items-center rounded-full border border-rule text-mute transition-colors hover:border-accent/60 hover:text-accent">
                <Icon name={icon} size={18} />
              </a>
            ))}
          </div>
        </div>
      </div>
      <div className="border-t border-rule">
        <div className="container-page flex flex-col items-center justify-between gap-2 py-5 text-xs text-mute sm:flex-row">
          <span>© {new Date().getFullYear()} {BRAND.name} · {t.footer.rights}</span>
          <span className="whitespace-nowrap">{BRAND.tagline}</span>
        </div>
      </div>
    </footer>
  );
}
