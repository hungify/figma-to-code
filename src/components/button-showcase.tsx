import { ArrowRightIcon, ChevronRightIcon, PlusIcon, Trash2Icon, UserIcon } from "lucide-react";
import { Fragment } from "react";

import { Button } from "./ui/button";

const sizeExamples = [
  { label: "Small", size: "sm", width: "w-[138px]" },
  { label: "Regular", size: "md", width: "w-[146px]" },
  { label: "Large", size: "lg", width: "w-[160px]" },
  { label: "XLarge", size: "xl", width: "w-[176px]" },
] as const;

const iconSizeExamples = [
  { label: "Small", size: "icon-sm", icon: PlusIcon, variant: "ghost", color: "grey" },
  { label: "Regular", size: "icon", icon: Trash2Icon, variant: "filled", color: "red" },
  { label: "Large", size: "icon-lg", icon: ArrowRightIcon, variant: "outline", color: "green" },
  { label: "XLarge", size: "icon-xl", icon: ChevronRightIcon, variant: "filled", color: "yellow" },
] as const;

const filledColors = [
  { label: "Green", color: "green" },
  { label: "Red", color: "red" },
  { label: "Yellow", color: "yellow" },
] as const;

// Shared across filled + outline sections. Button already knows how to render
// each state via `forceState` / `disabled`, showcase just declares intent.
const states = [
  { label: "Default" },
  { label: "Hover", forceState: "hover" },
  { label: "Active", forceState: "active" },
  { label: "Focused", forceState: "focus" },
  { label: "Disable", disabled: true },
] as const;

function SizeButton({
  size,
  width,
}: {
  size: (typeof sizeExamples)[number]["size"];
  width: string;
}) {
  return (
    <Button size={size} color="green" className={width}>
      <UserIcon />
      Button
      <ChevronRightIcon />
    </Button>
  );
}

export function ButtonShowcase() {
  return (
    <main className="min-h-screen bg-white px-8 py-10 text-grey-900">
      <div className="grid max-w-5xl gap-12">
        <section className="grid gap-5">
          <h2 className="text-xl font-bold">Button size</h2>
          <div className="flex flex-wrap items-end gap-6">
            {sizeExamples.map((item) => (
              <div key={item.size} className="grid gap-2">
                <span className="text-sm font-medium text-grey-600">{item.label}</span>
                <SizeButton size={item.size} width={item.width} />
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-5">
          <h2 className="text-xl font-bold">Icon only</h2>
          <div className="flex flex-wrap items-end gap-6">
            {iconSizeExamples.map((item) => {
              const Icon = item.icon;

              return (
                <div key={item.size} className="grid justify-items-center gap-2">
                  <span className="text-sm font-medium text-grey-600">{item.label}</span>
                  <Button size={item.size} variant={item.variant} color={item.color}>
                    <Icon />
                  </Button>
                </div>
              );
            })}
          </div>
        </section>

        <section className="grid gap-5">
          <h2 className="text-xl font-bold">Filled</h2>
          <div className="grid w-fit grid-cols-[72px_repeat(3,121px)] gap-x-8 gap-y-6">
            <div />
            {filledColors.map((item) => (
              <span key={item.color} className="text-center text-sm font-bold text-grey-600">
                {item.label}
              </span>
            ))}

            {states.map((state) => (
              <Fragment key={state.label}>
                <span className="flex h-12 items-center text-sm font-bold text-grey-600">
                  {state.label}
                </span>
                {filledColors.map((item) => (
                  <Button
                    key={`${state.label}-${item.color}`}
                    size="lg"
                    variant="filled"
                    color={item.color}
                    forceState={"forceState" in state ? state.forceState : undefined}
                    disabled={"disabled" in state ? state.disabled : undefined}
                    className="w-[121px]"
                  >
                    Button
                  </Button>
                ))}
              </Fragment>
            ))}
          </div>
        </section>

        <section className="grid gap-5">
          <h2 className="text-xl font-bold">Outlined</h2>
          <div className="grid w-fit grid-cols-[72px_121px] gap-x-8 gap-y-6">
            <div />
            <span className="text-center text-sm font-bold text-grey-600">Green</span>

            {states.map((state) => (
              <Fragment key={state.label}>
                <span className="flex h-12 items-center text-sm font-bold text-grey-600">
                  {state.label}
                </span>
                <Button
                  key={`${state.label}-outline-green`}
                  size="lg"
                  variant="outline"
                  color="green"
                  forceState={"forceState" in state ? state.forceState : undefined}
                  disabled={"disabled" in state ? state.disabled : undefined}
                  className="w-[121px]"
                >
                  Button
                </Button>
              </Fragment>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
