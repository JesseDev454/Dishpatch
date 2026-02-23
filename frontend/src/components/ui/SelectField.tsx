import { ReactNode, SelectHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  helperText?: string;
  error?: string | null;
  children: ReactNode;
};

export const SelectField = ({ className, label, helperText, error, children, id, ...props }: SelectFieldProps) => {
  const selectId = id ?? props.name;
  return (
    <label className="block space-y-1.5">
      {label ? <span className="text-sm font-medium text-slate-700">{label}</span> : null}
      <select
        id={selectId}
        className={cn("input-base focus-ring", error ? "border-danger-300 focus:ring-danger-100" : "", className)}
        {...props}
      >
        {children}
      </select>
      {error ? <span className="text-xs font-medium text-danger-700">{error}</span> : null}
      {!error && helperText ? <span className="text-xs text-slate-500">{helperText}</span> : null}
    </label>
  );
};
