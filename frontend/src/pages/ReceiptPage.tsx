import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { PageLoader } from "../components/ui/PageLoader";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/Table";
import { publicApi } from "../lib/api";

type ReceiptResponse = {
  restaurant: {
    name: string;
  };
  order: {
    id: number;
    type: "DELIVERY" | "PICKUP";
    customerName: string;
    customerPhone: string;
    customerEmail: string | null;
    deliveryAddress: string | null;
    totalAmount: string;
    createdAt: string;
  };
  items: Array<{
    nameSnapshot: string;
    unitPriceSnapshot: string;
    quantity: number;
    lineTotal: string;
  }>;
  payment: {
    reference: string;
    paidAt: string | null;
    amountKobo: number;
  };
};

export const ReceiptPage = () => {
  const { reference } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ReceiptResponse | null>(null);

  useEffect(() => {
    const loadReceipt = async () => {
      if (!reference) {
        setError("Missing receipt reference.");
        setLoading(false);
        return;
      }

      try {
        const response = await publicApi.get<ReceiptResponse>(`/public/receipts/${reference}`);
        setReceipt(response.data);
      } catch (error: any) {
        setError(error?.response?.data?.message ?? "Receipt not available.");
      } finally {
        setLoading(false);
      }
    };

    void loadReceipt();
  }, [reference]);

  if (loading) {
    return <PageLoader message="Loading receipt..." />;
  }

  if (error || !receipt) {
    return (
      <div className="grid min-h-screen place-items-center px-4">
        <EmptyState title="Receipt unavailable" description={error ?? "Receipt not found."} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6">
      <div className="no-print mx-auto mb-3 w-full max-w-3xl text-right">
        <Button onClick={() => window.print()}>Print receipt</Button>
      </div>

      <Card className="mx-auto w-full max-w-3xl print:rounded-none print:border-0 print:shadow-none">
        <header className="mb-6 border-b border-slate-200 pb-4">
          <p className="text-sm font-medium text-slate-500">Dishpatch Receipt</p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">{receipt.restaurant.name}</h1>
        </header>

        <section className="mb-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Order ID</p>
            <strong className="text-slate-900">#{receipt.order.id}</strong>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Order Date</p>
            <strong className="text-slate-900">{new Date(receipt.order.createdAt).toLocaleString()}</strong>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Payment Reference</p>
            <strong className="break-all text-slate-900">{receipt.payment.reference}</strong>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</p>
            <Badge variant="success">PAID</Badge>
          </div>
        </section>

        <section className="mb-6">
          <h2 className="text-base font-semibold text-slate-900">Customer</h2>
          <p className="text-sm text-slate-700">{receipt.order.customerName}</p>
          <p className="text-sm text-slate-600">{receipt.order.customerPhone}</p>
          {receipt.order.customerEmail ? <p className="text-sm text-slate-600">{receipt.order.customerEmail}</p> : null}
          <p className="text-sm text-slate-600">{receipt.order.type}</p>
          {receipt.order.deliveryAddress ? <p className="text-sm text-slate-600">{receipt.order.deliveryAddress}</p> : null}
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-slate-900">Items</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Line Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {receipt.items.map((item, index) => (
                <TableRow key={`${item.nameSnapshot}-${index}`}>
                  <TableCell>{item.nameSnapshot}</TableCell>
                  <TableCell>NGN {Number(item.unitPriceSnapshot).toLocaleString()}</TableCell>
                  <TableCell>{item.quantity}</TableCell>
                  <TableCell className="font-semibold">NGN {Number(item.lineTotal).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>

        <footer className="mt-6 border-t border-slate-200 pt-4">
          <p>
            <strong className="text-lg">Total: NGN {Number(receipt.order.totalAmount).toLocaleString()}</strong>
          </p>
          <p className="text-sm text-slate-500">
            Paid at: {receipt.payment.paidAt ? new Date(receipt.payment.paidAt).toLocaleString() : "n/a"}
          </p>
        </footer>
      </Card>
    </div>
  );
};
