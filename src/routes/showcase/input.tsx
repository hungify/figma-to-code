import { createFileRoute } from "@tanstack/react-router";

import { InputShowcase } from "#/components/input-showcase";

export const Route = createFileRoute("/showcase/input")({
  component: InputShowcase,
});
