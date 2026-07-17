import type { ComponentPropsWithoutRef } from "react";

import { buttonVariants } from "#/components/ui/button";
import { cn } from "#/lib/utils";

const LOGO_ASSET_BASE = "/figma/header";

type FooterLink = {
  href: string;
  label: string;
};

type FooterProps = ComponentPropsWithoutRef<"footer"> & {
  links?: readonly FooterLink[];
};

const defaultFooterLinks = [
  { href: "#", label: "運営会社" },
  { href: "#", label: "利用規約" },
  { href: "#", label: "プラポリ" },
  { href: "#", label: "問い合わせ" },
  { href: "#", label: "よくある質問" },
] as const satisfies readonly FooterLink[];

function FooterLogo() {
  return (
    <div className="relative h-12 w-[99px] overflow-visible">
      <img
        src={`${LOGO_ASSET_BASE}/logo-wordmark-pc.svg`}
        alt="らきた"
        className="absolute top-0 left-0 h-[34.89px] w-[96.48px]"
      />
      <img
        src={`${LOGO_ASSET_BASE}/logo-tagline-pc.svg`}
        alt=""
        className="absolute top-[39.48px] left-[1.3px] h-[8.52px] w-[94.8px]"
      />
    </div>
  );
}

function FooterNavLink({ href, label }: FooterLink) {
  return (
    <a
      href={href}
      className={cn(
        buttonVariants({ variant: "outline", color: "green", size: "lg" }),
        "w-full px-4 md:w-auto",
      )}
    >
      {label}
    </a>
  );
}

function Footer({ className, links = defaultFooterLinks, ...props }: FooterProps) {
  return (
    <footer className={cn("w-full", className)} {...props}>
      <div className="border-t border-green-100 bg-green-50 px-5 py-9">
        <div className="flex w-full flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
          <FooterLogo />
          <nav
            aria-label="フッターナビゲーション"
            className="grid w-full grid-cols-2 gap-2 md:flex md:w-auto md:gap-4"
          >
            {links.map((link) => (
              <FooterNavLink key={link.label} {...link} />
            ))}
          </nav>
        </div>
      </div>
      <div className="flex h-10 items-center justify-center bg-white">
        <p className="text-center en-body-sm text-grey-500">© knowbe, Inc.</p>
      </div>
    </footer>
  );
}

export { Footer };
export type { FooterLink, FooterProps };
