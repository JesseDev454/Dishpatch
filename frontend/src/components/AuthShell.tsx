import { Link } from "react-router-dom";

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
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-card lg:grid-cols-[1.05fr_0.95fr]">
        <aside className="hidden bg-gradient-to-br from-brand-100 via-cyan-50 to-white p-10 lg:flex lg:flex-col lg:justify-between">
          <div className="space-y-4">
            <span className="inline-flex rounded-full border border-brand-200 bg-white px-3 py-1 text-xs font-semibold text-brand-700">
              Restaurant operations
            </span>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Dishpatch</h1>
          </div>
          <div className="space-y-2 text-slate-700">
            <p className="text-lg font-semibold">Run your restaurant from one dashboard.</p>
            <p className="text-sm text-slate-600">
              Manage menus, track live orders, and handle payments with practical tools built for daily ops.
            </p>
          </div>
        </aside>
        <div className="space-y-4 p-6 sm:p-10">
          <p className="text-2xl font-extrabold tracking-tight text-slate-900">Dishpatch</p>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h2>
          <p className="text-sm text-slate-500">{subtitle}</p>
          {children}
          <p className="text-sm text-slate-500">
            {altText} <Link to={altLink}>{altLabel}</Link>
          </p>
        </div>
      </div>
    </div>
  );
};
