import { Fragment, useState } from "react";

import { Checkbox } from "./ui/checkbox";

type CheckboxState = {
  label: string;
  disabled?: boolean;
  invalid?: boolean;
  forceState?: "focus";
};

const states: readonly CheckboxState[] = [
  { label: "Default" },
  { label: "Focus", forceState: "focus" },
  { label: "Error", invalid: true },
  { label: "Error Focus", invalid: true, forceState: "focus" },
  { label: "Disabled", disabled: true },
] as const;

const checkedStates = ["False", "True", "Indeterminate"] as const;

function CheckboxStateCell({
  checkedState,
  disabled,
  invalid,
  forceState,
}: {
  checkedState: (typeof checkedStates)[number];
  disabled?: boolean;
  invalid?: boolean;
  forceState?: "focus";
}) {
  const checked = checkedState === "True";
  const indeterminate = checkedState === "Indeterminate";

  if (indeterminate && invalid) {
    return null;
  }

  return (
    <Checkbox
      checked={checked}
      disabled={disabled}
      indeterminate={indeterminate}
      aria-invalid={invalid || undefined}
      forceState={forceState}
    />
  );
}

export function CheckboxShowcase() {
  const [checked, setChecked] = useState(false);
  const [indeterminate, setIndeterminate] = useState(true);
  const [invalid, setInvalid] = useState(false);

  return (
    <main className="min-h-screen bg-white px-8 py-10 text-grey-900">
      <section className="grid gap-8">
        <h2 className="text-xl font-bold">Checkbox</h2>
        <div
          className="relative h-[217px] w-[691px] text-sm"
          data-node-id="46:4599"
          data-name="Checkbox"
        >
          {states.map((state) => (
            <div
              key={state.label}
              className="absolute top-0 flex h-[25px] w-[109px] items-center justify-center text-[11px] leading-none text-purple-500"
              style={{ left: 146 + states.indexOf(state) * 109 }}
            >
              State: {state.label}
            </div>
          ))}

          {checkedStates.map((checkedState) => (
            <div
              key={checkedState}
              className="absolute left-0 flex h-[64px] w-[146px] items-center justify-center text-[11px] leading-none text-purple-500"
              style={{ top: 25 + checkedStates.indexOf(checkedState) * 64 }}
            >
              Checked?: {checkedState}
            </div>
          ))}

          <div className="absolute top-[25px] left-[146px] h-[192px] w-[545px] border border-dashed border-purple-500">
            {[1, 2, 3, 4].map((index) => (
              <div
                key={`column-line-${index}`}
                className="absolute top-0 h-full border-l border-dashed border-purple-500"
                style={{ left: index * 109 - 1 }}
              />
            ))}
            {[1, 2].map((index) => (
              <div
                key={`row-line-${index}`}
                className="absolute left-0 w-full border-t border-dashed border-purple-500"
                style={{ top: index * 64 - 1 }}
              />
            ))}
            {checkedStates.map((checkedState, rowIndex) => (
              <Fragment key={checkedState}>
                {states.map((state, columnIndex) => (
                  <div
                    key={`${checkedState}-${state.label}`}
                    className="absolute flex h-[64px] w-[109px] items-center justify-center"
                    style={{ left: columnIndex * 109, top: rowIndex * 64 }}
                  >
                    <CheckboxStateCell
                      checkedState={checkedState}
                      disabled={state.disabled}
                      invalid={state.invalid}
                      forceState={state.forceState}
                    />
                  </div>
                ))}
              </Fragment>
            ))}
          </div>
        </div>

        <div className="grid w-fit gap-4">
          <h3 className="jp-label-lg font-bold">Interactive</h3>
          <div className="flex items-center gap-3">
            <Checkbox
              checked={checked}
              indeterminate={indeterminate}
              aria-invalid={invalid || undefined}
              onCheckedChange={(nextChecked) => {
                setChecked(nextChecked);
                setIndeterminate(false);
              }}
            />
            <button
              type="button"
              className="jp-body-lg text-grey-900"
              onClick={() => {
                setChecked((current) => !current);
                setIndeterminate(false);
              }}
            >
              Receive updates
            </button>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              className="rounded-md border border-grey-100 px-3 py-2 jp-label-lg font-bold text-grey-900"
              onClick={() => setIndeterminate((current) => !current)}
            >
              Toggle indeterminate
            </button>
            <button
              type="button"
              className="rounded-md border border-grey-100 px-3 py-2 jp-label-lg font-bold text-grey-900"
              onClick={() => setInvalid((current) => !current)}
            >
              Toggle error
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
