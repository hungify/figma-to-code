import {
  Building2Icon,
  BuildingIcon,
  FileTextIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
import type { ComponentPropsWithoutRef } from "react";

import { cn } from "#/lib/utils";

const topMenuItemContent = {
  transition: {
    title: "ワークブリッジ南桜台",
    description: "就労移行支援",
    Icon: BuildingIcon,
    toneClassName: "bg-blue-50 text-blue-500",
  },
  continuationA: {
    title: "ワークブリッジ南桜台",
    description: "就労継続支援A型",
    Icon: BuildingIcon,
    toneClassName: "bg-orange-50 text-orange-500",
  },
  continuationB: {
    title: "ワークブリッジ南桜台",
    description: "就労継続支援B型",
    Icon: BuildingIcon,
    toneClassName: "bg-yellow-50 text-yellow-500",
  },
  users: {
    title: "ユーザー一覧",
    description: "登録ユーザーの確認・管理",
    Icon: UsersIcon,
    toneClassName: "bg-green-50 text-green-500",
  },
  contract: {
    title: "契約情報確認",
    description: "現在の契約内容を確認する",
    Icon: FileTextIcon,
    toneClassName: "bg-blue-50 text-blue-500",
  },
  company: {
    title: "会社情報確認",
    description: "登録中の会社情報を確認・編集する",
    Icon: Building2Icon,
    toneClassName: "bg-green-50 text-green-500",
  },
} as const satisfies Record<
  string,
  {
    description: string;
    Icon: LucideIcon;
    title: string;
    toneClassName: string;
  }
>;

type TopMenuItemVariant = keyof typeof topMenuItemContent;

type TopMenuItemBaseProps = {
  className?: string;
  description?: string;
  title?: string;
  variant?: TopMenuItemVariant;
};

type TopMenuItemAnchorProps = TopMenuItemBaseProps & {
  href: string;
} & Omit<ComponentPropsWithoutRef<"a">, "children" | "className" | "href">;

type TopMenuItemButtonProps = TopMenuItemBaseProps & {
  href?: undefined;
} & Omit<ComponentPropsWithoutRef<"button">, "children" | "className" | "type">;

type TopMenuItemProps = TopMenuItemAnchorProps | TopMenuItemButtonProps;

function TopMenuItem(props: TopMenuItemProps) {
  const { className, description, title, variant = "transition" } = props;
  const content = topMenuItemContent[variant];
  const Icon = content.Icon;
  const resolvedTitle = title ?? content.title;
  const resolvedDescription = description ?? content.description;
  const contentNode = (
    <>
      <span className={cn("flex shrink-0 items-center rounded-lg p-2", content.toneClassName)}>
        <Icon className="size-9" aria-hidden="true" strokeWidth={2} />
      </span>
      <span className="flex min-w-0 flex-col justify-center gap-1 whitespace-nowrap">
        <span className="jp-label-lg font-bold text-grey-900">{resolvedTitle}</span>
        <span className="jp-body-md text-grey-500">{resolvedDescription}</span>
      </span>
    </>
  );
  const rootClassName = cn(
    "flex items-center gap-2 text-left",
    "focus-visible:ring-3 focus-visible:ring-green-100 focus-visible:outline-none",
    className,
  );

  if (props.href != null) {
    const {
      className: _className,
      description: _description,
      title: _title,
      variant: _variant,
      ...anchorProps
    } = props;

    return (
      <a className={rootClassName} {...anchorProps}>
        {contentNode}
      </a>
    );
  }

  const {
    className: _className,
    description: _description,
    href: _href,
    title: _title,
    variant: _variant,
    ...buttonProps
  } = props;

  return (
    <button type="button" className={rootClassName} {...buttonProps}>
      {contentNode}
    </button>
  );
}

export { TopMenuItem };
export type { TopMenuItemProps, TopMenuItemVariant };
