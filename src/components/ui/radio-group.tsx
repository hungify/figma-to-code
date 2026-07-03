import { Radio as RadioPrimitive } from "@base-ui/react/radio";
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group";

import { cn } from "#/lib/utils";

function RadioGroup({ className, ...props }: RadioGroupPrimitive.Props) {
  return (
    <RadioGroupPrimitive
      data-slot="radio-group"
      className={cn("grid w-full gap-3", className)}
      {...props}
    />
  );
}

type RadioGroupItemProps = RadioPrimitive.Root.Props & {
  forceState?: "focus";
};

function RadioGroupItem({ className, forceState, ...props }: RadioGroupItemProps) {
  return (
    <RadioPrimitive.Root
      data-slot="radio-group-item"
      data-force-state={forceState}
      className={cn(
        "group/radio-group-item peer relative flex size-4 shrink-0 items-center justify-center rounded-full border border-grey-200 bg-white text-green-500 shadow-[0_1px_2px_rgba(16,24,40,0.05)] transition-colors outline-none",
        "focus-visible:border-green-500 focus-visible:shadow-[0_0_0_3px_var(--color-green-100)] data-[force-state=focus]:border-green-500 data-[force-state=focus]:shadow-[0_0_0_3px_var(--color-green-100)]",
        "aria-invalid:border-red-500 aria-invalid:text-red-500",
        "aria-invalid:focus-visible:border-red-500 aria-invalid:focus-visible:shadow-[0_0_0_3px_var(--color-red-100)] aria-invalid:data-[force-state=focus]:border-red-500 aria-invalid:data-[force-state=focus]:shadow-[0_0_0_3px_var(--color-red-100)]",
        "data-checked:border-green-500 data-checked:bg-white",
        "data-disabled:cursor-not-allowed data-disabled:border-grey-100 data-disabled:bg-white data-disabled:text-grey-300",
        "data-checked:data-disabled:border-green-100 data-checked:data-disabled:bg-white data-checked:data-disabled:text-green-100",
        className,
      )}
      {...props}
    >
      <RadioPrimitive.Indicator
        data-slot="radio-group-indicator"
        className="flex size-full items-center justify-center"
      >
        <span data-slot="radio-group-indicator-dot" className="size-2 rounded-full bg-current" />
      </RadioPrimitive.Indicator>
    </RadioPrimitive.Root>
  );
}

export { RadioGroup, RadioGroupItem };
