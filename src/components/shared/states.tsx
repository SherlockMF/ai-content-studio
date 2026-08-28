import { AlertCircle, Inbox } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-lg border border-dashed p-8 text-center">
      <Inbox className="mx-auto mb-3 h-6 w-6 text-slate-400" />
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      <div className="flex items-center gap-2">
        <AlertCircle className="h-4 w-4" />
        {message}
      </div>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-10 w-1/3" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}
