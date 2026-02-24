import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AdminShell } from "../components/AdminShell";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { Skeleton } from "../components/ui/Skeleton";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { getApiErrorMessage, getApiStatus } from "../lib/errors";
import { setAccessToken, api } from "../lib/api";
import { getOverview, getTimeseries, getTopItems } from "../lib/analytics";
import {
  AnalyticsOverviewResponse,
  AnalyticsRange,
  AnalyticsTimeseriesPoint,
  AnalyticsTopItem
} from "../types";

const currencyFormatter = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const formatNgn = (value: string | number): string => {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return currencyFormatter.format(0);
  }
  return currencyFormatter.format(numeric);
};

const formatChartDate = (value: string): string =>
  new Date(`${value}T00:00:00.000Z`).toLocaleDateString("en-NG", { month: "short", day: "numeric" });

type RevenueLineChartProps = {
  points: AnalyticsTimeseriesPoint[];
};

const RevenueLineChart = ({ points }: RevenueLineChartProps) => {
  const values = points.map((point) => Number(point.revenue));
  const maxValue = Math.max(0, ...values);
  const step = points.length > 1 ? 100 / (points.length - 1) : 100;
  const labelStep = points.length > 7 ? Math.ceil(points.length / 7) : 1;

  const linePoints = points
    .map((point, index) => {
      const value = Number(point.revenue);
      const ratio = maxValue > 0 ? value / maxValue : 0;
      const x = index * step;
      const y = 60 - ratio * 54;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div>
      <div className="h-52 rounded-2xl border border-slate-100 bg-slate-50/70 p-3">
        {points.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">No data</div>
        ) : (
          <svg viewBox="0 0 100 60" preserveAspectRatio="none" className="h-full w-full">
            <polyline points="0,60 100,60" fill="none" stroke="#e2e8f0" strokeWidth="0.8" />
            <polyline points="0,45 100,45" fill="none" stroke="#f1f5f9" strokeWidth="0.7" />
            <polyline points="0,30 100,30" fill="none" stroke="#f1f5f9" strokeWidth="0.7" />
            <polyline points="0,15 100,15" fill="none" stroke="#f1f5f9" strokeWidth="0.7" />
            <polyline
              points={`${linePoints} 100,60 0,60`}
              fill="rgba(14, 165, 233, 0.14)"
              stroke="none"
            />
            <polyline points={linePoints} fill="none" stroke="#0ea5e9" strokeWidth="1.6" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2 text-xs text-slate-500 sm:grid-cols-7">
        {points.map((point, index) => {
          const showLabel = index % labelStep === 0 || index === points.length - 1;
          return (
            <div key={point.date} className="truncate text-center">
              {showLabel ? formatChartDate(point.date) : ""}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const KpiCard = ({ label, value }: { label: string; value: string | number }) => (
  <Card>
    <p className="text-sm font-medium text-slate-500">{label}</p>
    <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
  </Card>
);

const AnalyticsSkeleton = () => (
  <div className="space-y-4">
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <Card key={index}>
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-3 h-8 w-32" />
        </Card>
      ))}
    </div>
    <div className="grid gap-4 xl:grid-cols-3">
      <Card className="xl:col-span-2">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="mt-4 h-56 w-full" />
      </Card>
      <Card>
        <Skeleton className="h-5 w-24" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      </Card>
    </div>
  </div>
);

export const DashboardAnalyticsPage = () => {
  const { user, logout } = useAuth();
  const { showToast } = useToast();

  const [range, setRange] = useState<AnalyticsRange>("7d");
  const [overview, setOverview] = useState<AnalyticsOverviewResponse | null>(null);
  const [timeseries, setTimeseries] = useState<AnalyticsTimeseriesPoint[]>([]);
  const [topItems, setTopItems] = useState<AnalyticsTopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [overviewResponse, timeseriesResponse, topItemsResponse] = await Promise.all([
        getOverview(range),
        getTimeseries(range),
        getTopItems(range, 5)
      ]);

      setOverview(overviewResponse);
      setTimeseries(timeseriesResponse.series);
      setTopItems(topItemsResponse.items);
    } catch (error: unknown) {
      if (getApiStatus(error) === 401) {
        try {
          const refreshResponse = await api.post<{ accessToken: string }>("/auth/refresh");
          setAccessToken(refreshResponse.data.accessToken);
          const [overviewResponse, timeseriesResponse, topItemsResponse] = await Promise.all([
            getOverview(range),
            getTimeseries(range),
            getTopItems(range, 5)
          ]);
          setOverview(overviewResponse);
          setTimeseries(timeseriesResponse.series);
          setTopItems(topItemsResponse.items);
          return;
        } catch {
          await logout();
          return;
        }
      }

      const message = getApiErrorMessage(error, "Could not load analytics. Retry.");
      setError(message);
      showToast(message, "error");
    } finally {
      setLoading(false);
    }
  }, [logout, range, showToast]);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  const periodLabel = range === "30d" ? "Last 30 Days" : "Last 7 Days";
  const hasPaidOrders = (overview?.kpis.paidOrders ?? 0) > 0;

  const noRevenueData = useMemo(() => {
    if (!overview) {
      return false;
    }

    return Number(overview.kpis.totalRevenue) <= 0;
  }, [overview]);

  return (
    <AdminShell
      user={user}
      onLogout={() => {
        void logout();
      }}
      title="Analytics"
      subtitle="Track orders, revenue, and top-performing menu items."
      actions={
        <div className="inline-flex items-center gap-2">
          <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
            <Button
              type="button"
              variant={range === "7d" ? "primary" : "ghost"}
              size="sm"
              onClick={() => setRange("7d")}
            >
              7 Days
            </Button>
            <Button
              type="button"
              variant={range === "30d" ? "primary" : "ghost"}
              size="sm"
              onClick={() => setRange("30d")}
            >
              30 Days
            </Button>
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={() => void loadAnalytics()}>
            Refresh
          </Button>
        </div>
      }
    >
      {loading ? <AnalyticsSkeleton /> : null}

      {!loading && error ? (
        <Card>
          <p className="text-sm font-medium text-danger-700">{error}</p>
          <div className="mt-3">
            <Button type="button" onClick={() => void loadAnalytics()}>
              Retry
            </Button>
          </div>
        </Card>
      ) : null}

      {!loading && !error && overview ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <KpiCard label="Orders Today" value={overview.kpis.ordersToday} />
            <KpiCard label="Revenue Today" value={formatNgn(overview.kpis.revenueToday)} />
            <KpiCard label={`Orders (${periodLabel})`} value={overview.kpis.ordersThisWeek} />
            <KpiCard label={`Revenue (${periodLabel})`} value={formatNgn(overview.kpis.revenueThisWeek)} />
            <KpiCard label="Average Order Value" value={formatNgn(overview.kpis.avgOrderValue)} />
            <Card>
              <p className="text-sm font-medium text-slate-500">Payment Status Mix</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="success">Paid: {overview.kpis.paidOrders}</Badge>
                <Badge variant="warning">Pending: {overview.kpis.pendingPaymentOrders}</Badge>
                <Badge variant="muted">Expired: {overview.kpis.expiredOrders}</Badge>
              </div>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <Card
              className="xl:col-span-2"
              title="Revenue Trend"
              subtitle={`${periodLabel} (UTC)`}
            >
              <RevenueLineChart points={timeseries} />
            </Card>

            <Card title="Top Items" subtitle={`Best sellers in ${periodLabel.toLowerCase()}`}>
              {topItems.length === 0 ? (
                <EmptyState title="No top items yet" description="Paid orders will surface your best-selling menu items." />
              ) : (
                <div className="space-y-3">
                  {topItems.map((item) => (
                    <div key={item.itemId} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                      <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                      <p className="mt-1 text-xs text-slate-500">Qty sold: {item.quantity}</p>
                      <p className="mt-1 text-sm font-semibold text-brand-700">{formatNgn(item.revenue)}</p>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {noRevenueData ? (
            <EmptyState
              title="No paid orders yet"
              description="Create a test order and complete payment to see analytics."
            />
          ) : null}

          {!hasPaidOrders ? (
            <div className="text-sm text-slate-500">
              Need sample data? Open your public page:{" "}
              <Link to={`/r/${user?.restaurant.slug}`} className="font-semibold text-brand-700 hover:text-brand-800">
                /r/{user?.restaurant.slug}
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}
    </AdminShell>
  );
};
