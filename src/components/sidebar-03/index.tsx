import { ArrowUpRightIcon, MenuIcon, MoreHorizontalIcon, TrendingUpIcon } from "lucide-react";
import { type CSSProperties, useState } from "react";

import { Sidebar, SidebarDrawer } from "#/components/layout/sidebar";
import { Button } from "#/components/ui/button";
import { SidebarInset, SidebarProvider } from "#/components/ui/sidebar";

const metrics = [
  { label: "Gross volume", value: "$48,240", change: "+12.5%" },
  { label: "Net revenue", value: "$31,860", change: "+8.2%" },
  { label: "Active customers", value: "2,420", change: "+4.1%" },
] as const;

const orders = [
  { id: "#1048", customer: "Olivia Martin", status: "Paid", total: "$1,999.00" },
  { id: "#1047", customer: "Jackson Lee", status: "Pending", total: "$849.00" },
  { id: "#1046", customer: "Sophia Brown", status: "Paid", total: "$2,400.00" },
  { id: "#1045", customer: "Noah Williams", status: "Refunded", total: "$390.00" },
] as const;

const chartBars = [44, 58, 48, 70, 64, 86, 74, 92, 78, 96, 88, 100] as const;

export function Sidebar03() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <SidebarProvider
      open={sidebarOpen}
      onOpenChange={setSidebarOpen}
      className="min-h-dvh bg-grey-50"
      style={
        {
          "--sidebar-width": "250px",
          "--sidebar-width-icon": "3rem",
        } as CSSProperties
      }
    >
      <div className="relative flex min-h-dvh w-full">
        <Sidebar />

        <SidebarInset
          id="dashboard"
          className="min-w-0 overflow-hidden bg-background md:my-4 md:mr-4 md:rounded-2xl md:shadow-sm"
        >
          <header className="sticky top-0 z-10 flex h-16 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur md:px-8">
            <button
              type="button"
              aria-label="メニューを開く"
              className="flex size-8 shrink-0 items-center justify-center rounded-lg text-grey-500 focus-visible:ring-3 focus-visible:ring-green-100 focus-visible:outline-none md:hidden"
              onClick={() => setDrawerOpen(true)}
            >
              <MenuIcon className="size-5" aria-hidden="true" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="en-body-xs text-muted-foreground">Overview</p>
              <h1 className="truncate en-h5 text-foreground">Commerce dashboard</h1>
            </div>
            <Button variant="outline" color="grey" size="sm">
              Export report
            </Button>
          </header>

          <div className="flex flex-1 flex-col gap-6 p-4 md:p-8">
            <section className="grid gap-4 md:grid-cols-3">
              {metrics.map((metric) => (
                <article
                  key={metric.label}
                  className="rounded-2xl border border-border bg-card p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <p className="en-body-sm text-muted-foreground">{metric.label}</p>
                    <span className="flex items-center gap-1 rounded-full bg-green-50 px-2 py-1 en-label-xs text-green-600">
                      <TrendingUpIcon className="size-3" aria-hidden="true" />
                      {metric.change}
                    </span>
                  </div>
                  <p className="mt-5 en-h3 text-card-foreground">{metric.value}</p>
                </article>
              ))}
            </section>

            <section className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.8fr)]">
              <article
                id="revenue"
                className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
              >
                <div className="flex items-center justify-between border-b border-border px-5 py-4">
                  <div>
                    <h2 className="en-label-lg text-card-foreground">Revenue</h2>
                    <p className="mt-1 en-body-xs text-muted-foreground">Last 12 months</p>
                  </div>
                  <Button aria-label="Revenue options" variant="ghost" color="grey" size="icon-sm">
                    <MoreHorizontalIcon aria-hidden="true" />
                  </Button>
                </div>
                <div className="flex h-72 items-end gap-2 px-5 pt-8 pb-5 md:gap-3">
                  {chartBars.map((height, index) => (
                    <div
                      key={`${height}-${index}`}
                      className="group relative flex h-full flex-1 items-end"
                    >
                      <div
                        className="w-full rounded-t-md bg-green-100 transition-colors group-hover:bg-green-500"
                        style={{ height: `${height}%` }}
                      />
                    </div>
                  ))}
                </div>
              </article>

              <article className="rounded-2xl bg-grey-900 p-6 text-white shadow-sm">
                <p className="en-body-sm text-grey-300">Available balance</p>
                <p className="mt-3 en-h2">$18,640.20</p>
                <div className="mt-8 border-t border-grey-700 pt-5">
                  <div className="flex items-center justify-between en-body-sm text-grey-300">
                    <span>Next payout</span>
                    <span>Friday</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between en-label-lg">
                    <span>$8,920.00</span>
                    <ArrowUpRightIcon className="size-5" aria-hidden="true" />
                  </div>
                </div>
                <Button className="mt-8 w-full" variant="filled" color="lime">
                  Manage payouts
                </Button>
              </article>
            </section>

            <section
              id="orders"
              className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
            >
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <div>
                  <h2 className="en-label-lg text-card-foreground">Recent orders</h2>
                  <p className="mt-1 en-body-xs text-muted-foreground">
                    Latest transactions across storefronts
                  </p>
                </div>
                <Button variant="link" color="green" size="sm">
                  View all
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-160 text-left">
                  <thead className="bg-muted/60 en-label-xs text-muted-foreground">
                    <tr>
                      <th className="px-5 py-3 font-medium">Order</th>
                      <th className="px-5 py-3 font-medium">Customer</th>
                      <th className="px-5 py-3 font-medium">Status</th>
                      <th className="px-5 py-3 text-right font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {orders.map((order) => (
                      <tr key={order.id} className="en-body-sm text-card-foreground">
                        <td className="px-5 py-4 en-label-sm">{order.id}</td>
                        <td className="px-5 py-4">{order.customer}</td>
                        <td className="px-5 py-4">
                          <span className="rounded-full bg-grey-50 px-2.5 py-1 en-label-xs text-grey-600">
                            {order.status}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right en-label-sm">{order.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </SidebarInset>

        <SidebarDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      </div>
    </SidebarProvider>
  );
}
