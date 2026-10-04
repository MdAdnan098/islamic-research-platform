import { Link } from "react-router-dom";
import { BRAND, SOCIAL } from "../../config/env.js";
import { useI18n } from "../../i18n/index.jsx";
import { Logo } from "../brand/Logo.jsx";

const YouTube = () => (
  <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true">
    <rect x="1" y="4.5" width="22" height="15" rx="4.5" fill="#FF0000" /><path d="M10 9l5.5 3-5.5 3z" fill="#fff" />
  </svg>
);
const Instagram = () => (
  <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true">
    <defs><linearGradient id="ig-g" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#FEDA75" /><stop offset=".3" stopColor="#FA7E1E" /><stop offset=".55" stopColor="#D62976" /><stop offset=".8" stopColor="#962FBF" /><stop offset="1" stopColor="#4F5BD5" /></linearGradient></defs>
    <rect x="2" y="2" width="20" height="20" rx="6" fill="url(#ig-g)" />
    <rect x="6.3" y="6.3" width="11.4" height="11.4" rx="3.6" fill="none" stroke="#fff" strokeWidth="1.6" />
    <circle cx="12" cy="12" r="2.8" fill="none" stroke="#fff" strokeWidth="1.6" /><circle cx="15.8" cy="8.2" r="1" fill="#fff" />
  </svg>
);
const WhatsApp = () => (
  <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true">
    <rect x="2" y="2" width="20" height="20" rx="6" fill="#25D366" />
    <path d="M12 5.6a6.4 6.4 0 0 0-5.5 9.7L5.6 18.4l3.2-.9A6.4 6.4 0 1 0 12 5.6z" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
    <path d="M9.9 9.2c.2-.3.4-.3.6-.3h.4c.1 0 .3.1.4.3l.5 1.2c0 .2 0 .3-.1.4l-.4.5c-.1.1-.1.2 0 .3.5.8 1.1 1.4 2 1.8.1.1.3 0 .4-.1l.5-.6c.1-.1.3-.2.5-.1l1.1.5c.2.1.3.2.2.4-.1.7-.7 1.2-1.4 1.2-2 0-4-2-4.1-4 0-.5.2-1 .4-1.5z" fill="#fff" />
  </svg>
);
const SOCIALS = [
  { key: "youtube", label: "YouTube", Logo: YouTube },
  { key: "instagram", label: "Instagram", Logo: Instagram },
  { key: "whatsapp", label: "WhatsApp", Logo: WhatsApp },
];

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
          <div className="mt-4 flex flex-wrap gap-2.5">
            {SOCIALS.map(({ key, label, Logo: Brand }) => (
              <a key={key} href={SOCIAL[key]} target="_blank" rel="noopener noreferrer" aria-label={label} className="flex items-center gap-2 rounded-full border border-rule bg-card py-1.5 pe-4 ps-1.5 text-sm font-medium transition duration-200 hover:-translate-y-0.5 hover:shadow-soft">
                <Brand /> {label}
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
