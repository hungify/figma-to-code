import { CircleXIcon } from "lucide-react";
import * as React from "react";

import { cn } from "#/lib/utils";

type ChipProps = React.ComponentProps<"span"> & {
  append?: React.ReactNode;
  prepend?: React.ReactNode;
};

function Chip({ append, children = "Click me", className, prepend, ...props }: ChipProps) {
  return (
    <span
      data-slot="chip"
      className={cn(
        "inline-flex min-h-6 items-center justify-center gap-1 rounded-full bg-grey-50 px-3 py-0.5 font-sans jp-body-md whitespace-nowrap text-grey-900",
        "[&_[data-slot=chip-icon]]:size-3 [&_[data-slot=chip-icon]]:shrink-0",
        className,
      )}
      {...props}
    >
      {prepend}
      <span>{children}</span>
      {append}
    </span>
  );
}

function ChipIcon({ className, ...props }: React.ComponentProps<typeof CircleXIcon>) {
  return (
    <CircleXIcon
      aria-hidden="true"
      data-slot="chip-icon"
      className={cn("size-3 fill-grey-400 text-white", className)}
      {...props}
    />
  );
}

export { Chip, ChipIcon };
export type { ChipProps };
