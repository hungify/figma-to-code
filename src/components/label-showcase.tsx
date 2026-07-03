import { ControlLabel, Label } from "./ui/label";

export function LabelShowcase() {
  return (
    <main className="min-h-screen bg-white px-8 py-10 text-grey-900">
      <section className="grid gap-8">
        <div className="grid gap-5">
          <h2 className="text-xl font-bold">Form label</h2>
          <div
            className="relative h-[58px] w-[94px] rounded border border-dashed border-purple-500"
            data-name="Label"
          >
            <Label className="absolute top-[19px] left-[19px]">Label</Label>
          </div>
        </div>

        <div className="grid gap-5">
          <h2 className="text-xl font-bold">Control label</h2>
          <div
            className="relative h-[124px] w-[74px] rounded border border-dashed border-purple-500"
            data-node-id="46:4136"
            data-name="ControlLabel"
          >
            <ControlLabel className="absolute top-[19px] left-[19px]">Label</ControlLabel>
            <ControlLabel disabled className="absolute top-[84px] left-[19px]">
              Label
            </ControlLabel>
          </div>
        </div>
      </section>
    </main>
  );
}
