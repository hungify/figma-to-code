import { ChevronDownIcon, ChevronRightIcon, EllipsisIcon, SlashIcon } from "lucide-react";
import * as React from "react";

import { cn } from "#/lib/utils";

function Breadcrumb({ className, ...props }: React.ComponentProps<"nav">) {
  return (
    <nav
      aria-label="breadcrumb"
      data-slot="breadcrumb"
      className={cn("flex", className)}
      {...props}
    />
  );
}

function BreadcrumbList({ className, ...props }: React.ComponentProps<"ol">) {
  return (
    <ol
      data-slot="breadcrumb-list"
      className={cn("flex flex-wrap items-center gap-1 font-sans jp-label-md", className)}
      {...props}
    />
  );
}

function BreadcrumbItem({ className, ...props }: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="breadcrumb-item"
      className={cn("inline-flex items-center gap-1", className)}
      {...props}
    />
  );
}

type BreadcrumbLinkProps = React.ComponentProps<"a"> & {
  dropdown?: boolean;
  forceState?: "hover";
};

function BreadcrumbLink({
  className,
  dropdown = false,
  forceState,
  children,
  ...props
}: BreadcrumbLinkProps) {
  return (
    <a
      data-slot="breadcrumb-link"
      data-force-state={forceState}
      className={cn(
        "inline-flex items-center gap-1 font-sans jp-label-md whitespace-nowrap text-grey-500 transition-colors outline-none",
        "hover:text-green-500 focus-visible:text-green-500 data-[force-state=hover]:text-green-500",
        className,
      )}
      {...props}
    >
      <span>{children}</span>
      {dropdown ? <ChevronDownIcon aria-hidden="true" className="size-3" /> : null}
    </a>
  );
}

type BreadcrumbPageProps = React.ComponentProps<"span"> & {
  dropdown?: boolean;
};

function BreadcrumbPage({ className, dropdown = false, children, ...props }: BreadcrumbPageProps) {
  return (
    <span
      data-slot="breadcrumb-page"
      role="link"
      aria-disabled="true"
      aria-current="page"
      className={cn(
        "inline-flex items-center gap-1 font-sans jp-label-md whitespace-nowrap text-green-500",
        className,
      )}
      {...props}
    >
      <span>{children}</span>
      {dropdown ? <ChevronDownIcon aria-hidden="true" className="size-3 text-grey-500" /> : null}
    </span>
  );
}

type BreadcrumbSeparatorProps = React.ComponentProps<"li"> & {
  variant?: "chevron" | "slash" | "dropdown";
};

function BreadcrumbSeparator({
  children,
  className,
  variant = "chevron",
  ...props
}: BreadcrumbSeparatorProps) {
  const icons = {
    chevron: ChevronRightIcon,
    slash: SlashIcon,
    dropdown: ChevronDownIcon,
  } as const;

  const Icon = icons[variant];

  return (
    <li
      data-slot="breadcrumb-separator"
      role="presentation"
      aria-hidden="true"
      className={cn("flex size-3.5 items-center justify-center text-grey-500", className)}
      {...props}
    >
      {children ?? <Icon className="size-3.5" />}
    </li>
  );
}

function BreadcrumbEllipsis({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="breadcrumb-ellipsis"
      role="presentation"
      aria-hidden="true"
      className={cn("flex size-4 items-center justify-center text-grey-300", className)}
      {...props}
    >
      <EllipsisIcon className="size-4" />
      <span className="sr-only">More</span>
    </span>
  );
}

export {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
};
export type { BreadcrumbLinkProps, BreadcrumbPageProps, BreadcrumbSeparatorProps };
