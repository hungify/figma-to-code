import { Fragment } from "react";

import { RadioGroup, RadioGroupItem } from "./ui/radio-group";

type RadioState = {
  label: string;
  disabled?: boolean;
  invalid?: boolean;
  forceState?: "focus";
};

const states: readonly RadioState[] = [
  { label: "Default" },
  { label: "Focus", forceState: "focus" },
  { label: "Error", invalid: true },
  { label: "Error Focus", invalid: true, forceState: "focus" },
  { label: "Disabled", disabled: true },
] as const;

function RadioStateCell({
  checked,
  disabled,
  invalid,
  forceState,
}: {
  checked: boolean;
  disabled?: boolean;
  invalid?: boolean;
  forceState?: "focus";
}) {
  const value = checked ? "radio" : "empty";

  return (
    <RadioGroup value={value} className="w-auto place-items-center">
      <RadioGroupItem
        value="radio"
        disabled={disabled}
        aria-invalid={invalid || undefined}
        forceState={forceState}
      />
    </RadioGroup>
  );
}

export function RadioShowcase() {
  return (
    <main className="min-h-screen bg-white px-8 py-10 text-grey-900">
      <section className="grid gap-5">
        <h2 className="text-xl font-bold">Radio</h2>
        <div className="grid w-fit grid-cols-[102px_repeat(5,109px)] grid-rows-[25px_repeat(2,64px)] border border-dashed border-purple-500 text-sm">
          <div />
          {states.map((state) => (
            <div
              key={state.label}
              className="flex items-center justify-center border border-dashed border-purple-500 text-[11px] text-purple-500"
            >
              State: {state.label}
            </div>
          ))}

          {[false, true].map((checked) => (
            <Fragment key={String(checked)}>
              <div className="flex items-center justify-center border border-dashed border-purple-500 text-[11px] text-purple-500">
                Checked?: {checked ? "True" : "False"}
              </div>
              {states.map((state) => (
                <div
                  key={`${String(checked)}-${state.label}`}
                  className="flex items-center justify-center border border-dashed border-purple-500"
                >
                  <RadioStateCell
                    checked={checked}
                    disabled={state.disabled}
                    invalid={state.invalid}
                    forceState={state.forceState}
                  />
                </div>
              ))}
            </Fragment>
          ))}
        </div>
      </section>
    </main>
  );
}
