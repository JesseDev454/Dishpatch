import { InputHTMLAttributes, ReactNode, forwardRef } from "react";
import { cn } from "../../lib/cn";

type InputFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  label?: string;
  helperText?: string;
  error?: string | null;
  rightSlot?: ReactNode;
};

export const InputField = forwardRef<HTMLInputElement, InputFieldProps>(
  ({ className, label, helperText, error, id, rightSlot, ...props }, ref) => {
    const inputId = id ?? props.name;
    return (
      <label className="block space-y-1.5">
        {label ? <span className="text-sm font-medium text-slate-700">{label}</span> : null}
        <span className="relative block">
          <input
            id={inputId}
            ref={ref}
            className={cn("input-base focus-ring", error ? "border-danger-300 focus:ring-danger-100" : "", className)}
            {...props}
          />
          {rightSlot ? <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center">{rightSlot}</span> : null}
        </span>
        {error ? <span className="text-xs font-medium text-danger-700">{error}</span> : null}
        {!error && helperText ? <span className="text-xs text-slate-500">{helperText}</span> : null}
      </label>
    );
  }
);

InputField.displayName = "InputField";
