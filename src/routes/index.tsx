import { createFileRoute } from "@tanstack/react-router";

import { Sidebar03 } from "#/components/sidebar-03";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  return <Sidebar03 />;
}
