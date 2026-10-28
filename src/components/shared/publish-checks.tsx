import { cn } from "@/lib/utils";

export type PublishCheckItem = {
  id: string;
  label: string;
  ok: boolean;
  hint?: string;
};

export function PublishChecks({ checks }: { checks: PublishCheckItem[] }) {
  return (
    <ul className="grid gap-1.5 sm:grid-cols-2">
      {checks.map((check) => (
        <li
          key={check.id}
          className={cn(
            "flex items-start gap-2 rounded-md border px-2.5 py-1.5 text-xs",
            check.ok
              ? "border-emerald-200 bg-white text-slate-700"
              : "border-amber-200 bg-amber-50 text-amber-900"
          )}
        >
          <span aria-hidden>{check.ok ? "✅" : "⚠️"}</span>
          <span>
            {check.label}
            {check.hint ? (
              <span className="mt-0.5 block text-[11px] opacity-80">{check.hint}</span>
            ) : null}
          </span>
        </li>
      ))}
    </ul>
  );
}
