import { createFileRoute } from "@tanstack/react-router";

import { CheckboxShowcase } from "#/components/checkbox-showcase";

export const Route = createFileRoute("/showcase/checkbox")({
  component: CheckboxShowcase,
});
