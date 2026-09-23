import { Link } from "react-router-dom";
import { Heart, Mail, Code2 } from "lucide-react";
import {
  SUPPORT_EMAIL,
  WHATSAPP_LINK,
  DISCORD_INVITE_URL,
  GITHUB_URL,
  TWITTER_URL,
  LINKEDIN_URL,
} from "../../config/site.js";
import { GithubMark, LinkedinMark, WhatsappMark, DiscordMark, XMark } from "../icons/BrandIcons";

// Footer — blueprint position 14, the final section on the page.
//
// The Final CTA (CtaSection) already closes the narrative/emotional
// argument; this is the practical close underneath it — brand, real
// navigation, real contact/community destinations, and a copyright line.
// Kept deliberately quiet and static (no Reveal, no motion) so it reads
// as the page settling rather than one more marketing beat.
//
// Every destination below is a route that exists in App.jsx or a channel
// sourced from config/site.js — nothing here is invented. No newsletter
// signup: the repo has no email-subscription backend, and a form that
// only looks functional is worse than no form.

// Social row: public profiles (GitHub/Twitter/LinkedIn) plus the same
// official contact channels (WhatsApp/Discord) already used elsewhere,
// unified into one icon-button style. Each is env-driven and simply
// omitted when unconfigured (see config/site.js) — the mailto fallback
// is the one exception, since SUPPORT_EMAIL always has a real value.
function useSocialLinks() {
  return [
    { key: "github", label: "GitHub", href: GITHUB_URL, Icon: GithubMark },
    { key: "twitter", label: "Twitter", href: TWITTER_URL, Icon: XMark },
    { key: "linkedin", label: "LinkedIn", href: LINKEDIN_URL, Icon: LinkedinMark },
    { key: "whatsapp", label: "WhatsApp", href: WHATSAPP_LINK, Icon: WhatsappMark },
    { key: "discord", label: "Discord", href: DISCORD_INVITE_URL, Icon: DiscordMark },
    { key: "email", label: "Email", href: `mailto:${SUPPORT_EMAIL}`, Icon: Mail },
  ].filter((l) => l.href);
}

// Link style shared by every column — quiet by default, brightens on
// hover, and gets the same focus-visible ring treatment already used for
// inline links elsewhere on the landing page (see CommunitySection.jsx /
// FaqSection.jsx / AudienceGrid.jsx) so keyboard focus is always visible.
const FOOTER_LINK_CLASSES =
  "text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-text)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] rounded-sm";

// A single grouped nav column. `aria-label` gives each group its own
// navigation landmark (there are multiple on the page — Navbar's plus
// these) rather than relying on the visual heading alone, and the
// mono-ui uppercase label treatment matches every other section's
// eyebrow/label style instead of introducing a one-off footer heading
// size.
function FooterColumn({ title, links }) {
  return (
    <nav aria-label={title} className="flex flex-col gap-4">
      <h3 className="font-mono-ui text-lp-label uppercase tracking-lp-label text-[var(--muted-foreground)]">
        {title}
      </h3>
      <ul className="flex flex-col gap-2.5">
        {links.map(({ label, ...linkProps }) => (
          <li key={label}>
            {linkProps.to ? (
              <Link to={linkProps.to} className={FOOTER_LINK_CLASSES}>
                {label}
              </Link>
            ) : (
              <a href={linkProps.href} className={FOOTER_LINK_CLASSES}>
                {label}
              </a>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}

function LandingFooter({ user }) {
  const dashboardOrPortal = user ? "/dashboard" : "/portal";
  const socialLinks = useSocialLinks();
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-[var(--border-strong)] bg-[var(--surface)]">
      <div className="max-w-6xl mx-auto px-6 md:px-12 py-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-12">
        {/* Brand. Icon badge intentionally left on --theme-primary (the
            separate gamified skin system's accent) rather than this
            section's own theme tokens — same reasoning and known
            limitation as the identical badge in BrandSignoff.jsx. */}
        <div className="lg:col-span-5 flex flex-col gap-4 sm:col-span-2">
          <div className="flex items-center gap-2.5">
            <span
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{
                backgroundColor: "var(--theme-primary-alpha, rgba(45,212,191,0.12))",
                color: "var(--theme-primary, #2dd4bf)",
              }}
            >
              <Code2 size={18} aria-hidden="true" />
            </span>
            <span className="text-xl font-bold tracking-tight text-[var(--foreground)]">Code Club</span>
          </div>
          <p className="text-sm text-[var(--muted-foreground)] leading-relaxed max-w-sm">
            Verified solves, a provable profile, and everywhere that leads —
            practice, community, and real placement opportunity.
          </p>
          
        </div>

        <div className="lg:col-span-3">
          <FooterColumn
            title="Platform"
            links={[
              { label: "Problems", to: "/problems" },
              { label: "Dashboard", to: dashboardOrPortal },
              { label: "Club", to: "/club" },
              { label: "Pricing", to: "/pricing" },
            ]}
          />
        </div>

        <div className="lg:col-span-4">
          <FooterColumn
            title="Resources"
            links={[
              { label: "For Recruiters", to: "/portal" },
              { label: "For TPOs", to: "/portal" },
              { label: "Privacy Policy", to: "/privacy" },
              { label: "Terms of Service", to: "/terms" },
              { label: "Contact", href: `mailto:${SUPPORT_EMAIL}` },
            ]}
          />
        </div>
      </div>

      <div className="border-t border-[var(--border-strong)]">
        <div className="max-w-6xl mx-auto px-6 md:px-12 py-6 flex flex-col-reverse sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-[var(--muted-foreground)]">
            © {year} Code Club. All rights reserved.
          </p>
          {/* Theme note (Phase 1, deferred): this chip uses the generic
              Tailwind zinc-700/800 palette rather than the landing's
              ink-*-derived semantic tokens — reusing --surface/--border
              here would visibly shift Black Mode (ink-800 is a
              noticeably darker, bluer tone than zinc-800), so rather
              than introduce a token just for this one spot, it's left
              hardcoded for now and flagged for the next migration batch,
              where it currently renders identically in both modes
              instead of adapting to White Mode. */}
          {socialLinks.length > 0 && (
            <div className="flex items-center gap-2.5">
              {socialLinks.map(({ key, label, href, Icon }) => (
                <a
                  key={key}
                  href={href}
                  target={key === "email" ? undefined : "_blank"}
                  rel={key === "email" ? undefined : "noopener noreferrer"}
                  aria-label={label}
                  title={label}
                  className="w-9 h-9 rounded-lg flex items-center justify-center bg-[var(--surface-elevated)]/80 text-[var(--muted-foreground)] border border-[var(--border)] hover:text-[var(--foreground)] hover:bg-[var(--surface-elevated)] hover:border-[var(--border-strong)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-text)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
                >
                  <Icon size={15} />
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </footer>
  );
}

export default LandingFooter;