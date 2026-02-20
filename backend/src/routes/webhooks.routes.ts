import { Router } from "express";
import crypto from "crypto";
import { env } from "../config/env";
import { HttpError } from "../middleware/error-handler";
import { PaymentService } from "../services/payment.service";

const router = Router();

const verifySignature = (rawBody: Buffer, signature: string): boolean => {
  const hash = crypto.createHmac("sha512", env.paystack.secretKey).update(rawBody).digest("hex");
  const signatureBuffer = Buffer.from(signature, "utf8");
  const hashBuffer = Buffer.from(hash, "utf8");

  if (signatureBuffer.length !== hashBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(signatureBuffer, hashBuffer);
};

router.post("/paystack", async (req, res, next) => {
  try {
    const signature = req.header("x-paystack-signature");
    if (!signature || !req.rawBody) {
      throw new HttpError(400, "Invalid signature");
    }

    if (!verifySignature(req.rawBody, signature)) {
      throw new HttpError(401, "Invalid signature");
    }

    const payload = req.body as { event?: string; data?: { reference?: string } };
    const reference = payload?.data?.reference;
    if (!reference) {
      res.status(200).json({ received: true });
      return;
    }

    const paymentService = new PaymentService();

    if (payload.event === "charge.success") {
      await paymentService.markPaymentSuccess(reference, payload as Record<string, unknown>);
    } else if (payload.event && payload.event.includes("failed")) {
      await paymentService.markPaymentFailed(reference);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    next(error);
  }
});

export default router;
