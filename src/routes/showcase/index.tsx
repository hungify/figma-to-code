import { createFileRoute } from "@tanstack/react-router";

import { BadgeShowcase } from "#/components/badge-showcase";
import { BreadcrumbShowcase } from "#/components/breadcrumb-showcase";
import { ButtonShowcase } from "#/components/button-showcase";
import { CheckboxShowcase } from "#/components/checkbox-showcase";
import { ChipShowcase } from "#/components/chip-showcase";
import { FileUploadShowcase } from "#/components/file-upload-showcase";
import { FooterShowcase } from "#/components/footer-showcase";
import { HeaderShowcase } from "#/components/header-showcase";
import { InputShowcase } from "#/components/input-showcase";
import { LabelShowcase } from "#/components/label-showcase";
import { PaginationShowcase } from "#/components/pagination-showcase";
import { RadioShowcase } from "#/components/radio-showcase";
import { SelectShowcase } from "#/components/select-showcase";
import { ServiceTagShowcase } from "#/components/service-tag-showcase";
import { SidebarShowcase } from "#/components/sidebar-showcase";
import { SonnerShowcase } from "#/components/sonner-showcase";
import { SwitchShowcase } from "#/components/switch-showcase";
import { TabShowcase } from "#/components/tab-showcase";
import { TextareaShowcase } from "#/components/textarea-showcase";
import { TooltipShowcase } from "#/components/tooltip-showcase";
import { TopMenuItemShowcase } from "#/components/top-menu-item-showcase";

const showcases = [
  { id: "header", label: "Header", component: HeaderShowcase },
  { id: "sidebar", label: "Sidebar", component: SidebarShowcase },
  { id: "footer", label: "Footer", component: FooterShowcase },
  { id: "top-menu-item", label: "Top Menu Item", component: TopMenuItemShowcase },
  { id: "button", label: "Button", component: ButtonShowcase },
  { id: "tooltip", label: "Tooltip", component: TooltipShowcase },
  { id: "sonner", label: "Sonner", component: SonnerShowcase },
  { id: "input", label: "Input", component: InputShowcase },
  { id: "textarea", label: "Textarea", component: TextareaShowcase },
  { id: "select", label: "Select", component: SelectShowcase },
  { id: "checkbox", label: "Checkbox", component: CheckboxShowcase },
  { id: "radio", label: "Radio", component: RadioShowcase },
  { id: "switch", label: "Switch", component: SwitchShowcase },
  { id: "label", label: "Label", component: LabelShowcase },
  { id: "badge", label: "Badge", component: BadgeShowcase },
  { id: "chip", label: "Chip", component: ChipShowcase },
  { id: "service-tag", label: "Service Tag", component: ServiceTagShowcase },
  { id: "tab", label: "Tab", component: TabShowcase },
  { id: "file-upload", label: "File Upload", component: FileUploadShowcase },
  { id: "pagination", label: "Pagination", component: PaginationShowcase },
  { id: "breadcrumb", label: "Breadcrumb", component: BreadcrumbShowcase },
] as const;

export const Route = createFileRoute("/showcase/")({
  component: ShowcaseIndex,
});

function ShowcaseIndex() {
  return (
    <main className="min-h-screen bg-white text-grey-900">
      <header className="sticky top-0 z-20 border-b border-grey-100 bg-white/95 px-8 py-4 backdrop-blur">
        <div className="flex flex-wrap items-center gap-3">
          {showcases.map((showcase) => (
            <a
              key={showcase.id}
              href={`#${showcase.id}`}
              className="rounded-md px-3 py-1.5 jp-label-md text-grey-600 hover:bg-grey-50 hover:text-grey-900 focus-visible:ring-3 focus-visible:ring-green-100 focus-visible:outline-none"
            >
              {showcase.label}
            </a>
          ))}
        </div>
      </header>

      <div className="divide-y divide-grey-100">
        {showcases.map((showcase) => {
          const Component = showcase.component;

          return (
            <section key={showcase.id} id={showcase.id} className="scroll-mt-24">
              <div className="border-b border-grey-100 bg-grey-50 px-8 py-3">
                <h2 className="jp-label-lg font-bold text-grey-900">{showcase.label}</h2>
              </div>
              <Component />
            </section>
          );
        })}
      </div>
    </main>
  );
}
