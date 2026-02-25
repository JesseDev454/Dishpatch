import { ReactNode, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { BarChart3, LayoutDashboard, LogOut, Menu, UtensilsCrossed } from "lucide-react";
import { AuthUser } from "../types";
import { Button } from "./ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "./ui/DropdownMenu";
import { Separator } from "./ui/Separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "./ui/Sheet";
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
  { to: "/dashboard", label: "Categories & Items", icon: LayoutDashboard },
  { to: "/dashboard/orders", label: "Live Orders", icon: UtensilsCrossed },
  { to: "/dashboard/analytics", label: "Analytics", icon: BarChart3 }
];

const SidebarNav = ({ onNavigate }: { onNavigate?: () => void }) => {
  const location = useLocation();
  return (
    <nav className="grid gap-1">
      {navItems.map((item) => {
        const active = location.pathname === item.to;
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={cn(
              "focus-ring flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200",
              active
                ? "bg-primary text-primary-foreground shadow-[0_8px_24px_rgba(59,146,52,0.24)]"
                : "text-muted-foreground hover:bg-accent/15 hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
};

export const AdminShell = ({ user, onLogout, title, subtitle, actions, children }: AdminShellProps) => {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <div className="grid min-h-screen lg:grid-cols-[264px_minmax(0,1fr)]">
        <aside className="hidden border-r border-border/70 bg-card/80 px-4 py-6 backdrop-blur lg:block">
          <div className="mb-6 px-2">
            <p className="text-xl font-bold tracking-tight text-foreground">Dishpatch</p>
            <p className="mt-1 text-xs text-muted-foreground">{user?.restaurant.name}</p>
          </div>
          <SidebarNav />
          <div className="mt-6 px-2">
            <Separator className="mb-4" />
            <Button variant="secondary" className="w-full justify-start" onClick={onLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-col">
          <header className="sticky top-0 z-30 border-b border-border/70 bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
            <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
              <div className="flex items-center gap-2">
                <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
                  <SheetTrigger asChild>
                    <Button variant="secondary" size="sm" className="lg:hidden">
                      <Menu className="h-4 w-4" />
                      Menu
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-[84%] max-w-sm p-4">
                    <SheetHeader className="mb-4">
                      <SheetTitle>Dishpatch</SheetTitle>
                    </SheetHeader>
                    <p className="mb-4 text-xs text-muted-foreground">{user?.restaurant.name}</p>
                    <SidebarNav onNavigate={() => setMobileNavOpen(false)} />
                    <div className="mt-6">
                      <Separator className="mb-4" />
                      <Button
                        variant="secondary"
                        className="w-full justify-start"
                        onClick={() => {
                          setMobileNavOpen(false);
                          onLogout();
                        }}
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        Logout
                      </Button>
                    </div>
                  </SheetContent>
                </Sheet>
                <div>
                  <h1 className="text-lg font-semibold tracking-tight text-foreground">{title}</h1>
                  {subtitle ? <p className="text-xs text-muted-foreground sm:text-sm">{subtitle}</p> : null}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {actions ? <div className="hidden items-center gap-2 sm:flex">{actions}</div> : null}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="secondary" size="sm">
                      {user?.email?.split("@")[0] ?? "Account"}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>{user?.restaurant.name ?? "Dishpatch"}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={onLogout}>
                      <LogOut className="mr-2 h-4 w-4" />
                      Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            {actions ? <div className="flex flex-wrap items-center gap-2 px-4 pb-3 sm:hidden">{actions}</div> : null}
          </header>

          <main className="flex-1 p-4 sm:p-6">{children}</main>
        </div>
      </div>
    </div>
  );
};
