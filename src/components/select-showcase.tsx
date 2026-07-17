import { Fragment } from "react";

import { cn } from "#/lib/utils";

import { Checkbox } from "./ui/checkbox";
import { SelectField } from "./ui/select";

const options = [
  { label: "Select me", value: "one" },
  { label: "Select me", value: "two" },
  { label: "Select me", value: "three" },
] as const;

const longTextOptions = [
  {
    label: "とても長い選択肢のテキストが入った場合の表示確認です",
    value: "long-jp",
  },
  {
    label: "Very long option text for checking overflow behavior inside select menus",
    value: "long-en",
  },
  { label: "Select me", value: "short" },
] as const;

const itemStates = ["default", "hover", "active", "disable", "focus"] as const;

function SelectItemPreview({
  checkbox,
  className,
  children = "Select me",
  state,
}: {
  checkbox?: boolean;
  children?: string;
  className?: string;
  state: (typeof itemStates)[number];
}) {
  const disabled = state === "disable";
  const active = state === "active";
  const focused = state === "focus";
  const hovered = state === "hover";

  return (
    <div
      data-slot="select-item-preview"
      data-state={state}
      className={cn(
        "flex h-12 w-[302px] items-center gap-4 rounded-md px-4 py-3 jp-body-lg text-grey-900",
        hovered && "bg-grey-50",
        active && "bg-green-50",
        focused && "border-2 border-green-200 bg-green-50",
        disabled && "text-grey-300",
        className,
      )}
    >
      {checkbox && <Checkbox className="pointer-events-none" disabled={disabled} />}
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </div>
  );
}

export function SelectShowcase() {
  return (
    <main className="min-h-screen bg-white px-8 py-10 text-grey-900">
      <section className="grid gap-8">
        <div className="grid gap-5">
          <h2 className="text-xl font-bold">Select field</h2>
          <div
            className="grid w-[433px] grid-cols-[59px_374px] grid-rows-[284px_256px]"
            data-node-id="120:1495"
            data-name="select-menu"
          >
            <div className="flex items-center justify-end pr-2.5 text-[12px] leading-none font-medium text-purple-500">
              Default
            </div>
            <div className="px-6 py-6">
              <SelectField label="Label" required options={options} defaultOpen />
            </div>
            <div className="flex items-center justify-end pr-2.5 text-[12px] leading-none font-medium text-purple-500">
              Variant2
            </div>
            <div className="px-6 py-6">
              <SelectField options={options} placeholder="Select an item" defaultOpen />
            </div>
          </div>
        </div>

        <div className="grid gap-5">
          <h2 className="text-xl font-bold">Select custom</h2>
          <div className="w-[326px]">
            <SelectField label="Label" required options={options} checkboxItems defaultOpen />
          </div>
        </div>

        <div className="grid gap-5">
          <h2 className="text-xl font-bold">Long text</h2>
          <div className="grid w-fit grid-cols-2 gap-8">
            <div className="w-[326px]">
              <SelectField
                label="Label"
                required
                options={longTextOptions}
                defaultValue="long-jp"
                defaultOpen
              />
            </div>
            <div className="w-[326px]">
              <SelectField
                label="Label"
                required
                options={longTextOptions}
                checkboxItems
                defaultValue="long-en"
                defaultOpen
              />
            </div>
          </div>
          <div className="grid w-fit grid-cols-[351px_351px] gap-8">
            <SelectItemPreview state="default">
              とても長い選択肢のテキストが入った場合の表示確認です
            </SelectItemPreview>
            <SelectItemPreview checkbox state="default">
              Very long option text for checking overflow behavior inside menu item
            </SelectItemPreview>
          </div>
        </div>

        <div className="grid gap-5">
          <h2 className="text-xl font-bold">Menu item</h2>
          <div className="grid w-fit grid-cols-[52px_351px_351px] grid-rows-[25px_repeat(5,96px)]">
            <div />
            <div className="flex items-start justify-center text-[12px] leading-none font-medium text-purple-500">
              Checkbox=False
            </div>
            <div className="flex items-start justify-center text-[12px] leading-none font-medium text-purple-500">
              Checkbox=True
            </div>
            {itemStates.map((state) => (
              <Fragment key={state}>
                <div className="flex items-center justify-end pr-2.5 text-[12px] leading-none font-medium text-purple-500">
                  {state}
                </div>
                <div className="flex items-center px-6">
                  <SelectItemPreview state={state} />
                </div>
                <div className="flex items-center px-6">
                  <SelectItemPreview checkbox state={state} />
                </div>
              </Fragment>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
