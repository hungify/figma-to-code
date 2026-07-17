import { Header } from "#/components/layout/header";

export function HeaderShowcase() {
  return (
    <main className="min-h-screen bg-grey-800 px-6 py-10 text-grey-900">
      <div className="grid gap-12">
        <section className="grid gap-8">
          <h2 className="jp-label-lg text-white">Header</h2>
          <div className="grid gap-8">
            <Header className="max-w-[1440px]" />
            <Header userEmail="example@example.com" className="max-w-[1440px]" />
            <Header userEmail="example@example.com" showMenuButton className="max-w-[1440px]" />
          </div>
        </section>
      </div>
    </main>
  );
}
