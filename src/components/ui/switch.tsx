import { Switch as SwitchPrimitive } from "@base-ui/react/switch";

import { cn } from "#/lib/utils";

type SwitchProps = SwitchPrimitive.Root.Props & {
  forceState?: "focus";
};

function Switch({ className, forceState, ...props }: SwitchProps) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-force-state={forceState}
      className={cn(
        "group/switch relative inline-flex h-[18px] w-[33px] shrink-0 items-center rounded-full bg-grey-100 shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-colors outline-none",
        "focus-visible:shadow-[0_0_0_3px_#d4d4d4] data-[force-state=focus]:shadow-[0_0_0_3px_#d4d4d4]",
        "data-checked:bg-green-500",
        "data-disabled:cursor-not-allowed data-disabled:bg-grey-100 data-disabled:opacity-50 data-disabled:shadow-none data-disabled:data-checked:bg-green-300",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none absolute left-px size-4 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-transform data-checked:translate-x-[15px]"
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
