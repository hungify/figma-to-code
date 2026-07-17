import {
  ChevronDownIcon,
  ChevronRightIcon,
  LogOutIcon,
  MenuIcon,
  UserCircleIcon,
  XIcon,
} from "lucide-react";
import type { ComponentPropsWithoutRef, MouseEvent, MouseEventHandler, ReactNode } from "react";
import { useState } from "react";

import { SidebarDrawer } from "#/components/layout/sidebar";
import { cn } from "#/lib/utils";

const LOGO_ASSET_BASE = "/figma/header";

type HeaderAction = "menu" | "account";

type HeaderProps = ComponentPropsWithoutRef<"header"> & {
  onAccountClick?: MouseEventHandler<HTMLButtonElement>;
  onChangeEmailClick?: MouseEventHandler<HTMLButtonElement>;
  onChangePasswordClick?: MouseEventHandler<HTMLButtonElement>;
  onLogoutClick?: MouseEventHandler<HTMLButtonElement>;
  onMenuClick?: MouseEventHandler<HTMLButtonElement>;
  showMenuButton?: boolean;
  userEmail?: string;
};

type HeaderActionButtonProps = {
  action: HeaderAction;
  onClick?: MouseEventHandler<HTMLButtonElement>;
};

const actionCopy = {
  menu: "メニュー",
  account: "アカウント",
} as const;

function HeaderLogo() {
  return (
    <>
      <span className="flex h-6 w-[49.5px] items-center md:hidden">
        <img
          src={`${LOGO_ASSET_BASE}/logo-wordmark-sp.svg`}
          alt="らきた"
          className="block h-[17.45px] w-[48.24px]"
        />
      </span>
      <span className="hidden h-[39.7px] w-[74.25px] overflow-visible md:grid">
        <img
          src={`${LOGO_ASSET_BASE}/logo-wordmark-pc.svg`}
          alt="らきた"
          className="col-start-1 row-start-1 h-[26.17px] w-[72.36px]"
        />
        <img
          src={`${LOGO_ASSET_BASE}/logo-tagline-pc.svg`}
          alt=""
          className="col-start-1 row-start-1 mt-[33.31px] ml-[0.73px] h-[6.39px] w-[71.1px]"
        />
      </span>
    </>
  );
}

function HeaderTagline() {
  return (
    <p className="jp-body-sm whitespace-nowrap text-grey-600 md:jp-label-xs">
      ”はたらきたい”の一歩に寄り添う
    </p>
  );
}

function HeaderBrand() {
  return (
    <div className="flex h-12 flex-col items-start justify-start gap-1 md:h-[39.7px] md:flex-row md:items-center md:gap-4">
      <HeaderLogo />
      <HeaderTagline />
    </div>
  );
}

function HeaderActionButton({ action, onClick }: HeaderActionButtonProps) {
  const Icon = action === "menu" ? MenuIcon : UserCircleIcon;

  return (
    <button
      type="button"
      aria-label={actionCopy[action]}
      onClick={onClick}
      className={cn(
        "flex min-h-11 w-14 flex-col items-center justify-center gap-0.5 text-grey-900",
        "focus-visible:ring-3 focus-visible:ring-green-100 focus-visible:outline-none",
      )}
    >
      <Icon className="size-6" aria-hidden="true" strokeWidth={2} />
      <span className="en-body-xs whitespace-nowrap">{actionCopy[action]}</span>
    </button>
  );
}

function HeaderAccountControl({
  expanded,
  className,
  onClick,
  userEmail,
}: {
  expanded?: boolean;
  className?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  userEmail: string;
}) {
  return (
    <button
      type="button"
      aria-expanded={expanded}
      aria-haspopup="menu"
      onClick={onClick}
      className={cn(
        "flex h-12 w-[250px] items-center gap-2 rounded-lg border border-grey-100 bg-white p-3 text-grey-900",
        "focus-visible:ring-3 focus-visible:ring-green-100 focus-visible:outline-none",
        className,
      )}
    >
      <UserCircleIcon className="size-6 shrink-0" aria-hidden="true" strokeWidth={2} />
      <span className="min-w-0 flex-1 truncate text-left jp-body-lg">{userEmail}</span>
      <ChevronDownIcon className="size-6 shrink-0" aria-hidden="true" strokeWidth={2} />
    </button>
  );
}

function AccountMenuItem({
  children,
  className,
  icon,
  onClick,
  trailing,
}: {
  children: ReactNode;
  className?: string;
  icon?: ReactNode;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  trailing?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-12 w-full items-center gap-4 border-b border-grey-100 px-4 py-3 text-left jp-body-lg",
        "focus-visible:ring-3 focus-visible:ring-green-100 focus-visible:outline-none",
        className,
      )}
    >
      {icon}
      <span className="min-w-0 flex-1">{children}</span>
      {trailing}
    </button>
  );
}

function DesktopAccountPopover({
  onChangeEmailClick,
  onChangePasswordClick,
  onLogoutClick,
}: Pick<HeaderProps, "onChangeEmailClick" | "onChangePasswordClick" | "onLogoutClick">) {
  return (
    <div className="absolute top-[60px] right-0 z-50 w-[430px] overflow-hidden rounded-lg bg-white shadow-xl ring-1 ring-grey-100">
      <AccountMenuItem onClick={onChangeEmailClick} className="h-14 px-10">
        メールアドレス変更
      </AccountMenuItem>
      <AccountMenuItem onClick={onChangePasswordClick} className="h-14 px-10">
        パスワード変更
      </AccountMenuItem>
      <AccountMenuItem
        onClick={onLogoutClick}
        className="h-14 px-10 text-red-500"
        icon={<LogOutIcon className="size-6 shrink-0" aria-hidden="true" strokeWidth={2} />}
      >
        ログアウト
      </AccountMenuItem>
    </div>
  );
}

function MobileAccountDrawer({
  onChangeEmailClick,
  onChangePasswordClick,
  onClose,
  onLogoutClick,
  open,
}: Pick<HeaderProps, "onChangeEmailClick" | "onChangePasswordClick" | "onLogoutClick"> & {
  onClose: () => void;
  open: boolean;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 md:hidden">
      <aside className="ml-auto flex h-full w-[292.5px] flex-col gap-4 overflow-hidden border border-grey-100 bg-white py-4">
        <div className="flex w-full items-center justify-end px-4">
          <button
            type="button"
            aria-label="閉じる"
            onClick={onClose}
            className="text-grey-500 focus-visible:ring-3 focus-visible:ring-green-100 focus-visible:outline-none"
          >
            <XIcon className="size-6" aria-hidden="true" strokeWidth={2} />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <AccountMenuItem onClick={onChangeEmailClick}>メールアドレス変更</AccountMenuItem>
          <AccountMenuItem onClick={onChangePasswordClick}>パスワード変更</AccountMenuItem>
          <AccountMenuItem
            onClick={onLogoutClick}
            className="text-red-500"
            icon={<LogOutIcon className="size-6 shrink-0" aria-hidden="true" strokeWidth={2} />}
            trailing={
              <ChevronRightIcon className="size-6 shrink-0" aria-hidden="true" strokeWidth={2} />
            }
          >
            ログアウト
          </AccountMenuItem>
        </div>
      </aside>
    </div>
  );
}

function Header({
  className,
  onAccountClick,
  onChangeEmailClick,
  onChangePasswordClick,
  onLogoutClick,
  onMenuClick,
  showMenuButton = false,
  userEmail,
  ...props
}: HeaderProps) {
  const isLoggedIn = userEmail != null;
  const showMobileMenu = isLoggedIn && showMenuButton;
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [menuDrawerOpen, setMenuDrawerOpen] = useState(false);

  function toggleDesktopAccountMenu(event: MouseEvent<HTMLButtonElement>) {
    setAccountMenuOpen((open) => !open);
    onAccountClick?.(event);
  }

  function openMobileAccountDrawer(event: MouseEvent<HTMLButtonElement>) {
    setAccountMenuOpen(true);
    onAccountClick?.(event);
  }

  function openMobileMenuDrawer(event: MouseEvent<HTMLButtonElement>) {
    setMenuDrawerOpen(true);
    onMenuClick?.(event);
  }

  return (
    <>
      <header
        {...props}
        className={cn(
          "flex h-16 w-full border-b border-grey-50 bg-white px-5 py-2 md:h-[72px] md:items-start md:py-3",
          isLoggedIn ? "items-center" : "items-start",
          className,
        )}
      >
        <div
          className={cn(
            "flex h-full w-full md:items-start md:gap-6",
            isLoggedIn ? "items-center justify-between" : "flex-col items-start",
          )}
        >
          <div className={cn("min-w-0", isLoggedIn ? "shrink-0" : "w-full", "md:flex-1")}>
            <HeaderBrand />
          </div>
          {isLoggedIn ? (
            <>
              <div className="flex items-start gap-3 md:hidden">
                {showMobileMenu ? (
                  <HeaderActionButton action="menu" onClick={openMobileMenuDrawer} />
                ) : null}
                <HeaderActionButton action="account" onClick={openMobileAccountDrawer} />
              </div>
              <div className="relative hidden md:block">
                <HeaderAccountControl
                  expanded={accountMenuOpen}
                  onClick={toggleDesktopAccountMenu}
                  userEmail={userEmail}
                />
                {accountMenuOpen ? (
                  <DesktopAccountPopover
                    onChangeEmailClick={onChangeEmailClick}
                    onChangePasswordClick={onChangePasswordClick}
                    onLogoutClick={onLogoutClick}
                  />
                ) : null}
              </div>
            </>
          ) : null}
        </div>
      </header>
      <MobileAccountDrawer
        open={accountMenuOpen}
        onClose={() => setAccountMenuOpen(false)}
        onChangeEmailClick={onChangeEmailClick}
        onChangePasswordClick={onChangePasswordClick}
        onLogoutClick={onLogoutClick}
      />
      <SidebarDrawer open={menuDrawerOpen} onClose={() => setMenuDrawerOpen(false)} />
    </>
  );
}

export { Header };
export type { HeaderProps };
