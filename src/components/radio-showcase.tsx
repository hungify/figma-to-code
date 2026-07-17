import { Fragment } from "react";
import { useState } from "react";

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
  const [value, setValue] = useState("office");

  return (
    <main className="min-h-screen bg-white px-8 py-10 text-grey-900">
      <div className="grid gap-12">
        <section className="grid gap-5">
          <h2 className="text-xl font-bold">Interactive</h2>
          <RadioGroup value={value} onValueChange={setValue} className="w-fit gap-4">
            {[
              { value: "office", label: "事業所" },
              { value: "company", label: "会社" },
              { value: "contract", label: "契約" },
            ].map((item) => (
              <label key={item.value} className="flex items-center gap-3 jp-body-lg text-grey-900">
                <RadioGroupItem value={item.value} />
                {item.label}
              </label>
            ))}
          </RadioGroup>
        </section>

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
      </div>
    </main>
  );
}
