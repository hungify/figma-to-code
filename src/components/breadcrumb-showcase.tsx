import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "#/components/ui/breadcrumb";

const breadcrumbCounts = [2, 3, 4, 5, 6] as const;

function BreadcrumbExample({ count }: { count: (typeof breadcrumbCounts)[number] }) {
  const levels = Array.from({ length: count }, (_, index) => index + 1);

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {levels.map((level, index) => {
          const current = index === levels.length - 1;

          return (
            <BreadcrumbItem key={level}>
              {current ? (
                <BreadcrumbPage>{`Level ${level}`}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink href="#">{`Level ${level}`}</BreadcrumbLink>
              )}
              {!current ? <BreadcrumbSeparator /> : null}
            </BreadcrumbItem>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

export function BreadcrumbShowcase() {
  return (
    <main className="min-h-screen bg-white px-8 py-10 text-grey-900">
      <div className="relative h-[569px] w-[919px]">
        <section className="absolute top-14 left-[43px] grid grid-cols-[54px_64px_64px] grid-rows-[25px_repeat(3,68px)] items-center gap-x-6">
          <div />
          <span className="self-start text-center text-[11px] leading-none text-purple-500">
            Label
          </span>
          <span className="self-start text-center text-[11px] leading-none text-purple-500">
            Icon
          </span>

          <span className="text-center text-[11px] leading-none text-purple-500">Default</span>
          <BreadcrumbLink href="#" dropdown>
            Label
          </BreadcrumbLink>
          <BreadcrumbEllipsis />

          <span className="text-center text-[11px] leading-none text-purple-500">Hover</span>
          <BreadcrumbLink href="#" dropdown forceState="hover">
            Label
          </BreadcrumbLink>
          <BreadcrumbEllipsis className="text-green-500" />

          <span className="text-center text-[11px] leading-none text-purple-500">Active</span>
          <BreadcrumbPage dropdown>Label</BreadcrumbPage>
          <div />
        </section>

        <section className="absolute top-14 left-[319px] grid h-[340px] w-[489px] grid-cols-[58px_431px] grid-rows-[repeat(5,68px)] items-center">
          {breadcrumbCounts.map((count, index) => (
            <div key={count} className="contents">
              <span className="flex h-[68px] items-center text-[11px] leading-none text-purple-500">
                Items: {count}
              </span>
              <div
                className={
                  index === breadcrumbCounts.length - 1
                    ? "flex h-[68px] items-center justify-center"
                    : "flex h-[68px] items-center justify-center border-b border-dashed border-purple-500"
                }
              >
                <BreadcrumbExample count={count} />
              </div>
            </div>
          ))}
        </section>

        <section className="absolute top-[346px] left-[50px] grid h-[124px] w-[119px] grid-cols-[57px_62px] grid-rows-[62px_62px] items-center">
          <span className="text-center text-[11px] leading-none text-purple-500">Default</span>
          <BreadcrumbSeparator variant="dropdown" />

          <span className="text-center text-[11px] leading-none text-purple-500">Custom</span>
          <BreadcrumbSeparator variant="slash" />
        </section>
      </div>
    </main>
  );
}
