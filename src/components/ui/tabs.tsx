import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { cva, type VariantProps } from "class-variance-authority";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ComponentProps } from "react";

import { cn } from "#/lib/utils";

function Tabs({ className, orientation = "horizontal", ...props }: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn("group/tabs flex flex-col gap-4", className)}
      {...props}
    />
  );
}

const tabsListVariants = cva("group/tabs-list relative inline-flex items-stretch", {
  variants: {
    variant: {
      // Figma Type=Default — hug content
      default: "w-fit",
      // Figma Type=Fixed — equal-width tabs fill container
      fixed: "w-full",
    },
    pagination: {
      true: "",
      false: "",
    },
  },
  compoundVariants: [
    {
      variant: "default",
      pagination: false,
      className: "border-b border-grey-100",
    },
  ],
  defaultVariants: {
    variant: "default",
    pagination: false,
  },
});

type TabsListProps = TabsPrimitive.List.Props &
  VariantProps<typeof tabsListVariants> & {
    /** Figma Pagination=True — chevrons scroll the overflow tab strip */
    pagination?: boolean;
  };

function TabsList({
  className,
  variant = "default",
  pagination = false,
  children,
  ...props
}: TabsListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  const syncScrollState = useCallback(() => {
    const list = listRef.current;
    if (!list) return;

    const maxScroll = list.scrollWidth - list.clientWidth;
    setCanScrollPrev(list.scrollLeft > 1);
    setCanScrollNext(list.scrollLeft < maxScroll - 1);
  }, []);

  useEffect(() => {
    if (!pagination) return;

    const list = listRef.current;
    if (!list) return;

    syncScrollState();
    list.addEventListener("scroll", syncScrollState, { passive: true });

    const resizeObserver = new ResizeObserver(syncScrollState);
    resizeObserver.observe(list);

    return () => {
      list.removeEventListener("scroll", syncScrollState);
      resizeObserver.disconnect();
    };
  }, [pagination, syncScrollState, children]);

  function scrollByDir(dir: -1 | 1) {
    const list = listRef.current;
    if (!list) return;

    // Prefer one tab width; fallback ~160px
    const active =
      list.querySelector<HTMLElement>('[data-slot="tabs-trigger"][data-active]') ??
      list.querySelector<HTMLElement>('[data-slot="tabs-trigger"]');
    const step = active?.offsetWidth || 160;

    list.scrollBy({ left: dir * step, behavior: "smooth" });
  }

  const list = (
    <TabsPrimitive.List
      ref={listRef}
      data-slot="tabs-list"
      data-variant={variant}
      data-pagination={pagination ? "" : undefined}
      className={cn(
        tabsListVariants({ variant, pagination }),
        pagination && "min-w-0 flex-1 scrollbar-none overflow-x-auto",
        className,
      )}
      {...props}
    >
      {children}
    </TabsPrimitive.List>
  );

  if (!pagination) {
    return list;
  }

  return (
    <div data-slot="tabs-list-wrap" className="flex w-full min-w-0 items-center">
      <TabsScrollButton
        direction="prev"
        disabled={!canScrollPrev}
        onClick={() => scrollByDir(-1)}
      />
      {list}
      <TabsScrollButton direction="next" disabled={!canScrollNext} onClick={() => scrollByDir(1)} />
    </div>
  );
}

type TabsTriggerProps = TabsPrimitive.Tab.Props & {
  /** Showcase / visual gate — force active styles without selection */
  forceState?: "active";
};

function TabsTrigger({ className, forceState, ...props }: TabsTriggerProps) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      data-force-state={forceState}
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center gap-2 px-4 py-2.5 text-(length:--text-body-md-size) leading-(--text-body-md-leading) font-normal text-grey-500 transition-colors outline-none",
        "hover:text-green-500 focus-visible:text-green-500 focus-visible:ring-3 focus-visible:ring-green-100",
        "disabled:pointer-events-none disabled:opacity-50",
        "data-[force-state=active]:leading-(--text-label-md-leading) data-[force-state=active]:font-medium data-[force-state=active]:text-green-500 data-active:leading-(--text-label-md-leading) data-active:font-medium data-active:text-green-500",
        "after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-green-500 after:opacity-0 after:transition-opacity",
        "data-[force-state=active]:after:opacity-100 data-active:after:opacity-100",
        "group-data-[variant=fixed]/tabs-list:flex-1",
        "min-h-9 has-[svg]:min-h-12 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-6",
        className,
      )}
      {...props}
    />
  );
}

type TabsScrollButtonProps = ComponentProps<"button"> & {
  direction: "prev" | "next";
};

/** Figma p-tab Type=< / > — scroll controls for TabsList pagination */
function TabsScrollButton({ direction, className, ...props }: TabsScrollButtonProps) {
  const Icon = direction === "prev" ? ChevronLeftIcon : ChevronRightIcon;

  return (
    <button
      type="button"
      data-slot="tabs-scroll-button"
      data-direction={direction}
      aria-label={direction === "prev" ? "Scroll tabs left" : "Scroll tabs right"}
      className={cn(
        "inline-flex h-12 w-[52px] shrink-0 items-center justify-center px-4 text-grey-800 outline-none",
        "hover:text-green-500 focus-visible:ring-3 focus-visible:ring-green-100",
        "disabled:pointer-events-none disabled:opacity-40",
        className,
      )}
      {...props}
    >
      <Icon className="size-6" aria-hidden="true" />
    </button>
  );
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent, TabsScrollButton, tabsListVariants };
export type { TabsListProps, TabsTriggerProps, TabsScrollButtonProps };
