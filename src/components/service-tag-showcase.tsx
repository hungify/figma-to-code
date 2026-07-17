import {
  ServiceTag,
  type ServiceTagAppearance,
  type ServiceTagType,
} from "#/components/ui/service-tag";

const rows = [
  { serviceType: "i", top: 20 },
  { serviceType: "a", top: 57 },
  { serviceType: "b", top: 94 },
] satisfies Array<{ serviceType: ServiceTagType; top: number }>;

const cells = [
  { appearance: "fill", length: "long", left: 20 },
  { appearance: "fill", length: "short", left: 143.333 },
  { appearance: "outline", length: "long", left: 266.667 },
  { appearance: "outline", length: "short", left: 390 },
] satisfies Array<{
  appearance: ServiceTagAppearance;
  length: "long" | "short";
  left: number;
}>;

export function ServiceTagShowcase() {
  return (
    <main className="min-h-screen bg-white px-8 py-10 text-grey-900">
      <section className="relative h-[141px] w-[523.333px]" data-node-id="120:7475">
        {rows.map((row) =>
          cells.map((cell) => (
            <ServiceTag
              key={`${row.serviceType}-${cell.appearance}-${cell.length}`}
              appearance={cell.appearance}
              length={cell.length}
              serviceType={row.serviceType}
              className={cell.length === "short" ? "absolute w-[72px]" : "absolute w-[112px]"}
              style={{ left: cell.left, top: row.top }}
            />
          )),
        )}
      </section>
    </main>
  );
}
