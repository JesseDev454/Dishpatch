import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ReceiptText } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { PageLoader } from "../components/ui/PageLoader";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/Table";
import { AnimatePresence, motion, useReducedMotion } from "../components/ui/motion";
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
  const reducedMotion = useReducedMotion() ?? false;
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
    <div className="min-h-screen bg-background px-4 py-6">
      <div className="no-print mx-auto mb-3 w-full max-w-3xl text-right">
        <div className="inline-flex gap-2">
          <Button variant="secondary" asChild>
            <Link to="/">Back to menu</Link>
          </Button>
          <Button onClick={() => window.print()}>Print receipt</Button>
        </div>
      </div>

      <motion.div
        initial={reducedMotion ? undefined : { opacity: 0, scale: 0.98, y: 12 }}
        animate={reducedMotion ? undefined : { opacity: 1, scale: 1, y: 0 }}
        transition={reducedMotion ? undefined : { duration: 0.28, ease: "easeOut" }}
      >
        <Card className="mx-auto w-full max-w-3xl print:rounded-none print:border-0 print:shadow-none">
        <header className="mb-6 border-b border-border pb-4">
          <span className="mb-2 inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <ReceiptText className="h-3.5 w-3.5" />
            Dishpatch Receipt
          </span>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{receipt.restaurant.name}</h1>
        </header>

        <section className="mb-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-muted/45 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Order ID</p>
            <strong className="text-foreground">#{receipt.order.id}</strong>
          </div>
          <div className="rounded-2xl border border-border bg-muted/45 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Order Date</p>
            <strong className="text-foreground">{new Date(receipt.order.createdAt).toLocaleString()}</strong>
          </div>
          <div className="rounded-2xl border border-border bg-muted/45 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Payment Reference</p>
            <strong className="break-all text-foreground">{receipt.payment.reference}</strong>
          </div>
          <div className="rounded-2xl border border-border bg-muted/45 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</p>
            <motion.div
              initial={reducedMotion ? undefined : { opacity: 0, scale: 0.94 }}
              animate={reducedMotion ? undefined : { opacity: 1, scale: 1 }}
              transition={reducedMotion ? undefined : { delay: 0.12, duration: 0.2, ease: "easeOut" }}
            >
              <Badge variant="success">PAID</Badge>
            </motion.div>
          </div>
        </section>

        <section className="mb-6">
          <h2 className="text-base font-semibold text-foreground">Customer</h2>
          <p className="text-sm text-foreground/85">{receipt.order.customerName}</p>
          <p className="text-sm text-muted-foreground">{receipt.order.customerPhone}</p>
          {receipt.order.customerEmail ? <p className="text-sm text-muted-foreground">{receipt.order.customerEmail}</p> : null}
          <p className="text-sm text-muted-foreground">{receipt.order.type}</p>
          {receipt.order.deliveryAddress ? <p className="text-sm text-muted-foreground">{receipt.order.deliveryAddress}</p> : null}
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-foreground">Items</h2>
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
              <AnimatePresence initial={false}>
                {receipt.items.map((item, index) => (
                  <motion.tr
                    key={`${item.nameSnapshot}-${index}`}
                    initial={reducedMotion ? undefined : { opacity: 0, y: 8 }}
                    animate={reducedMotion ? undefined : { opacity: 1, y: 0 }}
                    transition={reducedMotion ? undefined : { delay: index * 0.04, duration: 0.18, ease: "easeOut" }}
                    className="border-b transition-colors hover:bg-primary/5"
                  >
                    <TableCell>{item.nameSnapshot}</TableCell>
                    <TableCell>NGN {Number(item.unitPriceSnapshot).toLocaleString()}</TableCell>
                    <TableCell>{item.quantity}</TableCell>
                    <TableCell className="font-semibold">NGN {Number(item.lineTotal).toLocaleString()}</TableCell>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </TableBody>
          </Table>
        </section>

        <footer className="mt-6 border-t border-border pt-4">
          <p>
            <strong className="text-lg">Total: NGN {Number(receipt.order.totalAmount).toLocaleString()}</strong>
          </p>
          <p className="text-sm text-muted-foreground">
            Paid at: {receipt.payment.paidAt ? new Date(receipt.payment.paidAt).toLocaleString() : "n/a"}
          </p>
        </footer>
        </Card>
      </motion.div>
    </div>
  );
};
