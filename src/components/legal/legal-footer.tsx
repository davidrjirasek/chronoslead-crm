import { FacebookIcon, InstagramIcon, LinkedinIcon, TiktokIcon, YoutubeIcon } from "./social-icons";

const SOCIALS = [
  { label: "Instagram", href: "https://www.instagram.com/creativo4dgroup/", Icon: InstagramIcon },
  { label: "Facebook", href: "https://www.facebook.com/creativo4d", Icon: FacebookIcon },
  { label: "YouTube", href: "http://youtube.com/@creativo4dgroup", Icon: YoutubeIcon },
  { label: "TikTok", href: "http://tiktok.com/@creativo4dgroup", Icon: TiktokIcon },
  {
    label: "LinkedIn",
    href: "https://py.linkedin.com/company/creativo-4d-group",
    Icon: LinkedinIcon,
  },
];

export function LegalFooter() {
  return (
    <footer className="mx-auto mt-16 max-w-3xl border-t px-6 py-8">
      <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:justify-between sm:text-left">
        <p className="text-muted-foreground text-sm">
          Powered by{" "}
          <a
            href="https://creativo4dgroup.com"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-foreground hover:text-[#D4820A]"
          >
            Creativo 4D Group
          </a>
        </p>
        <div className="flex items-center gap-4">
          {SOCIALS.map(({ label, href, Icon }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noreferrer"
              aria-label={label}
              className="text-muted-foreground transition-colors hover:text-[#D4820A]"
            >
              <Icon className="size-4" />
            </a>
          ))}
        </div>
      </div>
      <p className="mt-4 text-center text-muted-foreground text-xs sm:text-left">
        <a href="mailto:soporte@chronoslead.com" className="hover:text-[#D4820A]">
          soporte@chronoslead.com
        </a>
      </p>
    </footer>
  );
}
