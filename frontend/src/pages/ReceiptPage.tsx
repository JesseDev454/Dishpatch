import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
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
    return <div className="center-page">Loading receipt...</div>;
  }

  if (error || !receipt) {
    return (
      <div className="center-page">
        <div className="receipt-shell">
          <h2>Receipt unavailable</h2>
          <p className="error-text">{error ?? "Receipt not found."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="receipt-page">
      <div className="receipt-actions no-print">
        <button onClick={() => window.print()}>Print Receipt</button>
      </div>

      <article className="receipt-shell">
        <header className="receipt-header">
          <h1>{receipt.restaurant.name}</h1>
          <p>Dishpatch Receipt</p>
        </header>

        <section className="receipt-meta">
          <p>
            <strong>Order ID:</strong> #{receipt.order.id}
          </p>
          <p>
            <strong>Date:</strong> {new Date(receipt.order.createdAt).toLocaleString()}
          </p>
          <p>
            <strong>Payment Ref:</strong> {receipt.payment.reference}
          </p>
          <p>
            <strong>Status:</strong> PAID
          </p>
        </section>

        <section className="receipt-customer">
          <h2>Customer</h2>
          <p>{receipt.order.customerName}</p>
          <p>{receipt.order.customerPhone}</p>
          {receipt.order.customerEmail ? <p>{receipt.order.customerEmail}</p> : null}
          <p>{receipt.order.type}</p>
          {receipt.order.deliveryAddress ? <p>{receipt.order.deliveryAddress}</p> : null}
        </section>

        <section>
          <h2>Items</h2>
          <table className="receipt-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Unit</th>
                <th>Qty</th>
                <th>Line Total</th>
              </tr>
            </thead>
            <tbody>
              {receipt.items.map((item, index) => (
                <tr key={`${item.nameSnapshot}-${index}`}>
                  <td>{item.nameSnapshot}</td>
                  <td>NGN {Number(item.unitPriceSnapshot).toLocaleString()}</td>
                  <td>{item.quantity}</td>
                  <td>NGN {Number(item.lineTotal).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <footer className="receipt-total">
          <p>
            <strong>Total: NGN {Number(receipt.order.totalAmount).toLocaleString()}</strong>
          </p>
          <p className="muted">
            Paid at: {receipt.payment.paidAt ? new Date(receipt.payment.paidAt).toLocaleString() : "n/a"}
          </p>
        </footer>
      </article>
    </div>
  );
};
