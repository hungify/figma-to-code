import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { Footer } from "#/components/layout/footer";
import { Header } from "#/components/layout/header";
import { authQueryOptions } from "#/lib/auth/queries";

export const Route = createFileRoute("/_guest")({
  component: RouteComponent,
  beforeLoad: async ({ context }) => {
    const REDIRECT_URL = "/app";

    const user = await context.queryClient.ensureQueryData({
      ...authQueryOptions(),
      revalidateIfStale: true,
    });
    if (user) {
      throw redirect({
        to: REDIRECT_URL,
      });
    }

    return {
      redirectUrl: REDIRECT_URL,
    };
  },
});

/** Shared chrome for guest (unauthenticated) screens — login, signup, etc. */
function RouteComponent() {
  return (
    <div className="flex min-h-svh flex-col">
      <Header />
      <main className="container-page flex flex-1 flex-col items-center justify-center px-5 py-9 md:px-0">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
