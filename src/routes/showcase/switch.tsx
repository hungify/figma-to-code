import { createFileRoute } from "@tanstack/react-router";

import { SwitchShowcase } from "#/components/switch-showcase";

export const Route = createFileRoute("/showcase/switch")({
  component: SwitchShowcase,
});
