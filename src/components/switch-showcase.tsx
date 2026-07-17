import { Fragment } from "react";
import { useState } from "react";

import { Switch } from "./ui/switch";

type SwitchState = {
  label: string;
  disabled?: boolean;
  forceState?: "focus";
};

const states: readonly SwitchState[] = [
  { label: "Default" },
  { label: "Focus", forceState: "focus" },
  { label: "Disabled", disabled: true },
] as const;

const checkedStates = [false, true] as const;

function SwitchStateCell({
  checked,
  disabled,
  forceState,
}: {
  checked: boolean;
  disabled?: boolean;
  forceState?: "focus";
}) {
  return <Switch checked={checked} disabled={disabled} forceState={forceState} />;
}

export function SwitchShowcase() {
  const [enabled, setEnabled] = useState(false);

  return (
    <main className="min-h-screen bg-white px-8 py-10 text-grey-900">
      <div className="grid gap-12">
        <section className="grid gap-5">
          <h2 className="text-xl font-bold">Interactive</h2>
          <label className="flex w-fit items-center gap-3 jp-body-lg text-grey-900">
            <Switch checked={enabled} onCheckedChange={setEnabled} />
            {enabled ? "公開中" : "非公開"}
          </label>
        </section>

        <section className="grid gap-5">
          <h2 className="text-xl font-bold">Switch</h2>
          <div
            className="relative h-[157px] w-[345px] text-sm"
            data-node-id="46:4671"
            data-name="Switch"
          >
            {states.map((state, columnIndex) => (
              <div
                key={state.label}
                className="absolute top-0 flex h-[25px] w-[81px] items-center justify-center text-[11px] leading-none text-purple-500"
                style={{ left: 102 + columnIndex * 81 }}
              >
                State: {state.label}
              </div>
            ))}

            {checkedStates.map((checked, rowIndex) => (
              <div
                key={String(checked)}
                className="absolute left-0 flex h-[66px] w-[102px] items-center justify-center text-[11px] leading-none text-purple-500"
                style={{ top: 25 + rowIndex * 66 }}
              >
                Checked?: {checked ? "True" : "False"}
              </div>
            ))}

            <div className="absolute top-[25px] left-[102px] h-[132px] w-[243px] border border-dashed border-purple-500">
              {[1, 2].map((index) => (
                <div
                  key={`column-line-${index}`}
                  className="absolute top-0 h-full border-l border-dashed border-purple-500"
                  style={{ left: index * 81 - 1 }}
                />
              ))}
              <div className="absolute top-[65px] left-0 w-full border-t border-dashed border-purple-500" />

              {checkedStates.map((checked, rowIndex) => (
                <Fragment key={String(checked)}>
                  {states.map((state, columnIndex) => (
                    <div
                      key={`${String(checked)}-${state.label}`}
                      className="absolute flex h-[66px] w-[81px] items-center justify-center"
                      style={{ left: columnIndex * 81, top: rowIndex * 66 }}
                    >
                      <SwitchStateCell
                        checked={checked}
                        disabled={state.disabled}
                        forceState={state.forceState}
                      />
                    </div>
                  ))}
                </Fragment>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
