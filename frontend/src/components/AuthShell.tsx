import { Link } from "react-router-dom";
import { Separator } from "./ui/Separator";

type AuthShellProps = {
  title: string;
  subtitle: string;
  altText: string;
  altLink: string;
  altLabel: string;
  children: React.ReactNode;
};

export const AuthShell = ({ title, subtitle, altText, altLink, altLabel, children }: AuthShellProps) => {
  return (
    <div className="grid min-h-screen place-items-center bg-background px-4 py-10">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-2xl border bg-card shadow-card lg:grid-cols-[1.05fr_0.95fr]">
        <aside className="hidden bg-gradient-to-br from-brand-500/20 via-background to-accentBlue-500/20 p-10 lg:flex lg:flex-col lg:justify-between">
          <div className="space-y-4">
            <span className="inline-flex rounded-full border border-primary/40 bg-primary/15 px-3 py-1 text-xs font-semibold text-brand-100">
              Restaurant operations
            </span>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Dishpatch</h1>
          </div>
          <div className="space-y-2">
            <p className="text-lg font-semibold text-foreground">Run your restaurant from one dashboard.</p>
            <p className="text-sm text-muted-foreground">
              Manage menus, track live orders, and handle payments with practical tools built for daily ops.
            </p>
          </div>
        </aside>
        <div className="space-y-5 p-6 sm:p-10">
          <div className="space-y-1">
            <p className="text-2xl font-extrabold tracking-tight text-foreground">Dishpatch</p>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h2>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
          <Separator />
          {children}
          <p className="text-sm text-muted-foreground">
            {altText}{" "}
            <Link to={altLink} className="font-semibold text-accent hover:underline">
              {altLabel}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
