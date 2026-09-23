import { Users, ArrowRight } from "lucide-react";
import Reveal from "./Reveal";
import Button from "../ui/Button";
import { WhatsappMark, DiscordMark } from "../icons/BrandIcons";
import { WHATSAPP_LINK, DISCORD_INVITE_URL } from "../../config/site.js";
import communityHands from "../../assets/community/pexels-diva-plavalaguna-6146697.jpg";
import communityStudents from "../../assets/community/pexels-yankrukov-8199223.jpg";

function CommunitySection() {
  const secondaryChannels = [
    WHATSAPP_LINK && {
      key: "whatsapp",
      label: "WhatsApp",
      href: WHATSAPP_LINK,
      Icon: WhatsappMark,
      description: "Message the Code Club team directly.",
    },
    DISCORD_INVITE_URL && {
      key: "discord",
      label: "Discord",
      href: DISCORD_INVITE_URL,
      Icon: DiscordMark,
      description: "Join the server and talk to other students.",
    },
  ].filter(Boolean);

  return (
    <Reveal as="section" className="px-6 py-20 md:px-12 md:py-28">
      <div className="mx-auto max-w-5xl overflow-hidden rounded-3xl border border-[var(--border-strong)]">
        <div className="relative min-h-[620px]">
          <img
            src={communityHands}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/65 to-black/30"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/20"
          />

          <div className="relative z-10 grid min-h-[620px] gap-10 p-6 sm:p-8 md:grid-cols-12 md:items-center md:gap-8 md:p-12">
            <div className="md:col-span-6">
              <p className="mb-4 font-mono-ui text-lp-label uppercase tracking-lp-label text-white/65">
                Community
              </p>
              <h2 className="text-lp-h2-spine font-display font-bold tracking-tight text-white">
                Solving is solo.
                <br />
                The rest of it isn&apos;t.
              </h2>
              <p className="mt-4 max-w-sm text-white/75">
                Every problem is yours to work through on your own. The
                leaderboard, the contests, and everyone else grinding the same
                catalog aren&apos;t.
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <Button to="/club" variant="secondary" size="sm" className="group">
                  Open the Club
                  <ArrowRight
                    size={14}
                    className="transition group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </Button>
              </div>
            </div>

            <div className="md:col-span-5 md:col-start-8">
              <div className="overflow-hidden rounded-2xl border border-white/20 bg-black/30 backdrop-blur-sm">
                <img
                  src={communityStudents}
                  alt="Students spending time together on a campus staircase"
                  className="h-56 w-full object-cover"
                />
                <div className="p-5">
                  <div className="flex items-center gap-3">
                    <span
                      className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-white/10 text-white"
                      aria-hidden="true"
                    >
                      <Users size={20} strokeWidth={2} />
                    </span>
                    <div>
                      <p className="font-display text-lg font-semibold text-white">
                        Build alongside others
                      </p>
                      <p className="mt-1 text-sm text-white/65">
                        Same problems, shared momentum, one place to keep going.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {secondaryChannels.length > 0 && (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {secondaryChannels.map(({ key, label, href, Icon, description }) => (
                    <a
                      key={key}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center gap-3 rounded-2xl border border-white/15 bg-black/25 p-4 backdrop-blur-sm transition hover:border-white/30"
                    >
                      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white/10 text-white/80 transition group-hover:text-white">
                        <Icon size={18} aria-hidden="true" />
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5 font-display font-semibold text-white">
                          {label}
                          <ArrowRight
                            size={14}
                            className="flex-shrink-0 text-white/50 transition group-hover:translate-x-0.5 group-hover:text-white"
                            aria-hidden="true"
                          />
                        </span>
                        <span className="mt-0.5 block text-sm text-white/55">
                          {description}
                        </span>
                      </span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Reveal>
  );
}

export default CommunitySection;
