import { Link } from "react-router-dom";
import { BRAND, SOCIAL, CONTACT } from "../../config/env.js";
import { useI18n } from "../../i18n/index.jsx";
import { Logo } from "../brand/Logo.jsx";
import { AdminTapZone } from "./AdminAccess.jsx";

/* Brand glyphs (white) drawn on a brand-coloured round button. */
const YouTube = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="#fff" aria-hidden="true">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
  </svg>
);
const Instagram = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" strokeWidth="1.9" aria-hidden="true">
    <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.2" cy="6.8" r="1.1" fill="#fff" stroke="none" />
  </svg>
);
const WhatsApp = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="#fff" aria-hidden="true">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);
const PhoneIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />
  </svg>
);
const MailIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3.5 7 8.5 6 8.5-6" />
  </svg>
);
export const SOCIALS = [
  { key: "youtube", label: "YouTube", Glyph: YouTube, bg: "#FF0000" },
  { key: "instagram", label: "Instagram", Glyph: Instagram, bg: "linear-gradient(45deg,#FEDA75 0%,#FA7E1E 25%,#D62976 50%,#962FBF 75%,#4F5BD5 100%)" },
  { key: "whatsapp", label: "WhatsApp", Glyph: WhatsApp, bg: "#25D366" },
];

export function Footer() {
  const { t } = useI18n();
  const links = [["/", t.nav.home], ["/aqaid", t.nav.aqaid], ["/masail", t.nav.masail]];
  const info = [["/about", t.nav.about], ["/disclaimer", t.nav.disclaimer], ["/privacy", t.nav.privacy]];
  return (
    <footer className="mt-20 border-t border-rule bg-footer">
      <div className="container-page grid gap-10 py-14 md:grid-cols-[1.2fr_1fr_1fr_1.2fr] lg:grid-cols-[1.4fr_.8fr_.8fr_1.2fr_.95fr]">
        <div>
          <Logo size={42} />
          <p className="mt-5 max-w-sm text-base text-mute">{t.footer.about}</p>
        </div>
        {/* Links + Information sit side by side (on phones too); from md they become separate columns */}
        <div className="grid grid-cols-2 gap-x-6 md:contents">
          <div>
            <p className="text-lg font-bold">{t.footer.links}</p>
            <ul className="mt-4 space-y-3 text-base">
              {links.map(([to, label]) => (
                <li key={to}><Link to={to} className="text-mute transition-colors hover:text-ink">{label}</Link></li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-lg font-bold">{t.footer.info}</p>
            <ul className="mt-4 space-y-3 text-base">
              {info.map(([to, label]) => (
                <li key={to}><Link to={to} className="text-mute transition-colors hover:text-ink">{label}</Link></li>
              ))}
            </ul>
          </div>
        </div>
        {/* Two separate groups: Contact (phone + email) and Follow us on (social icons).
            Phones: side by side in one row (shorter than before). md: stacked in the 4th column. lg+: two own columns. */}
        <div className="flex items-start justify-between gap-x-5 md:block md:space-y-5 lg:contents lg:space-y-0">
          <div className="min-w-0">
            <p className="text-lg font-bold">{t.footer.contact}</p>
            <ul className="mt-3 space-y-2 text-sm lg:mt-4 lg:space-y-2.5 lg:text-base">
              <li>
                <a href={`tel:${CONTACT.phone.replace(/[^+\d]/g, "")}`} dir="ltr" className="inline-flex items-center gap-2 text-mute transition-colors hover:text-ink">
                  <PhoneIcon />{CONTACT.phone}
                </a>
              </li>
              <li>
                <a href={`mailto:${CONTACT.email}`} dir="ltr" className="inline-flex items-center gap-2 break-all text-mute transition-colors hover:text-ink">
                  <MailIcon />{CONTACT.email}
                </a>
              </li>
            </ul>
          </div>
          <div className="shrink-0">
            <p className="text-lg font-bold">{t.footer.follow}</p>
            <div className="mt-3 flex gap-2 lg:mt-4 lg:gap-3">
              {SOCIALS.map(({ key, label, Glyph, bg }) => (
                <a
                  key={key}
                  href={SOCIAL[key]}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  title={label}
                  style={{ background: bg }}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full shadow-soft transition duration-200 hover:-translate-y-0.5 hover:opacity-90 lg:h-11 lg:w-11"
                >
                  <Glyph />
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="border-t border-rule">
        <AdminTapZone className="container-page flex flex-col items-center justify-between gap-2 py-5 text-sm text-mute sm:flex-row">
          <span>© {new Date().getFullYear()} <span className="text-accent">{BRAND.name}</span>. {t.footer.rights}</span>
          <span className="whitespace-nowrap">{BRAND.tagline}</span>
        </AdminTapZone>
      </div>
    </footer>
  );
}
