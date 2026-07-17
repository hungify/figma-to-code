import * as React from "react";

import { cn } from "#/lib/utils";

const serviceTagLabels = {
  i: {
    long: "就労移行支援",
    short: "移行支援",
  },
  a: {
    long: "就労継続支援A型",
    short: "継続支援A",
  },
  b: {
    long: "就労継続支援B型",
    short: "継続支援B",
  },
} as const;

const serviceTagColorClasses = {
  fill: {
    i: "bg-blue-500 text-white",
    a: "bg-orange-500 text-white",
    b: "bg-yellow-500 text-white",
  },
  outline: {
    i: "border border-blue-500 bg-blue-50 text-blue-500",
    a: "border border-orange-500 bg-orange-50 text-orange-500",
    b: "border border-yellow-500 bg-yellow-50 text-yellow-500",
  },
} as const;

type ServiceTagType = keyof typeof serviceTagLabels;
type ServiceTagLength = keyof (typeof serviceTagLabels)["i"];
type ServiceTagAppearance = keyof typeof serviceTagColorClasses;

type ServiceTagProps = React.ComponentProps<"span"> & {
  appearance?: ServiceTagAppearance;
  length?: ServiceTagLength;
  serviceType?: ServiceTagType;
};

function ServiceTag({
  appearance = "fill",
  children,
  className,
  length = "long",
  serviceType = "i",
  ...props
}: ServiceTagProps) {
  const typographyClass = appearance === "fill" ? "jp-body-sm font-bold" : "jp-body-sm";

  return (
    <span
      data-slot="service-tag"
      data-appearance={appearance}
      data-length={length}
      data-service-type={serviceType}
      className={cn(
        "inline-flex min-h-[27px] shrink-0 items-center rounded whitespace-nowrap",
        length === "short" ? "justify-center px-1" : "justify-start px-3",
        typographyClass,
        serviceTagColorClasses[appearance][serviceType],
        className,
      )}
      {...props}
    >
      {children ?? serviceTagLabels[serviceType][length]}
    </span>
  );
}

export { ServiceTag };
export type { ServiceTagAppearance, ServiceTagLength, ServiceTagProps, ServiceTagType };
