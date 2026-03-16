import { cn } from "@/lib/cn";

interface CardMetaRowProps {
  pendingApprovalCount: number;
  overdueTaskCount: number;
}

export function CardMetaRow({
  pendingApprovalCount,
  overdueTaskCount,
}: CardMetaRowProps) {
  if (pendingApprovalCount === 0 && overdueTaskCount === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-3 text-xs">
      {pendingApprovalCount > 0 && (
        <span className={cn("flex items-center gap-1 text-amber-600")}>
          <svg
            className="h-3.5 w-3.5"
            viewBox="0 0 16 16"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm-.75 3.25a.75.75 0 011.5 0v3.5a.75.75 0 01-1.5 0v-3.5zM8 11a1 1 0 100-2 1 1 0 000 2z" />
          </svg>
          {pendingApprovalCount} 待审批
        </span>
      )}
      {overdueTaskCount > 0 && (
        <span className={cn("flex items-center gap-1 text-red-600")}>
          <svg
            className="h-3.5 w-3.5"
            viewBox="0 0 16 16"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm-.75 4.75a.75.75 0 011.5 0v2.5a.75.75 0 01-1.5 0v-2.5zM8 11a1 1 0 100-2 1 1 0 000 2z" />
          </svg>
          {overdueTaskCount} 逾期
        </span>
      )}
    </div>
  );
}
