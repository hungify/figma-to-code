import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";

import { cn } from "#/lib/utils";

type CheckboxProps = CheckboxPrimitive.Root.Props & {
  forceState?: "focus";
};

function Checkbox({ className, forceState, ...props }: CheckboxProps) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      data-force-state={forceState}
      className={cn(
        "group/checkbox peer relative flex size-4 shrink-0 items-center justify-center rounded-sm text-white transition-colors outline-none before:absolute before:inset-px before:rounded-sm before:border before:border-grey-100 before:bg-white before:shadow-[0_1px_2px_rgba(0,0,0,0.05)] before:content-['']",
        "focus-visible:before:border-grey-300 focus-visible:before:ring-3 focus-visible:before:ring-grey-200 data-[force-state=focus]:before:border-grey-300 data-[force-state=focus]:before:ring-3 data-[force-state=focus]:before:ring-grey-200",
        "aria-invalid:before:border-red-500 aria-invalid:before:shadow-[0_1px_2px_rgba(0,0,0,0.05)]",
        "aria-invalid:focus-visible:before:border-red-500 aria-invalid:focus-visible:before:ring-3 aria-invalid:focus-visible:before:ring-red-200 aria-invalid:data-[force-state=focus]:before:border-red-500 aria-invalid:data-[force-state=focus]:before:ring-3 aria-invalid:data-[force-state=focus]:before:ring-red-200",
        "data-checked:before:inset-0 data-checked:before:border-green-500 data-checked:before:bg-green-500 data-checked:before:shadow-none",
        "data-indeterminate:before:inset-0 data-indeterminate:before:border-green-500 data-indeterminate:before:bg-green-500 data-indeterminate:before:shadow-none",
        "data-indeterminate:data-[force-state=focus]:before:shadow-none data-indeterminate:data-[force-state=focus]:before:ring-0 data-checked:data-[force-state=focus]:before:shadow-none data-checked:data-[force-state=focus]:before:ring-0",
        "aria-invalid:data-indeterminate:before:border-red-600 aria-invalid:data-indeterminate:before:bg-red-600 aria-invalid:data-checked:before:border-red-600 aria-invalid:data-checked:before:bg-red-600",
        "aria-invalid:data-checked:data-[force-state=focus]:before:ring-3 aria-invalid:data-checked:data-[force-state=focus]:before:ring-red-200",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:before:border-grey-100 disabled:before:bg-white disabled:data-indeterminate:before:border-green-500 disabled:data-indeterminate:before:bg-green-500 disabled:data-checked:before:border-green-500 disabled:data-checked:before:bg-green-500",
        "data-disabled:cursor-not-allowed data-disabled:opacity-50 data-disabled:before:border-grey-100 data-disabled:before:bg-white data-disabled:data-indeterminate:before:border-green-500 data-disabled:data-indeterminate:before:bg-green-500 data-disabled:data-checked:before:border-green-500 data-disabled:data-checked:before:bg-green-500",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="relative z-10 block size-3.5 text-current transition-none [&:not([data-indeterminate])_[data-slot=checkbox-check-icon]]:block [&[data-indeterminate]_[data-slot=checkbox-minus-icon]]:block"
      >
        <span
          data-slot="checkbox-check-icon"
          className="absolute inset-0 hidden size-3.5 bg-white"
          style={{
            clipPath:
              'path("M11.3573 3.19067C11.5282 3.01982 11.8051 3.01982 11.976 3.19067C12.1468 3.36153 12.1468 3.63847 11.976 3.80933L5.55933 10.226C5.38847 10.3968 5.11153 10.3968 4.94067 10.226L2.02401 7.30933C1.85315 7.13847 1.85315 6.86153 2.02401 6.69067C2.19486 6.51982 2.47181 6.51982 2.64266 6.69067L5.25 9.29802L11.3573 3.19067Z")',
          }}
        />
        <span
          data-slot="checkbox-minus-icon"
          className="absolute top-[6.25px] left-[2.5px] hidden h-[1.5px] w-[9px] rounded-full bg-white"
        />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
