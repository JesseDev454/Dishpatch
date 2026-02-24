import { InputHTMLAttributes, ReactNode, forwardRef } from "react";
import { cn } from "@/lib/utils";
import { Input } from "./Input";
import { Label } from "./Label";

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
      <div className="grid gap-1.5">
        {label ? <Label htmlFor={inputId}>{label}</Label> : null}
        <span className="relative block">
          <Input
            id={inputId}
            ref={ref}
            className={cn(error ? "border-destructive focus-visible:ring-destructive/25" : "", className)}
            {...props}
          />
          {rightSlot ? <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center">{rightSlot}</span> : null}
        </span>
        {error ? <span className="text-xs font-medium text-destructive">{error}</span> : null}
        {!error && helperText ? <span className="text-xs text-muted-foreground">{helperText}</span> : null}
      </div>
    );
  }
);

InputField.displayName = "InputField";

