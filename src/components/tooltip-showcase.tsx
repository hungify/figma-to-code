import { Button } from "#/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "#/components/ui/tooltip";

const sides = ["top", "bottom", "left", "right"] as const;

export function TooltipShowcase() {
  return (
    <main className="min-h-[420px] bg-white px-8 py-10 text-grey-900">
      <TooltipProvider>
        <section className="grid gap-8">
          <h2 className="text-xl font-bold">Tooltip</h2>
          <div className="grid w-fit grid-cols-2 gap-10 sm:grid-cols-4">
            {sides.map((side) => (
              <Tooltip key={side}>
                <TooltipTrigger
                  render={
                    <Button variant="outline" color="grey">
                      {side}
                    </Button>
                  }
                />
                <TooltipContent side={side}>Tooltip text</TooltipContent>
              </Tooltip>
            ))}
          </div>
        </section>
      </TooltipProvider>
    </main>
  );
}
