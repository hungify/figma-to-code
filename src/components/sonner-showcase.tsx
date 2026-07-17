import { toast } from "sonner";

import { Button } from "#/components/ui/button";

export function SonnerShowcase() {
  return (
    <main className="min-h-[240px] bg-white px-4 py-8 text-grey-900 sm:px-8 sm:py-10">
      <div className="grid max-w-xl gap-6">
        <section className="grid gap-4">
          <h2 className="jp-label-lg font-bold text-grey-900">Sonner</h2>
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="filled"
              color="green"
              onClick={() =>
                toast.success("Message", {
                  position: "top-center",
                })
              }
            >
              Save toast
            </Button>
            <Button
              type="button"
              variant="filled"
              color="red"
              onClick={() =>
                toast.error("Message", {
                  position: "top-center",
                })
              }
            >
              Delete toast
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
}
