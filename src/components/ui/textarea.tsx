import * as React from "react";

import { cn } from "#/lib/utils";

import { Field, FieldDescription, FieldError, FieldLabel, FieldRequired } from "./field";

type TextareaProps = React.ComponentProps<"textarea"> & {
  forceState?: "hover" | "focus";
};

function Textarea({ className, forceState, ...props }: TextareaProps) {
  return (
    <textarea
      data-slot="textarea"
      data-force-state={forceState}
      className={cn(
        "min-h-44 w-full min-w-0 resize-none rounded-lg border border-grey-100 bg-white px-3 py-2 jp-body-lg [color:var(--color-grey-900)] transition-colors outline-none placeholder:text-grey-300",
        "hover:border-grey-100 focus-visible:border-2 focus-visible:border-green-300 data-[force-state=focus]:border-2 data-[force-state=focus]:border-green-300 data-[force-state=hover]:border-grey-100",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-grey-50 disabled:text-grey-300 aria-invalid:border-red-500 aria-invalid:focus-visible:border-red-500 aria-invalid:data-[force-state=focus]:border-red-500",
        className,
      )}
      {...props}
    />
  );
}

type TextareaFieldProps = Omit<TextareaProps, "className"> & {
  className?: string;
  controlClassName?: string;
  hint?: React.ReactNode;
  hintPosition?: "top" | "bottom";
  label: React.ReactNode;
  required?: boolean;
};

function TextareaField({
  className,
  controlClassName,
  disabled,
  hint,
  hintPosition = "bottom",
  id,
  label,
  required,
  "aria-invalid": ariaInvalid,
  ...props
}: TextareaFieldProps) {
  const generatedId = React.useId();
  const textareaId = id ?? generatedId;
  const invalid = ariaInvalid === true || ariaInvalid === "true";

  return (
    <Field data-invalid={invalid} data-disabled={disabled || undefined} className={className}>
      <FieldLabel htmlFor={textareaId}>
        {label}
        {required && <FieldRequired>必須</FieldRequired>}
      </FieldLabel>
      {hint && !invalid && hintPosition === "top" && <FieldDescription>{hint}</FieldDescription>}
      <Textarea
        id={textareaId}
        disabled={disabled}
        aria-invalid={ariaInvalid}
        className={controlClassName}
        {...props}
      />
      {invalid ? (
        <FieldError className="px-2">{hint}</FieldError>
      ) : (
        hint &&
        hintPosition === "bottom" && <FieldDescription className="px-2">{hint}</FieldDescription>
      )}
    </Field>
  );
}

export { Textarea, TextareaField };
