import { Fragment } from "react";

import { TextareaField } from "./ui/textarea";

const states = [
  { label: "Default", props: {} },
  { label: "Hover", props: { forceState: "hover" as const } },
  { label: "Focused", props: { defaultValue: "Fill data", forceState: "focus" as const } },
  { label: "Error", props: { defaultValue: "Fill data", "aria-invalid": true, hint: "Hint" } },
  { label: "Disable", props: { defaultValue: "Fill data", disabled: true } },
] as const;

export function TextareaShowcase() {
  return (
    <main className="min-h-screen bg-white px-8 py-10 text-grey-900">
      <section className="grid gap-5">
        <h2 className="text-xl font-bold">Text area field</h2>
        <div
          className="grid w-[389px] grid-cols-[59px_329px] grid-rows-[25px_248px_248px_248px_248px_248px]"
          data-node-id="46:4006"
          data-name="text-areas"
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
                  "border-x border-b border-dashed border-purple-400 px-7 py-7",
                  index === 0 ? "rounded-t-md border-t" : "",
                  index === states.length - 1 ? "rounded-b-md" : "",
                ].join(" ")}
              >
                <TextareaField label="Label" required {...state.props} />
              </div>
            </Fragment>
          ))}
        </div>
      </section>
    </main>
  );
}
