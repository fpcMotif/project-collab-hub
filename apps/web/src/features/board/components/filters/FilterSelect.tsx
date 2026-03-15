import { cn } from "@/lib/cn";

interface FilterOption {
  value: string;
  label: string;
}

interface FilterSelectProps {
  label: string;
  value: string | null;
  options: FilterOption[];
  onChange: (value: string | null) => void;
}

export function FilterSelect({ label, value, options, onChange }: FilterSelectProps) {
  return (
    <div className="flex items-center gap-1.5">
      <label className="text-xs font-medium text-gray-500">{label}</label>
      <select
        className={cn(
          "rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700",
          "focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400",
          value && "border-blue-400 bg-blue-50 font-medium text-blue-700",
        )}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
      >
        <option value="">全部</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
