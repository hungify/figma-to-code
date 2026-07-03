import { createFileRoute } from "@tanstack/react-router";

import { LabelShowcase } from "#/components/label-showcase";

export const Route = createFileRoute("/showcase/label")({
  component: LabelShowcase,
});
