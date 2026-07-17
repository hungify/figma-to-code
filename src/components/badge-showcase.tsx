import { Badge } from "./ui/badge";

/** Figma Status rows: Inprogress → success → disable → danger → error → waiting */
const statuses = ["inprogress", "success", "disable", "danger", "error", "waiting"] as const;

const types = [
  { label: "bold", type: "bold" as const },
  { label: "regular", type: "regular" as const },
] as const;

export function BadgeShowcase() {
  return (
    <main className="min-h-screen bg-white px-8 py-10 text-grey-900">
      <div className="grid w-fit gap-14">
        {[
          { label: "Show icon: False", showIcon: false },
          { label: "Show icon: True", showIcon: true },
        ].map((section) => (
          <section key={section.label} className="grid gap-5">
            <h2 className="text-xl font-bold">{section.label}</h2>
            <div className="grid w-fit grid-cols-[88px_88px_88px] items-center gap-x-8 gap-y-6">
              <div />
              {types.map((item) => (
                <span key={item.type} className="text-center text-sm font-bold text-grey-600">
                  {item.label}
                </span>
              ))}

              {statuses.map((status) => (
                <div key={`${section.label}-${status}`} className="contents">
                  <span className="text-sm font-bold text-grey-600">{status}</span>
                  {types.map((item) => (
                    <Badge
                      key={`${section.label}-${status}-${item.type}`}
                      showIcon={section.showIcon}
                      status={status}
                      type={item.type}
                    />
                  ))}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
