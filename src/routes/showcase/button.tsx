import { createFileRoute } from "@tanstack/react-router";

import { ButtonShowcase } from "#/components/button-showcase";

export const Route = createFileRoute("/showcase/button")({
  component: ButtonShowcase,
});
