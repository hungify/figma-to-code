import { Fragment } from "react";

import { TextField } from "./ui/input";

const states = [
  { label: "Default", props: {} },
  { label: "Hover", props: { forceState: "hover" as const } },
  { label: "Filled", props: { defaultValue: "Text" } },
  { label: "Focused", props: { defaultValue: "Text", forceState: "focus" as const } },
  { label: "Error", props: { defaultValue: "Text", "aria-invalid": true, hint: "Hint" } },
  { label: "Disable", props: { defaultValue: "Text", disabled: true } },
] as const;

export function InputShowcase() {
  return (
    <main className="min-h-screen bg-white px-8 py-10 text-grey-900">
      <section className="grid gap-5">
        <h2 className="text-xl font-bold">Text field</h2>
        <div
          className="grid w-[299px] grid-cols-[59px_239px] grid-rows-[25px_112px_112px_112px_112px_134px_112px]"
          data-node-id="46:3660"
          data-name="text-field"
        >
          <div />
          <div className="flex items-end justify-center pb-2.5 text-[12px] leading-none font-medium text-purple-500">
            Default
          </div>
          {states.map((state, index) => (
            <Fragment key={state.label}>
              <div className="flex items-center justify-end pr-2.5 text-[12px] leading-none font-medium text-purple-500">
                {state.label}
              </div>
              <div
                className={[
                  "border-x border-b border-dashed border-purple-400 px-6 py-7",
                  index === 0 ? "rounded-t-md border-t" : "",
                  index === states.length - 1 ? "rounded-b-md" : "",
                ].join(" ")}
              >
                <TextField label="Label" required {...state.props} />
                {index === 4 && <div className="h-[2px]" />}
              </div>
            </Fragment>
          ))}
        </div>
      </section>

      <section className="mt-10 grid gap-5">
        <h2 className="text-xl font-bold">Text field hint</h2>
        <div
          className="grid w-[231px] grid-rows-[134px_134px] rounded border border-dashed border-purple-500"
          data-node-id="43:1833"
          data-name="type-basic-field"
        >
          <div className="px-5 py-5">
            <TextField label="Label" required hint="Hint" hintPosition="bottom" />
          </div>
          <div className="px-5 py-5">
            <TextField label="Label" required hint="Hint" hintPosition="top" />
          </div>
        </div>
      </section>
    </main>
  );
}
