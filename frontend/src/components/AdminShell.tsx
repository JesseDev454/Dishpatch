import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { AuthUser } from "../types";
import { Button } from "./ui/Button";
import { cn } from "../lib/cn";

type AdminShellProps = {
  user: AuthUser | null;
  onLogout: () => void;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
};

const navItems = [
  { to: "/dashboard", label: "Categories & Items" },
  { to: "/dashboard/orders", label: "Live Orders" }
];

export const AdminShell = ({ user, onLogout, title, subtitle, actions, children }: AdminShellProps) => {
  const location = useLocation();
  return (
    <div className="min-h-screen bg-slate-50 lg:grid lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="border-b border-slate-200 bg-white p-4 lg:min-h-screen lg:border-b-0 lg:border-r lg:p-6">
        <div>
          <p className="text-2xl font-extrabold tracking-tight text-slate-900">Dishpatch</p>
          <p className="mt-1 text-sm text-slate-500">{user?.restaurant.name}</p>
        </div>
        <nav className="mt-6 grid gap-2">
          {navItems.map((item) => {
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "focus-ring rounded-xl border px-3 py-2 text-sm font-semibold transition",
                  active
                    ? "border-brand-500 bg-brand-500 text-white"
                    : "border-transparent bg-slate-100 text-slate-700 hover:border-slate-200 hover:bg-slate-50"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-6 lg:mt-10">
          <Button variant="secondary" className="w-full" onClick={onLogout}>
            Logout
          </Button>
        </div>
      </aside>

      <main className="p-4 sm:p-6">
        <header className="card-base mb-6 flex flex-wrap items-start justify-between gap-4 p-5">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">{title}</h1>
            {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </header>
        {children}
      </main>
    </div>
  );
};
