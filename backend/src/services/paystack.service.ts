import axios from "axios";
import { env } from "../config/env";

type PaystackInitializePayload = {
  email: string | null;
  amount: number;
  reference: string;
  callback_url: string;
  metadata: Record<string, unknown>;
};

type PaystackInitializeResponse = {
  status: boolean;
  message: string;
  data?: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
};

type PaystackVerifyResponse = {
  status: boolean;
  message: string;
  data?: {
    status: string;
    reference: string;
    amount: number;
  };
};

export class PaystackService {
  private client = axios.create({
    baseURL: env.paystack.baseUrl,
    headers: {
      Authorization: `Bearer ${env.paystack.secretKey}`,
      "Content-Type": "application/json"
    }
  });

  async initializeTransaction(payload: PaystackInitializePayload): Promise<PaystackInitializeResponse> {
    const response = await this.client.post("/transaction/initialize", payload);
    return response.data as PaystackInitializeResponse;
  }

  async verifyTransaction(reference: string): Promise<PaystackVerifyResponse> {
    const response = await this.client.get(`/transaction/verify/${reference}`);
    return response.data as PaystackVerifyResponse;
  }
}
