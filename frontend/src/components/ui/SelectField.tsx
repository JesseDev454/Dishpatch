import { ReactNode, SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { Label } from "./Label";

type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  helperText?: string;
  error?: string | null;
  children: ReactNode;
};

export const SelectField = ({ className, label, helperText, error, children, id, ...props }: SelectFieldProps) => {
  const selectId = id ?? props.name;
  return (
    <div className="grid gap-1.5">
      {label ? <Label htmlFor={selectId}>{label}</Label> : null}
      <select
        id={selectId}
        className={cn(
          "focus-ring flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background transition placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
          error ? "border-destructive focus-visible:ring-destructive/25" : "",
          className
        )}
        {...props}
      >
        {children}
      </select>
      {error ? <span className="text-xs font-medium text-destructive">{error}</span> : null}
      {!error && helperText ? <span className="text-xs text-muted-foreground">{helperText}</span> : null}
    </div>
  );
};

