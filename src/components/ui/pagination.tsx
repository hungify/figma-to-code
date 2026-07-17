import { ChevronLeftIcon, ChevronRightIcon, MoreHorizontalIcon } from "lucide-react";
import * as React from "react";

import { cn } from "#/lib/utils";

type PaginationProps = React.ComponentProps<"nav">;

/** Accessible pagination landmark. */
function Pagination({ className, ...props }: PaginationProps) {
  return (
    <nav
      aria-label="pagination"
      data-slot="pagination"
      className={cn("flex w-full justify-center", className)}
      {...props}
    />
  );
}

/** Horizontal pagination item list. */
function PaginationContent({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="pagination-content"
      className={cn("flex items-center gap-2", className)}
      {...props}
    />
  );
}

/** Pagination list item wrapper. */
function PaginationItem({ className, ...props }: React.ComponentProps<"li">) {
  return <li data-slot="pagination-item" className={cn("flex", className)} {...props} />;
}

type PaginationControlProps = React.ComponentProps<"button"> & {
  active?: boolean;
};

/** Numeric page control matching Rakita pagination states. */
function PaginationPage({ className, active = false, children, ...props }: PaginationControlProps) {
  return (
    <button
      type="button"
      aria-current={active ? "page" : undefined}
      data-active={active ? "" : undefined}
      data-slot="pagination-page"
      className={cn(
        "flex h-9 min-w-9 items-center justify-center rounded-lg px-2 font-sans jp-label-md text-grey-900 transition-colors outline-none",
        "hover:bg-green-50 focus-visible:border focus-visible:border-green-500 focus-visible:bg-green-50",
        "disabled:pointer-events-none disabled:opacity-50",
        active &&
          "border border-green-500 bg-green-50 text-green-500 shadow-[0_1px_1px_rgb(0_0_0/0.05)]",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

type PaginationDirectionProps = React.ComponentProps<"button"> & {
  direction: "previous" | "next";
  variant?: "icon" | "text";
};

/** Previous/next pagination control, rendered as icon or text. */
function PaginationDirection({
  className,
  direction,
  variant = "icon",
  children,
  ...props
}: PaginationDirectionProps) {
  const Icon = direction === "previous" ? ChevronLeftIcon : ChevronRightIcon;
  const label = direction === "previous" ? "Previous" : "Next";

  return (
    <button
      type="button"
      aria-label={label}
      data-slot={`pagination-${direction}`}
      className={cn(
        "flex h-9 items-center justify-center rounded-lg bg-transparent font-sans jp-label-md text-grey-900 transition-colors outline-none",
        "hover:bg-green-50 focus-visible:border focus-visible:border-green-500",
        "disabled:pointer-events-none disabled:opacity-50",
        variant === "icon" ? "w-9" : "min-w-[119px] px-4",
        className,
      )}
      {...props}
    >
      {variant === "icon" ? <Icon aria-hidden="true" className="size-6" /> : (children ?? label)}
    </button>
  );
}

/** Previous pagination control. */
function PaginationPrevious({ variant, ...props }: Omit<PaginationDirectionProps, "direction">) {
  return <PaginationDirection direction="previous" variant={variant} {...props} />;
}

/** Next pagination control. */
function PaginationNext({ variant, ...props }: Omit<PaginationDirectionProps, "direction">) {
  return <PaginationDirection direction="next" variant={variant} {...props} />;
}

/** Non-interactive pagination ellipsis. */
function PaginationEllipsis({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      aria-hidden="true"
      data-slot="pagination-ellipsis"
      className={cn("flex size-9 items-center justify-center rounded-lg text-grey-900", className)}
      {...props}
    >
      <MoreHorizontalIcon className="size-4" />
      <span className="sr-only">More pages</span>
    </span>
  );
}

export {
  Pagination,
  PaginationContent,
  PaginationDirection,
  PaginationEllipsis,
  PaginationItem,
  PaginationNext,
  PaginationPage,
  PaginationPrevious,
};
export type { PaginationControlProps, PaginationDirectionProps, PaginationProps };
