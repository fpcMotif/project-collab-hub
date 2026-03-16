import { type ChangeEvent } from "react";

export type BoardFilterState = {
  ownerId: string;
  departmentId: string;
  priority: string;
  approvalStatus: string;
  overdueOnly: boolean;
};

export function BoardFilters({
  value,
  onChange,
  ownerOptions,
  departmentOptions,
}: {
  value: BoardFilterState;
  onChange: (next: BoardFilterState) => void;
  ownerOptions: string[];
  departmentOptions: string[];
}) {
  const handleTextFilter =
    (key: "ownerId" | "departmentId" | "priority" | "approvalStatus") =>
    (event: ChangeEvent<HTMLSelectElement>) => {
      onChange({ ...value, [key]: event.target.value });
    };

  return (
    <div className="grid gap-3 rounded-xl border border-zinc-200 bg-white p-4 md:grid-cols-5">
      <select className="rounded-md border p-2" value={value.ownerId} onChange={handleTextFilter("ownerId")}>
        <option value="">负责人（全部）</option>
        {ownerOptions.map((owner) => (
          <option key={owner} value={owner}>
            {owner}
          </option>
        ))}
      </select>
      <select
        className="rounded-md border p-2"
        value={value.departmentId}
        onChange={handleTextFilter("departmentId")}
      >
        <option value="">部门（全部）</option>
        {departmentOptions.map((department) => (
          <option key={department} value={department}>
            {department}
          </option>
        ))}
      </select>
      <select className="rounded-md border p-2" value={value.priority} onChange={handleTextFilter("priority")}>
        <option value="">优先级（全部）</option>
        <option value="low">low</option>
        <option value="medium">medium</option>
        <option value="high">high</option>
        <option value="urgent">urgent</option>
      </select>
      <select
        className="rounded-md border p-2"
        value={value.approvalStatus}
        onChange={handleTextFilter("approvalStatus")}
      >
        <option value="">审批状态（全部）</option>
        <option value="pending">待审批</option>
        <option value="approved">通过</option>
        <option value="rejected">驳回</option>
      </select>
      <label className="flex items-center gap-2 rounded-md border px-3 text-sm">
        <input
          type="checkbox"
          checked={value.overdueOnly}
          onChange={(event) => onChange({ ...value, overdueOnly: event.target.checked })}
        />
        仅看逾期
      </label>
    </div>
  );
}
