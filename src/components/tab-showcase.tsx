import { SquareIcon } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

const defaultItems = [
  "Item 1",
  "Item 2",
  "Item 3",
  "Item 4",
  "Item 5",
  "Item 6",
  "Item 7",
] as const;
const fixedItems = ["Item 1", "Item 2", "Item 3"] as const;

export function TabShowcase() {
  return (
    <main className="min-h-screen bg-white px-8 py-10 text-grey-900">
      <div className="grid max-w-4xl gap-14">
        <section className="grid gap-5">
          <h2 className="jp-h5">p-tab states</h2>
          <div className="flex flex-wrap items-end gap-10">
            <div className="grid gap-2">
              <span className="jp-label-sm text-grey-600">Inactive</span>
              <Tabs value="__none">
                <TabsList>
                  <TabsTrigger value="item">Item</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <div className="grid gap-2">
              <span className="jp-label-sm text-grey-600">Active</span>
              <Tabs defaultValue="item">
                <TabsList>
                  <TabsTrigger value="item">Item</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <div className="grid gap-2">
              <span className="jp-label-sm text-grey-600">Inactive + icon</span>
              <Tabs value="__none">
                <TabsList>
                  <TabsTrigger value="item">
                    <SquareIcon />
                    Item
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <div className="grid gap-2">
              <span className="jp-label-sm text-grey-600">Active + icon</span>
              <Tabs defaultValue="item">
                <TabsList>
                  <TabsTrigger value="item">
                    <SquareIcon />
                    Item
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
        </section>

        <section className="grid gap-5">
          <h2 className="jp-h5">Default · Pagination False</h2>
          <Tabs defaultValue="1">
            <TabsList variant="default">
              {defaultItems.map((label, i) => (
                <TabsTrigger key={label} value={String(i + 1)}>
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
            <TabsContent value="1" className="jp-body-md text-grey-600">
              Panel Item 1
            </TabsContent>
          </Tabs>
        </section>

        <section className="grid gap-5">
          <h2 className="jp-h5">Default · Pagination True</h2>
          <Tabs defaultValue="1" className="w-full max-w-[420px]">
            <TabsList variant="default" pagination>
              {defaultItems.map((label, i) => (
                <TabsTrigger key={label} value={String(i + 1)}>
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </section>

        <section className="grid gap-5">
          <h2 className="jp-h5">Fixed · Pagination False</h2>
          <Tabs defaultValue="1" className="w-full max-w-[636px]">
            <TabsList variant="fixed">
              {fixedItems.map((label, i) => (
                <TabsTrigger key={label} value={String(i + 1)}>
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </section>

        <section className="grid gap-5">
          <h2 className="jp-h5">Fixed · Pagination True</h2>
          <Tabs defaultValue="1" className="w-full max-w-[636px]">
            <TabsList variant="fixed" pagination>
              {fixedItems.map((label, i) => (
                <TabsTrigger key={label} value={String(i + 1)}>
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </section>
      </div>
    </main>
  );
}
