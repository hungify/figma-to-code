import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationNext,
  PaginationPage,
  PaginationPrevious,
} from "#/components/ui/pagination";

type PageItem = number | "ellipsis";

const examples = [
  {
    label: "First page",
    pages: [1, 2, 3, 4, "ellipsis", 10],
    activePage: 1,
    previousDisabled: false,
    nextDisabled: false,
    nextVariant: "icon",
  },
  {
    label: "Last page",
    pages: [1, 2, 3, "ellipsis", 9, 10],
    activePage: 10,
    previousDisabled: false,
    nextDisabled: false,
    nextVariant: "icon",
  },
  {
    label: "No ellipsis",
    pages: [1, 2, 3],
    activePage: 1,
    previousDisabled: false,
    nextDisabled: false,
    nextVariant: "text",
  },
  {
    label: "Two pages",
    pages: [1, 2],
    activePage: 1,
    previousDisabled: false,
    nextDisabled: false,
    nextVariant: "icon",
  },
  {
    label: "Truncated end",
    pages: [1, 2, 3, "ellipsis"],
    activePage: 1,
    previousDisabled: false,
    nextDisabled: false,
    nextVariant: "icon",
  },
  {
    label: "Single page",
    pages: [1],
    activePage: 1,
    previousDisabled: true,
    nextDisabled: true,
    nextVariant: "icon",
  },
] satisfies Array<{
  label: string;
  pages: PageItem[];
  activePage: number;
  previousDisabled: boolean;
  nextDisabled: boolean;
  nextVariant: "icon" | "text";
}>;

export function PaginationShowcase() {
  return (
    <main className="min-h-screen bg-white px-8 py-10 text-grey-900">
      <div className="grid w-fit gap-6">
        <section className="grid grid-cols-[88px_1fr] items-start gap-x-6 gap-y-12">
          <span className="flex h-9 items-center text-sm font-medium text-grey-600">
            Active: On
          </span>
          <PaginationPage active className="justify-self-start">
            1
          </PaginationPage>

          <span className="flex h-9 items-center text-sm font-medium text-grey-600">
            Active: Off
          </span>
          <PaginationPage className="justify-self-start">1</PaginationPage>
        </section>

        <section className="grid grid-cols-2 gap-x-12 gap-y-5">
          <PaginationPrevious variant="text" />
          <PaginationPrevious variant="text" disabled />
          <PaginationNext variant="text" />
          <PaginationNext variant="text" disabled />
          <PaginationPrevious />
          <PaginationPrevious disabled />
          <PaginationNext />
          <PaginationNext disabled />
        </section>

        <section className="grid gap-6">
          {examples.map((example) => (
            <Pagination key={example.label} className="justify-start">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious disabled={example.previousDisabled} />
                </PaginationItem>
                {example.pages.map((page, index) => (
                  <PaginationItem key={`${example.label}-${page}-${index}`}>
                    {page === "ellipsis" ? (
                      <PaginationEllipsis />
                    ) : (
                      <PaginationPage active={page === example.activePage}>{page}</PaginationPage>
                    )}
                  </PaginationItem>
                ))}
                <PaginationItem>
                  <PaginationNext variant={example.nextVariant} disabled={example.nextDisabled} />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          ))}
        </section>
      </div>
    </main>
  );
}
