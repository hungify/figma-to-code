import { createFileRoute } from "@tanstack/react-router";

import { TabShowcase } from "#/components/tab-showcase";

export const Route = createFileRoute("/showcase/tab")({
  component: TabShowcase,
});
