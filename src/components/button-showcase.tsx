import { ChevronRightIcon, UserIcon } from "lucide-react";
import { Fragment, type ReactNode } from "react";

import { Button } from "./ui/button";

const sizeExamples = [
  { label: "Small", size: "sm" },
  { label: "Regular", size: "md" },
  { label: "Large", size: "lg" },
  { label: "XLarge", size: "xl" },
] as const;

/** Figma btn Color columns: Green → Lime → Blue → Red → Danger → Yellow → Grey */
const buttonColors = [
  { label: "Green", color: "green" },
  { label: "Lime", color: "lime" },
  { label: "Blue", color: "blue" },
  { label: "Red", color: "red" },
  { label: "Danger", color: "danger" },
  { label: "Yellow", color: "yellow" },
  { label: "Grey", color: "grey" },
] as const;

const states = [
  { label: "Default" },
  { label: "Hover", forceState: "hover" as const },
  { label: "Active", forceState: "active" as const },
  { label: "Focused", forceState: "focus" as const },
  { label: "Disable", disabled: true as const },
] as const;

const styleExamples = [
  { label: "Default", variant: "filled" as const },
  { label: "Outlined", variant: "outline" as const },
] as const;

function LabeledButton({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="grid justify-items-start gap-2">
      <span className="text-sm font-medium text-grey-600">{label}</span>
      {children}
    </div>
  );
}

function IconLabelButton({
  size,
  variant,
}: {
  size: (typeof sizeExamples)[number]["size"];
  variant: "filled" | "outline";
}) {
  return (
    <Button size={size} variant={variant} color="green">
      <UserIcon />
      Button
      <ChevronRightIcon />
    </Button>
  );
}

function ColorStateMatrix({ variant }: { variant: "filled" | "outline" }) {
  return (
    <div className="grid w-fit grid-cols-[72px_repeat(7,minmax(80px,1fr))] items-center gap-x-4 gap-y-6">
      <div />
      {buttonColors.map((item) => (
        <span key={item.color} className="text-center text-sm font-bold text-grey-600">
          {item.label}
        </span>
      ))}

      {states.map((state) => (
        <Fragment key={`${variant}-${state.label}`}>
          <span className="flex h-12 items-center text-sm font-bold text-grey-600">
            {state.label}
          </span>
          {buttonColors.map((item) => (
            <div key={`${variant}-${state.label}-${item.color}`} className="flex justify-center">
              <Button
                size="lg"
                variant={variant}
                color={item.color}
                forceState={"forceState" in state ? state.forceState : undefined}
                disabled={"disabled" in state ? state.disabled : undefined}
                className="w-20"
              >
                Button
              </Button>
            </div>
          ))}
        </Fragment>
      ))}
    </div>
  );
}

export function ButtonShowcase() {
  return (
    <main className="min-h-screen bg-white px-8 py-10 text-grey-900">
      <div className="flex flex-wrap items-start gap-12">
        <div className="grid gap-10">
          <section className="grid gap-5 rounded-lg border border-dashed border-grey-300 p-5">
            <h2 className="text-xl font-bold">Size</h2>
            <div className="grid gap-6">
              {sizeExamples.map((item) => (
                <LabeledButton key={item.size} label={item.label}>
                  <IconLabelButton size={item.size} variant="filled" />
                </LabeledButton>
              ))}
            </div>
          </section>

          <section className="grid gap-5 rounded-lg border border-dashed border-grey-300 p-5">
            <h2 className="text-xl font-bold">Style</h2>
            <div className="grid gap-6">
              {styleExamples.map((item) => (
                <LabeledButton key={item.variant} label={item.label}>
                  <IconLabelButton size="lg" variant={item.variant} />
                </LabeledButton>
              ))}
            </div>
          </section>
        </div>

        <div className="grid gap-12">
          <section className="grid gap-5">
            <h2 className="text-xl font-bold">Filled</h2>
            <ColorStateMatrix variant="filled" />
          </section>

          <section className="grid gap-5">
            <h2 className="text-xl font-bold">Outlined</h2>
            <ColorStateMatrix variant="outline" />
          </section>
        </div>
      </div>
    </main>
  );
}
