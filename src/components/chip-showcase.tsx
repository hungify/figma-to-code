import { Chip, ChipIcon } from "#/components/ui/chip";

export function ChipShowcase() {
  return (
    <main className="min-h-screen bg-white px-8 py-10 text-grey-900">
      <section className="grid w-fit justify-items-start gap-6">
        <Chip />
        <Chip prepend={<ChipIcon />}>Click me</Chip>
        <Chip append={<ChipIcon />}>Click me</Chip>
        <Chip append={<ChipIcon />} prepend={<ChipIcon />}>
          Click me
        </Chip>
        <Chip>Long chip text scales</Chip>
      </section>
    </main>
  );
}
