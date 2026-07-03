import { createFileRoute } from "@tanstack/react-router";

import { RadioShowcase } from "#/components/radio-showcase";

export const Route = createFileRoute("/showcase/radio")({
  component: RadioShowcase,
});
