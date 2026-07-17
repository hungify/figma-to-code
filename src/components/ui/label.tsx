import * as React from "react";

import { cn } from "#/lib/utils";

function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    // oxlint-disable-next-line jsx-a11y/label-has-associated-control -- generic primitive; callers supply htmlFor/children
    <label
      data-slot="label"
      className={cn(
        "flex items-center gap-2 jp-label-lg select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

type ControlLabelProps = React.ComponentProps<"label"> & {
  disabled?: boolean;
};

function ControlLabel({ className, disabled, ...props }: ControlLabelProps) {
  return (
    // oxlint-disable-next-line jsx-a11y/label-has-associated-control -- generic primitive; callers supply htmlFor/children
    <label
      data-slot="control-label"
      data-disabled={disabled || undefined}
      aria-disabled={disabled || undefined}
      className={cn(
        "flex items-start font-sans jp-body-lg whitespace-nowrap text-grey-900 select-none data-disabled:text-grey-300",
        className,
      )}
      {...props}
    />
  );
}

export { ControlLabel, Label };
