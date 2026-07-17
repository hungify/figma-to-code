import { cva, type VariantProps } from "class-variance-authority";
import { CheckIcon } from "lucide-react";
import * as React from "react";

import { cn } from "#/lib/utils";

const badgeVariants = cva(
  "inline-flex h-7 w-[88px] shrink-0 items-center justify-center gap-1 rounded-[5px] px-2 py-1 font-sans jp-body-md font-normal whitespace-nowrap",
  {
    variants: {
      type: {
        bold: "",
        regular: "",
      },
      status: {
        inprogress: "",
        success: "",
        disable: "",
        danger: "",
        error: "",
        waiting: "",
      },
    },
    compoundVariants: [
      {
        type: "bold",
        status: "inprogress",
        className: "bg-blue-400 text-white",
      },
      {
        type: "bold",
        status: "success",
        className: "bg-green-400 text-white",
      },
      {
        type: "bold",
        status: "disable",
        // Figma Grey/gray-700 (#374151) — not brand grey-800; soft fill like Button grey filled
        className: "bg-grey-100 text-[#374151]",
      },
      {
        type: "bold",
        status: "danger",
        className: "bg-orange-400 text-white",
      },
      {
        type: "bold",
        status: "error",
        className: "bg-red-400 text-white",
      },
      {
        type: "bold",
        status: "waiting",
        className: "bg-yellow-400 text-white",
      },
      {
        type: "regular",
        status: "inprogress",
        className: "bg-blue-50 text-blue-500",
      },
      {
        type: "regular",
        status: "success",
        className: "bg-green-50 text-green-600",
      },
      {
        type: "regular",
        status: "disable",
        className: "bg-grey-50 text-grey-500",
      },
      {
        type: "regular",
        status: "danger",
        className: "bg-orange-50 text-orange-600",
      },
      {
        type: "regular",
        status: "error",
        className: "bg-red-50 text-red-600",
      },
      {
        type: "regular",
        status: "waiting",
        className: "bg-yellow-50 text-yellow-600",
      },
    ],
    defaultVariants: {
      type: "bold",
      status: "inprogress",
    },
  },
);

const badgeLabels = {
  bold: {
    inprogress: "Inprogress",
    success: "Success",
    disable: "Todo",
    danger: "Danger",
    error: "Error",
    waiting: "Warning",
  },
  regular: {
    inprogress: "Inprogress",
    success: "Success",
    disable: "Todo",
    danger: "Danger",
    error: "Error",
    waiting: "Waiting",
  },
} satisfies Record<
  NonNullable<VariantProps<typeof badgeVariants>["type"]>,
  Record<NonNullable<VariantProps<typeof badgeVariants>["status"]>, string>
>;

type BadgeProps = React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & {
    showIcon?: boolean;
  };

function Badge({
  className,
  type = "bold",
  status = "inprogress",
  showIcon = false,
  children,
  ...props
}: BadgeProps) {
  const badgeType = type ?? "bold";
  const badgeStatus = status ?? "inprogress";

  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ type: badgeType, status: badgeStatus, className }))}
      {...props}
    >
      {showIcon ? <CheckIcon aria-hidden="true" className="size-4 shrink-0" /> : null}
      <span className="shrink-0">{children ?? badgeLabels[badgeType][badgeStatus]}</span>
    </span>
  );
}

export { Badge, badgeVariants };
export type { BadgeProps };
