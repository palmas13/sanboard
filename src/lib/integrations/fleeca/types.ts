export interface CreateCheckoutParams {
  orderId: string;
  profileId: string;
  characterName: string;
  packageCode: string;
  amount: number;
}

export interface FleecaOrder {
  orderId: string;
  profileId: string;
  characterName: string;
  packageCode: string;
  packageName: string;
  amount: number;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  createdAt: string;
}

export interface FleecaPaymentResult {
  success: boolean;
  orderId: string;
  transactionId?: string;
  error?: string;
}
