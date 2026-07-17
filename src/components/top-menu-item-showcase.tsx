import { TopMenuItem, type TopMenuItemVariant } from "#/components/ui/top-menu-item";

const variants = [
  "transition",
  "continuationA",
  "continuationB",
  "users",
  "contract",
  "company",
] as const satisfies readonly TopMenuItemVariant[];

export function TopMenuItemShowcase() {
  return (
    <main className="min-h-screen bg-white px-5 py-5 text-grey-900">
      <div className="grid w-fit gap-6">
        {variants.map((variant) => (
          <TopMenuItem key={variant} variant={variant} />
        ))}
      </div>
    </main>
  );
}
