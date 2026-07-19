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
import type { ComponentPropsWithoutRef, MouseEventHandler, ReactNode } from "react";

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
  SidebarHeader as ShadcnSidebarHeader,
  SidebarMenu as ShadcnSidebarMenu,
  SidebarMenuButton as ShadcnSidebarMenuButton,
  SidebarMenuItem as ShadcnSidebarMenuItem,
  SidebarProvider as ShadcnSidebarProvider,
  SidebarSeparator as ShadcnSidebarSeparator,
  useSidebar as useShadcnSidebar,
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
        isIcon ? "w-13 justify-center" : "w-51.25 justify-start",
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
  groups = defaultSidebarGroups,
  label = "メニュー",
  ...props
}: SidebarProps) {
  const { state, toggleSidebar } = useShadcnSidebar();
  const isCollapsed = state === "collapsed";

  return (
    <ShadcnSidebar
      collapsible="icon"
      variant="floating"
      className={cn("text-grey-900", className)}
      {...props}
    >
      <ShadcnSidebarHeader
        className={cn(
          "flex-row items-center justify-between px-4 pt-6",
          isCollapsed && "justify-center px-2",
        )}
      >
        {isCollapsed ? null : <p className="jp-label-md text-green-500">{label}</p>}
        <button
          type="button"
          aria-label={isCollapsed ? "メニューを開く" : "メニューを閉じる"}
          onClick={toggleSidebar}
          className="flex size-8 shrink-0 items-center justify-center rounded-lg text-grey-500 focus-visible:ring-3 focus-visible:ring-green-100 focus-visible:outline-none"
        >
          <MenuIcon className="size-6" aria-hidden="true" strokeWidth={2} />
        </button>
      </ShadcnSidebarHeader>
      <ShadcnSidebarContent
        className={cn("gap-2 bg-white px-4 py-4", isCollapsed && "items-center px-2")}
      >
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
