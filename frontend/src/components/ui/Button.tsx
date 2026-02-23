import { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "border border-brand-500 bg-brand-500 text-white hover:border-brand-600 hover:bg-brand-600 focus-visible:ring-brand-300",
  secondary:
    "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-400 focus-visible:ring-slate-300",
  ghost:
    "border border-transparent bg-transparent text-slate-700 hover:border-slate-200 hover:bg-slate-100 focus-visible:ring-slate-300",
  danger:
    "border border-danger-500 bg-danger-500 text-white hover:border-danger-700 hover:bg-danger-700 focus-visible:ring-danger-100"
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-sm"
};

export const Button = ({
  className,
  children,
  disabled,
  loading = false,
  variant = "primary",
  size = "md",
  ...props
}: ButtonProps) => {
  return (
    <button
      className={cn(
        "focus-ring inline-flex items-center justify-center gap-2 rounded-xl font-semibold shadow-sm transition-all duration-200",
        "disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:shadow-sm",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : null}
      {children}
    </button>
  );
};
