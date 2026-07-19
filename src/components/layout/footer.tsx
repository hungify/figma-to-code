import { Link } from "@tanstack/react-router";
import type { ComponentPropsWithoutRef } from "react";

import { cn } from "#/lib/utils";

const LOGO_ASSET_BASE = "/logo";

type FooterLink = {
  href: string;
  label: string;
};

type FooterProps = ComponentPropsWithoutRef<"footer"> & {
  links?: readonly FooterLink[];
};

const defaultFooterLinks = [
  { href: "#", label: "利用規約" },
  { href: "#", label: "プライバシーポリシー" },
  { href: "#", label: "問い合わせ" },
  { href: "#", label: "よくある質問" },
  { href: "#", label: "運営会社" },
] as const satisfies readonly FooterLink[];

function FooterLogo() {
  return (
    <Link
      to="/"
      aria-label="らきた ホーム"
      className="relative block h-12 w-24.75 overflow-visible"
    >
      <img
        src={`${LOGO_ASSET_BASE}/logo-wordmark.svg`}
        alt=""
        className="absolute top-0 left-0 h-[34.89px] w-[96.48px]"
      />
      <img
        src={`${LOGO_ASSET_BASE}/logo-tagline.svg`}
        alt=""
        className="absolute top-[39.48px] left-[1.3px] h-[8.52px] w-[94.8px]"
      />
    </Link>
  );
}

function FooterNavLink({ href, label }: FooterLink) {
  return (
    <a href={href} className="jp-body-lg whitespace-nowrap text-grey-900">
      {label}
    </a>
  );
}

export function Footer({ className, links = defaultFooterLinks, ...props }: FooterProps) {
  return (
    <footer className={cn("w-full", className)} {...props}>
      <div className="h-82 border-t border-green-100 bg-green-50 px-5 py-9 md:h-30">
        <div className="flex w-full flex-col items-center gap-6 md:flex-row md:items-center md:justify-between">
          <nav
            aria-label="フッターナビゲーション"
            className="flex w-full flex-col items-start gap-4 md:order-2 md:w-auto md:flex-row md:flex-wrap md:items-start md:gap-x-12 md:gap-y-1"
          >
            {links.map((link) => (
              <FooterNavLink key={link.label} {...link} />
            ))}
          </nav>
          <div className="md:order-1">
            <FooterLogo />
          </div>
        </div>
      </div>
      <div className="flex items-center justify-center bg-white py-3">
        <p className="text-center en-body-sm text-grey-500">© knowbe, Inc.</p>
      </div>
    </footer>
  );
}
