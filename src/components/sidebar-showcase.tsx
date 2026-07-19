import { useState } from "react";

import { Sidebar, SidebarDrawer, SidebarItem } from "#/components/layout/sidebar";
import { SidebarProvider } from "#/components/ui/sidebar";

export function SidebarShowcase() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <main className="min-h-screen bg-grey-800 px-5 py-5 text-grey-900">
      <div className="grid gap-10">
        <section className="grid gap-4">
          <h2 className="jp-label-lg text-white">Sidebar Item</h2>
          <div className="grid w-fit grid-cols-2 gap-x-5 gap-y-4 bg-white p-5">
            <SidebarItem label="Item menu" />
            <SidebarItem label="Item menu" variant="icon" />
            <SidebarItem label="Item menu" className="bg-grey-50" />
            <SidebarItem label="Item menu" variant="icon" className="bg-grey-50" />
            <SidebarItem label="Item menu" state="active" />
            <SidebarItem label="Item menu" state="active" variant="icon" />
          </div>
        </section>

        <section className="grid gap-4">
          <h2 className="jp-label-lg text-white">Sidebar</h2>
          <SidebarProvider
            className="min-h-160 overflow-hidden rounded-2xl bg-grey-50"
            style={
              {
                "--sidebar-width": "250px",
                "--sidebar-width-icon": "3rem",
              } as React.CSSProperties
            }
          >
            <div className="relative flex min-h-160 w-full">
              <Sidebar />
            </div>
          </SidebarProvider>
        </section>

        <section className="grid gap-4">
          <h2 className="jp-label-lg text-white">Drawer</h2>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="w-fit rounded-lg bg-white px-4 py-2 jp-label-md text-grey-900"
          >
            Open drawer
          </button>
          <SidebarDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
        </section>
      </div>
    </main>
  );
}
