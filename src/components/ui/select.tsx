import { Select as SelectPrimitive } from "@base-ui/react/select";
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import * as React from "react";

import { cn } from "#/lib/utils";

import { Checkbox } from "./checkbox";
import { Field, FieldDescription, FieldError, FieldLabel, FieldRequired } from "./field";

const Select = SelectPrimitive.Root;

type SelectTriggerProps = SelectPrimitive.Trigger.Props & {
  forceState?: "focus";
};

function SelectTrigger({ className, children, forceState, ...props }: SelectTriggerProps) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-force-state={forceState}
      className={cn(
        "flex h-12 w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-grey-100 bg-white px-3 jp-body-lg text-grey-900 transition-colors outline-none",
        "focus-visible:border-2 focus-visible:border-green-300 data-popup-open:border-grey-100 data-[force-state=focus]:border-2 data-[force-state=focus]:border-green-300",
        "aria-invalid:border-red-500 data-placeholder:text-grey-300 data-disabled:pointer-events-none data-disabled:cursor-not-allowed data-disabled:bg-grey-50 data-disabled:text-grey-300",
        "*:data-[slot=select-value]:min-w-0 *:data-[slot=select-value]:flex-1 *:data-[slot=select-value]:truncate",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0",
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon render={<ChevronDownIcon className="size-6 text-grey-300" />} />
    </SelectPrimitive.Trigger>
  );
}

function SelectValue({ className, ...props }: SelectPrimitive.Value.Props) {
  return (
    <SelectPrimitive.Value
      data-slot="select-value"
      className={cn("min-w-0 flex-1 truncate text-left", className)}
      {...props}
    />
  );
}

function SelectContent({
  className,
  children,
  side = "bottom",
  sideOffset = 8,
  align = "center",
  alignOffset = 0,
  alignItemWithTrigger = false,
  ...props
}: SelectPrimitive.Popup.Props &
  Pick<
    SelectPrimitive.Positioner.Props,
    "align" | "alignOffset" | "alignItemWithTrigger" | "side" | "sideOffset"
  >) {
  const popup = (
    <SelectPrimitive.Popup
      data-slot="select-content"
      data-align-trigger={alignItemWithTrigger}
      className={cn(
        "relative isolate z-50 max-h-(--available-height) w-(--anchor-width) min-w-36 overflow-x-hidden overflow-y-auto rounded-[5px] bg-white p-1 shadow-[0_0_5px_rgba(0,0,0,0.15)]",
        "origin-(--transform-origin) duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
        className,
      )}
      {...props}
    >
      <SelectScrollUpButton />
      <SelectPrimitive.List data-slot="select-list">{children}</SelectPrimitive.List>
      <SelectScrollDownButton />
    </SelectPrimitive.Popup>
  );

  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        alignItemWithTrigger={alignItemWithTrigger}
        className="isolate z-50"
      >
        {popup}
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  );
}

function SelectGroup({ className, ...props }: SelectPrimitive.Group.Props) {
  return (
    <SelectPrimitive.Group
      data-slot="select-group"
      className={cn("scroll-my-1.5", className)}
      {...props}
    />
  );
}

function SelectLabel({ className, ...props }: SelectPrimitive.GroupLabel.Props) {
  return (
    <SelectPrimitive.GroupLabel
      data-slot="select-label"
      className={cn("px-4 py-2 jp-body-sm text-grey-500", className)}
      {...props}
    />
  );
}

type SelectItemProps = SelectPrimitive.Item.Props & {
  checkbox?: boolean;
  forceState?: "hover" | "active" | "focus";
};

function SelectItem({
  className,
  children,
  checkbox,
  disabled,
  forceState,
  ...props
}: SelectItemProps) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      data-force-state={forceState}
      disabled={disabled}
      className={cn(
        "relative flex h-12 w-full cursor-pointer items-center gap-4 rounded-md px-4 py-3 outline-none select-none",
        "jp-body-lg text-grey-900 data-disabled:pointer-events-none data-disabled:cursor-not-allowed data-disabled:text-grey-300",
        "data-highlighted:bg-grey-50 data-[force-state=active]:bg-green-50 data-[force-state=focus]:border-2 data-[force-state=focus]:border-green-200 data-[force-state=focus]:bg-green-50 data-[force-state=hover]:bg-grey-50",
        "data-selected:bg-green-50",
        className,
      )}
      {...props}
    >
      {checkbox && <Checkbox className="pointer-events-none" checked={false} disabled={disabled} />}
      <SelectPrimitive.ItemText className="min-w-0 flex-1 truncate whitespace-nowrap">
        {children}
      </SelectPrimitive.ItemText>
      {!checkbox && (
        <SelectPrimitive.ItemIndicator
          data-slot="select-item-indicator"
          className="pointer-events-none absolute right-4 hidden size-4 items-center justify-center data-selected:flex"
        >
          <CheckIcon className="size-4" />
        </SelectPrimitive.ItemIndicator>
      )}
    </SelectPrimitive.Item>
  );
}

function SelectSeparator({ className, ...props }: SelectPrimitive.Separator.Props) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn("pointer-events-none my-1 h-px bg-border", className)}
      {...props}
    />
  );
}

function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpArrow>) {
  return (
    <SelectPrimitive.ScrollUpArrow
      data-slot="select-scroll-up-button"
      className={cn(
        "hidden w-full items-center justify-center bg-white py-1 data-side-none:flex",
        className,
      )}
      {...props}
    >
      <ChevronUpIcon className="size-4" />
    </SelectPrimitive.ScrollUpArrow>
  );
}

function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownArrow>) {
  return (
    <SelectPrimitive.ScrollDownArrow
      data-slot="select-scroll-down-button"
      className={cn(
        "hidden w-full items-center justify-center bg-white py-1 data-side-none:flex",
        className,
      )}
      {...props}
    >
      <ChevronDownIcon className="size-4" />
    </SelectPrimitive.ScrollDownArrow>
  );
}

type SelectOption = {
  disabled?: boolean;
  label: React.ReactNode;
  value: string;
};

type SelectFieldProps = Omit<SelectPrimitive.Root.Props<string>, "children"> & {
  "aria-invalid"?: boolean | "false" | "true";
  checkboxItems?: boolean;
  className?: string;
  controlClassName?: string;
  forceState?: "focus";
  hint?: React.ReactNode;
  hintPosition?: "top" | "bottom";
  label?: React.ReactNode;
  options: readonly SelectOption[];
  placeholder?: React.ReactNode;
  required?: boolean;
};

function SelectField({
  checkboxItems,
  className,
  controlClassName,
  disabled,
  forceState,
  hint,
  hintPosition = "bottom",
  label,
  options,
  placeholder = "Select an item",
  required,
  "aria-invalid": ariaInvalid,
  ...props
}: SelectFieldProps) {
  const invalid = ariaInvalid === true || ariaInvalid === "true";

  return (
    <Field data-invalid={invalid} data-disabled={disabled || undefined} className={className}>
      {label && (
        <FieldLabel>
          {label}
          {required && <FieldRequired>必須</FieldRequired>}
        </FieldLabel>
      )}
      {hint && !invalid && hintPosition === "top" && <FieldDescription>{hint}</FieldDescription>}
      <Select disabled={disabled} items={options} required={required} {...props}>
        <SelectTrigger
          forceState={forceState}
          aria-invalid={ariaInvalid}
          className={controlClassName}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              disabled={option.disabled}
              checkbox={checkboxItems}
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {invalid ? (
        <FieldError className="px-2">{hint}</FieldError>
      ) : (
        hint &&
        hintPosition === "bottom" && <FieldDescription className="px-2">{hint}</FieldDescription>
      )}
    </Field>
  );
}

export {
  Select,
  SelectContent,
  SelectField,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
};
