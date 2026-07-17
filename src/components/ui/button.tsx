import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "#/lib/utils";

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding font-sans whitespace-nowrap transition-colors outline-none select-none disabled:pointer-events-none disabled:bg-(--color-grey-50) disabled:text-(--color-grey-400) aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        filled:
          "bg-(--btn-color) text-(--btn-fg) hover:bg-(--btn-color-hover) focus-visible:border-2 focus-visible:border-(--btn-color-focus) active:bg-(--btn-color-active) data-[force-state=active]:bg-(--btn-color-active) data-[force-state=focus]:border-2 data-[force-state=focus]:border-(--btn-color-focus) data-[force-state=hover]:bg-(--btn-color-hover)",
        outline:
          "border-(--btn-color) bg-background text-(--btn-color) hover:bg-(--btn-color-soft) focus-visible:border-2 focus-visible:border-(--btn-color) active:bg-(--btn-color-soft-active) disabled:border-transparent data-[force-state=active]:bg-(--btn-color-soft-active) data-[force-state=focus]:border-2 data-[force-state=hover]:bg-(--btn-color-soft) dark:bg-transparent",
        ghost:
          "text-(--btn-color) hover:bg-(--btn-color-soft) focus-visible:border-2 focus-visible:border-(--btn-color-focus) active:bg-(--btn-color-soft-active) data-[force-state=active]:bg-(--btn-color-soft-active) data-[force-state=focus]:border-2 data-[force-state=focus]:border-(--btn-color-focus) data-[force-state=hover]:bg-(--btn-color-soft)",
        link: "text-(--btn-color) underline-offset-4 hover:underline focus-visible:border-0 focus-visible:underline disabled:bg-transparent data-[force-state=focus]:underline data-[force-state=hover]:underline",
      },
      color: {
        green:
          "[--btn-color-active:var(--color-green-600)] [--btn-color-focus:var(--color-green-800)] [--btn-color-hover:var(--color-green-400)] [--btn-color-soft-active:var(--color-green-100)] [--btn-color-soft:var(--color-green-50)] [--btn-color:var(--color-green-500)] [--btn-fg:white]",
        lime: "[--btn-color-active:var(--color-lime-600)] [--btn-color-focus:var(--color-lime-800)] [--btn-color-hover:var(--color-lime-400)] [--btn-color-soft-active:var(--color-lime-100)] [--btn-color-soft:var(--color-lime-50)] [--btn-color:var(--color-lime-500)] [--btn-fg:white]",
        blue: "[--btn-color-active:var(--color-blue-600)] [--btn-color-focus:var(--color-blue-800)] [--btn-color-hover:var(--color-blue-400)] [--btn-color-soft-active:var(--color-blue-100)] [--btn-color-soft:var(--color-blue-50)] [--btn-color:var(--color-blue-500)] [--btn-fg:white]",
        red: "[--btn-color-active:var(--color-red-600)] [--btn-color-focus:var(--color-red-800)] [--btn-color-hover:var(--color-red-400)] [--btn-color-soft-active:var(--color-red-100)] [--btn-color-soft:var(--color-red-50)] [--btn-color:var(--color-red-500)] [--btn-fg:white]",
        // Figma Color=Danger uses orange scale
        danger:
          "[--btn-color-active:var(--color-orange-600)] [--btn-color-focus:var(--color-orange-800)] [--btn-color-hover:var(--color-orange-400)] [--btn-color-soft-active:var(--color-orange-100)] [--btn-color-soft:var(--color-orange-50)] [--btn-color:var(--color-orange-500)] [--btn-fg:white]",
        yellow:
          "[--btn-color-active:var(--color-yellow-600)] [--btn-color-focus:var(--color-yellow-800)] [--btn-color-hover:var(--color-yellow-400)] [--btn-color-soft-active:var(--color-yellow-100)] [--btn-color-soft:var(--color-yellow-50)] [--btn-color:var(--color-yellow-500)] [--btn-fg:white]",
        // Outline/ghost use grey-500. Filled grey is soft (see compoundVariants) — not saturated 700 + white.
        grey: "[--btn-color-active:var(--color-grey-600)] [--btn-color-focus:var(--color-grey-500)] [--btn-color-hover:var(--color-grey-400)] [--btn-color-soft-active:var(--color-grey-100)] [--btn-color-soft:var(--color-grey-50)] [--btn-color:var(--color-grey-500)] [--btn-fg:var(--color-grey-500)]",
      },
      size: {
        sm: "h-8 gap-2 px-6 py-2 text-sm leading-4 font-medium [&_svg:not([class*='size-'])]:size-4",
        md: "h-10 gap-2 px-6 py-2.5 text-sm leading-4 font-medium [&_svg:not([class*='size-'])]:size-5",
        lg: "h-12 gap-2 px-6 py-3 text-base leading-5 font-bold [&_svg:not([class*='size-'])]:size-6",
        xl: "h-14 gap-2 px-6 py-3 text-base leading-5 font-bold [&_svg:not([class*='size-'])]:size-8",
        "icon-sm": "size-8",
        icon: "size-10",
        "icon-lg": "size-12 [&_svg:not([class*='size-'])]:size-6",
        "icon-xl": "size-14 [&_svg:not([class*='size-'])]:size-8",
      },
    },
    compoundVariants: [
      {
        variant: "filled",
        color: "grey",
        className:
          "bg-grey-100 text-grey-500 hover:bg-grey-50 focus-visible:border-grey-500 active:bg-grey-100 data-[force-state=active]:bg-grey-100 data-[force-state=focus]:border-grey-500 data-[force-state=hover]:bg-grey-50",
      },
    ],
    defaultVariants: {
      variant: "filled",
      color: "green",
      size: "md",
    },
  },
);

type ButtonProps = ButtonPrimitive.Props &
  VariantProps<typeof buttonVariants> & {
    forceState?: "hover" | "active" | "focus";
  };

function Button({ className, variant, color, size, forceState, ...props }: ButtonProps) {
  return (
    <ButtonPrimitive
      data-slot="button"
      data-force-state={forceState}
      className={cn(buttonVariants({ variant, color, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
