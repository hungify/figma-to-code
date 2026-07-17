import {
  FileTextIcon,
  MailIcon,
  MenuIcon,
  NewspaperIcon,
  PencilLineIcon,
  SettingsIcon,
  SlidersHorizontalIcon,
  UsersIcon,
  XIcon,
  type LucideIcon,
} from "lucide-react";
import type { ComponentPropsWithoutRef, CSSProperties, MouseEventHandler, ReactNode } from "react";
import { useState } from "react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "#/components/ui/sheet";
import {
  Sidebar as ShadcnSidebar,
  SidebarContent as ShadcnSidebarContent,
  SidebarGroup as ShadcnSidebarGroup,
  SidebarGroupContent as ShadcnSidebarGroupContent,
  SidebarMenu as ShadcnSidebarMenu,
  SidebarMenuButton as ShadcnSidebarMenuButton,
  SidebarMenuItem as ShadcnSidebarMenuItem,
  SidebarProvider as ShadcnSidebarProvider,
  SidebarSeparator as ShadcnSidebarSeparator,
} from "#/components/ui/sidebar";
import { cn } from "#/lib/utils";

type SidebarItemState = "default" | "active";
type SidebarItemVariant = "default" | "icon";

type SidebarItemProps = Omit<ComponentPropsWithoutRef<"button">, "children" | "type"> & {
  icon?: LucideIcon;
  label: string;
  state?: SidebarItemState;
  variant?: SidebarItemVariant;
};

type SidebarLink = {
  icon: LucideIcon;
  id: string;
  label: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
};

type SidebarGroup = {
  items: readonly SidebarLink[];
};

type SidebarProps = Omit<ComponentPropsWithoutRef<"div">, "children"> & {
  collapsed?: boolean;
  groups?: readonly SidebarGroup[];
  label?: string;
};

type SidebarDrawerProps = ComponentPropsWithoutRef<"div"> & {
  groups?: readonly SidebarGroup[];
  onClose: () => void;
  open: boolean;
};

const defaultSidebarGroups = [
  {
    items: [
      { id: "inquiries", label: "問い合わせ一覧", icon: MailIcon },
      { id: "publish-settings", label: "公開・問い合わせ設定", icon: SettingsIcon },
      { id: "other-settings", label: "その他設定", icon: SlidersHorizontalIcon },
    ],
  },
  {
    items: [
      { id: "content-edit", label: "公開内容編集", icon: PencilLineIcon },
      { id: "blog", label: "ブログ", icon: NewspaperIcon },
    ],
  },
  {
    items: [
      { id: "office-users", label: "事業所ユーザー管理", icon: UsersIcon },
      { id: "contract", label: "契約内容確認", icon: FileTextIcon },
    ],
  },
] as const satisfies readonly SidebarGroup[];

function SidebarItem({
  className,
  icon: Icon,
  label,
  state = "default",
  variant = "default",
  ...props
}: SidebarItemProps) {
  return (
    <ShadcnSidebarProvider className="min-h-0 w-fit">
      <ShadcnSidebarMenu>
        <ShadcnSidebarMenuItem>
          <SidebarItemButton
            className={className}
            icon={Icon}
            label={label}
            state={state}
            variant={variant}
            {...props}
          />
        </ShadcnSidebarMenuItem>
      </ShadcnSidebarMenu>
    </ShadcnSidebarProvider>
  );
}

function SidebarItemButton({
  className,
  icon: Icon,
  label,
  state = "default",
  variant = "default",
  ...props
}: SidebarItemProps) {
  const isActive = state === "active";
  const isIcon = variant === "icon";

  return (
    <ShadcnSidebarMenuButton
      type="button"
      title={isIcon ? label : undefined}
      aria-label={isIcon ? label : undefined}
      data-state={state}
      data-variant={variant}
      isActive={isActive}
      size="lg"
      className={cn(
        "h-12 gap-2 rounded-r-full px-4 py-2.5 jp-label-md font-normal text-grey-500",
        "hover:bg-grey-50 hover:text-grey-500 focus-visible:ring-3 focus-visible:ring-green-100",
        isActive &&
          "border-l-2 border-green-600 bg-green-50 text-green-600 hover:bg-green-50 hover:text-green-600",
        isIcon ? "w-[52px] justify-center" : "w-[205px] justify-start",
        className,
      )}
      {...props}
    >
      {Icon ? <Icon className="size-5 shrink-0" aria-hidden="true" strokeWidth={2} /> : null}
      {isIcon ? null : <span className="min-w-0 flex-1 text-left">{label}</span>}
    </ShadcnSidebarMenuButton>
  );
}

function SidebarSeparator({ children }: { children?: ReactNode }) {
  return (
    <div className="flex h-8 w-full items-center">
      <ShadcnSidebarSeparator className="mx-0 w-full bg-grey-100" />
      {children}
    </div>
  );
}

function Sidebar({
  className,
  collapsed = false,
  groups = defaultSidebarGroups,
  label = "メニュー",
  ...props
}: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(collapsed);

  return (
    <ShadcnSidebarProvider
      defaultOpen={!isCollapsed}
      className="min-h-0 w-fit"
      style={
        {
          "--sidebar-width": isCollapsed ? "84px" : "250px",
          "--sidebar-width-icon": "84px",
        } as CSSProperties
      }
    >
      <ShadcnSidebar
        collapsible="none"
        className={cn(
          "overflow-hidden rounded-xl bg-white text-grey-900",
          isCollapsed ? "w-[84px]" : "w-[250px]",
          className,
        )}
        {...props}
      >
        <ShadcnSidebarContent
          className={cn(
            "gap-2 overflow-hidden bg-white py-6",
            isCollapsed ? "items-center px-4" : "px-4",
          )}
        >
          {isCollapsed ? (
            <button
              type="button"
              aria-label="メニューを開く"
              onClick={() => setIsCollapsed(false)}
              className="text-grey-500 focus-visible:ring-3 focus-visible:ring-green-100 focus-visible:outline-none"
            >
              <MenuIcon className="size-6" aria-hidden="true" strokeWidth={2} />
            </button>
          ) : (
            <div className="flex w-full items-center justify-between pl-4">
              <p className="jp-label-md text-green-500">{label}</p>
              <button
                type="button"
                aria-label="メニューを閉じる"
                onClick={() => setIsCollapsed(true)}
                className="text-grey-500 focus-visible:ring-3 focus-visible:ring-green-100 focus-visible:outline-none"
              >
                <MenuIcon className="size-6" aria-hidden="true" strokeWidth={2} />
              </button>
            </div>
          )}
          <ShadcnSidebarGroup className="p-0">
            <ShadcnSidebarGroupContent>
              <ShadcnSidebarMenu>
                {groups.map((group, groupIndex) => (
                  <GroupFragment key={group.items.map((item) => item.id).join("-")}>
                    {groupIndex > 0 ? <SidebarSeparator /> : null}
                    {group.items.map((item) => (
                      <ShadcnSidebarMenuItem key={item.id}>
                        <SidebarItemButton
                          variant={isCollapsed ? "icon" : "default"}
                          icon={item.icon}
                          label={item.label}
                          onClick={item.onClick}
                        />
                      </ShadcnSidebarMenuItem>
                    ))}
                  </GroupFragment>
                ))}
              </ShadcnSidebarMenu>
            </ShadcnSidebarGroupContent>
          </ShadcnSidebarGroup>
        </ShadcnSidebarContent>
      </ShadcnSidebar>
    </ShadcnSidebarProvider>
  );
}

function SidebarDrawer({
  className,
  groups = defaultSidebarGroups,
  onClose,
  open,
  ...props
}: SidebarDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <SheetContent
        side="left"
        showCloseButton={false}
        className={cn("w-[292.5px] max-w-[292.5px] border-grey-100 bg-white p-0", className)}
        {...props}
      >
        <SheetHeader className="sr-only">
          <SheetTitle>メニュー</SheetTitle>
          <SheetDescription>サイドバーメニュー</SheetDescription>
        </SheetHeader>
        <ShadcnSidebarProvider className="min-h-0 w-full">
          <div className="h-full w-full overflow-hidden py-4">
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
            <ShadcnSidebarMenu className="mt-4 gap-2">
              {groups.map((group, groupIndex) => (
                <GroupFragment key={group.items.map((item) => item.id).join("-")}>
                  {groupIndex > 0 ? <ShadcnSidebarSeparator className="mx-0 bg-grey-100" /> : null}
                  {group.items.map((item) => (
                    <ShadcnSidebarMenuItem key={item.id}>
                      <SidebarItemButton
                        icon={item.icon}
                        label={item.label}
                        onClick={item.onClick}
                        className="h-10 w-full"
                      />
                    </ShadcnSidebarMenuItem>
                  ))}
                </GroupFragment>
              ))}
            </ShadcnSidebarMenu>
          </div>
        </ShadcnSidebarProvider>
      </SheetContent>
    </Sheet>
  );
}

function GroupFragment({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export { Sidebar, SidebarDrawer, SidebarItem, defaultSidebarGroups };
export type {
  SidebarDrawerProps,
  SidebarGroup,
  SidebarItemProps,
  SidebarItemState,
  SidebarItemVariant,
  SidebarLink,
  SidebarProps,
};
