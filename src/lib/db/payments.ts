import { db } from './store';
import { ListingCredit, Payment } from '@/types';
import { getFleecaPaymentProvider } from '../integrations/fleeca';
import { getPaymentRepository } from './repositories';

/**
 * Creates checkout order securely on server.
 * CRITICAL: Client cannot tamper with price. Amount is strictly determined by packageCode.
 */
export async function createCheckoutOrder(
  profileId: string,
  packageCode = 'STANDARD_7_DAY'
): Promise<{ orderId: string; amount: number; packageName: string; error?: string }> {
  if (process.env.DATA_STORE === 'supabase') {
    const repo = getPaymentRepository();
    const order = await repo.createPaymentOrder(profileId, packageCode);
    const fleeca = getFleecaPaymentProvider();
    await fleeca.createOrder({
      orderId: order.orderId,
      profileId,
      characterName: 'Kullanıcı',
      packageCode,
      amount: order.amount,
    });
    return {
      orderId: order.orderId,
      amount: order.amount,
      packageName: order.packageName || '7 Günlük Standart İlan',
    };
  }

  const profile = db.profiles.find((p) => p.id === profileId);
  if (!profile) {
    return { orderId: '', amount: 0, packageName: '', error: 'Profil bulunamadı.' };
  }

  // Get package price from database
  const pkg = db.packages.find((p) => p.code === packageCode && p.active);
  if (!pkg) {
    return { orderId: '', amount: 0, packageName: '', error: 'Geçersiz veya pasif ilan paketi.' };
  }

  const orderId = `ORD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

  // Create payment record in DB
  const payment: Payment = {
    id: `pay-${Date.now()}`,
    order_id: orderId,
    profile_id: profileId,
    package_id: pkg.id,
    provider: 'FLEECA',
    amount: pkg.price, // STRICT SERVER-AUTHORITATIVE PRICE
    status: 'PENDING',
    created_at: new Date().toISOString(),
  };

  db.payments.push(payment);

  // Initialize order in Fleeca provider
  const fleeca = getFleecaPaymentProvider();
  await fleeca.createOrder({
    orderId,
    profileId,
    characterName: profile.full_name,
    packageCode: pkg.code,
    amount: pkg.price,
  });

  return {
    orderId,
    amount: pkg.price,
    packageName: pkg.name,
  };
}

/**
 * Complete payment order and credit 1 listing allowance.
 */
export async function completePaymentOrder(
  orderId: string,
  externalPaymentId?: string
): Promise<{ success: boolean; credit?: ListingCredit; error?: string }> {
  if (process.env.DATA_STORE === 'supabase') {
    const repo = getPaymentRepository();
    const res = await repo.completePayment(orderId, externalPaymentId);
    return { success: res.success, credit: res.credit, error: res.error };
  }

  const payment = db.payments.find((p) => p.order_id === orderId);
  if (!payment) {
    return { success: false, error: 'Ödeme kaydı bulunamadı.' };
  }

  if (payment.status === 'SUCCESS') {
    return { success: true };
  }

  payment.status = 'SUCCESS';
  payment.paid_at = new Date().toISOString();
  payment.external_payment_id = externalPaymentId;

  // Issue 1 available listing credit to profile
  const pkg = db.packages.find((p) => p.id === payment.package_id);
  const creditType = pkg?.code === 'CORPORATE_14_DAY' || pkg?.seller_type === 'CORPORATE' || payment.amount === 1750 ? 'CORPORATE' : 'INDIVIDUAL';
  const credit: ListingCredit = {
    id: `crd-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
    profile_id: payment.profile_id,
    payment_id: payment.id,
    package_id: payment.package_id,
    credit_type: creditType,
    amount: payment.amount,
    status: 'AVAILABLE',
    created_at: new Date().toISOString(),
  };

  db.credits.push(credit);

  return { success: true, credit };
}

/**
 * Get available credits for a profile.
 */
export async function getAvailableCredits(profileId: string): Promise<ListingCredit[]> {
  if (process.env.DATA_STORE === 'supabase') {
    const repo = getPaymentRepository();
    const res = await repo.getUserCredits(profileId);
    return (res.credits || []) as ListingCredit[];
  }

  return db.credits.filter(
    (c) => c.profile_id === profileId && c.status === 'AVAILABLE'
  );
}

/**
 * Get payment history for profile.
 */
export async function getUserPayments(profileId: string): Promise<Payment[]> {
  if (process.env.DATA_STORE === 'supabase') {
    const repo = getPaymentRepository();
    const payments = await repo.getUserPayments(profileId);
    return payments as Payment[];
  }

  return db.payments
    .filter((p) => p.profile_id === profileId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}
