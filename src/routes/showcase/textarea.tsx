import { createFileRoute } from "@tanstack/react-router";

import { TextareaShowcase } from "#/components/textarea-showcase";

export const Route = createFileRoute("/showcase/textarea")({
  component: TextareaShowcase,
});
