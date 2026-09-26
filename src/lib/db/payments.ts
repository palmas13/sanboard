import { db } from './store';
import { ListingCredit, Payment } from '@/types';
import { getPaymentRepository } from './repositories';

/**
 * Creates checkout order securely on server.
 * CRITICAL: Client cannot tamper with price. Amount is strictly determined by packageCode.
 */
export async function createCheckoutOrder(
  profileId: string,
  packageCode = 'STANDARD_7_DAY',
  options: { idempotencyKey?: string; corporateProfileId?: string | null } = {}
): Promise<{ orderId: string; amount: number; packageName: string; error?: string }> {
  if (process.env.DATA_STORE === 'supabase') {
    const repo = getPaymentRepository();
    const order = await repo.createPaymentOrder(profileId, packageCode, options);
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
  if (!Number.isFinite(pkg.price) || pkg.price <= 0) {
    return { orderId: '', amount: 0, packageName: '', error: 'Ödeme paketinin fiyatı pozitif olmalıdır.' };
  }
  if (
    pkg.code === 'CORPORATE_SUBSCRIPTION_30_DAY'
    && (pkg.seller_type !== 'CORPORATE' || pkg.duration_days !== 30 || !options.corporateProfileId)
  ) {
    return { orderId: '', amount: 0, packageName: '', error: 'Kurumsal üyelik paketi yapılandırması geçersizdir.' };
  }
  if (pkg.code === 'STANDARD_7_DAY' && (pkg.seller_type !== 'INDIVIDUAL' || pkg.duration_days !== 7)) {
    return { orderId: '', amount: 0, packageName: '', error: 'Bireysel ilan paketi yapılandırması geçersizdir.' };
  }
  if (pkg.code === 'CORPORATE_14_DAY' && (pkg.seller_type !== 'CORPORATE' || pkg.duration_days !== 14 || !options.corporateProfileId)) {
    return { orderId: '', amount: 0, packageName: '', error: 'Kurumsal ilan paketi yapılandırması geçersizdir.' };
  }

  const existing = options.idempotencyKey
    ? db.payments.find((payment) => payment.profile_id === profileId && payment.idempotency_key === options.idempotencyKey)
    : undefined;
  if (existing) {
    if (existing.package_id !== pkg.id || (existing.corporate_profile_id || null) !== (options.corporateProfileId || null)) {
      return { orderId: '', amount: 0, packageName: '', error: 'Bu işlem anahtarı farklı bir ödeme için zaten kullanılmış.' };
    }
    return { orderId: existing.order_id, amount: existing.amount, packageName: pkg.name };
  }

  const orderId = `ORD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const entitlementType = packageCode === 'CORPORATE_SUBSCRIPTION_30_DAY'
    ? 'CORPORATE_SUBSCRIPTION'
    : 'LISTING_CREDIT';

  // Create payment record in DB
  const payment: Payment = {
    id: `pay-${orderId}`,
    order_id: orderId,
    profile_id: profileId,
    package_id: pkg.id,
    provider: 'FLEECA',
    amount: pkg.price, // STRICT SERVER-AUTHORITATIVE PRICE
    status: 'PENDING',
    idempotency_key: options.idempotencyKey,
    corporate_profile_id: options.corporateProfileId || null,
    entitlement_type: entitlementType,
    created_at: new Date().toISOString(),
  };
  db.payments.push(payment);

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
  externalPaymentId?: string,
  completedAt = new Date()
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
    if (externalPaymentId && payment.external_payment_id && externalPaymentId !== payment.external_payment_id) {
      return { success: false, error: 'Ödeme farklı bir sağlayıcı işlem kimliğiyle zaten tamamlanmış.' };
    }
    const existingCredit = db.credits.find((credit) => credit.payment_id === payment.id);
    return { success: true, credit: existingCredit };
  }

  if (externalPaymentId && db.payments.some((item) => item.id !== payment.id && item.external_payment_id === externalPaymentId)) {
    return { success: false, error: 'Bu sağlayıcı işlemi başka bir ödeme için kullanılmış.' };
  }

  payment.status = 'SUCCESS';
  payment.paid_at = completedAt.toISOString();
  payment.external_payment_id = externalPaymentId;

  const pkg = db.packages.find((p) => p.id === payment.package_id);
  if (
    payment.entitlement_type === 'CORPORATE_SUBSCRIPTION'
    && pkg?.code === 'CORPORATE_SUBSCRIPTION_30_DAY'
    && pkg.active
    && pkg.seller_type === 'CORPORATE'
    && pkg.duration_days === 30
    && payment.amount > 0
  ) {
    const dealer = db.dealers.find((item) => item.id === payment.corporate_profile_id);
    if (!dealer || dealer.status !== 'APPROVED' || dealer.moderation_status === 'DELETED') {
      payment.status = 'PENDING';
      payment.paid_at = undefined;
      payment.external_payment_id = undefined;
      return { success: false, error: 'Üyelik ödemesine bağlı kurumsal mağaza kullanılamıyor.' };
    }
    const now = completedAt;
    const currentEnd = dealer.subscription_expires_at ? new Date(dealer.subscription_expires_at) : now;
    const base = currentEnd > now ? currentEnd : now;
    const periodStart = dealer.current_period_start ? new Date(dealer.current_period_start) : null;
    const periodEnd = dealer.current_period_end ? new Date(dealer.current_period_end) : null;
    if ((periodStart === null) !== (periodEnd === null)
      || Boolean(periodStart && periodEnd && periodStart >= periodEnd)) {
      payment.status = 'PENDING';
      payment.paid_at = undefined;
      payment.external_payment_id = undefined;
      return { success: false, error: 'Kurumsal üyelik dönemi tutarsızdır.' };
    }
    const wasActiveAndUnexpired = dealer.subscription_status === 'ACTIVE' && currentEnd > now;
    const legacyPeriodMissing = !periodStart && !periodEnd && wasActiveAndUnexpired;
    const startsNewPeriod = !wasActiveAndUnexpired || Boolean(periodEnd && periodEnd <= now);
    dealer.subscription_status = 'ACTIVE';
    const nextSubscriptionEnd = new Date(base.getTime() + 30 * 86400000);
    dealer.subscription_expires_at = nextSubscriptionEnd.toISOString();
    if (startsNewPeriod) {
      dealer.current_period_start = now.toISOString();
      dealer.current_period_end = new Date(Math.min(now.getTime() + 30 * 86400000, nextSubscriptionEnd.getTime())).toISOString();
      dealer.boost_credits = 3;
    } else if (legacyPeriodMissing) {
      dealer.current_period_start = now.toISOString();
      dealer.current_period_end = new Date(Math.min(now.getTime() + 30 * 86400000, currentEnd.getTime())).toISOString();
    }
    dealer.updated_at = now.toISOString();
    payment.entitlement_applied_at = now.toISOString();
    return { success: true };
  }

  if (payment.entitlement_type === 'CORPORATE_SUBSCRIPTION' || pkg?.code === 'CORPORATE_SUBSCRIPTION_30_DAY') {
    payment.status = 'PENDING';
    payment.paid_at = undefined;
    payment.external_payment_id = undefined;
    return { success: false, error: 'Kurumsal üyelik ödeme paketi doğrulanamadı.' };
  }

  // Issue 1 available listing credit to profile
  const validListingPackage = Boolean(pkg && (
    (pkg.code === 'STANDARD_7_DAY' && pkg.seller_type === 'INDIVIDUAL' && pkg.duration_days === 7)
    || (pkg.code === 'CORPORATE_14_DAY' && pkg.seller_type === 'CORPORATE' && pkg.duration_days === 14)
  ) && pkg.active && payment.amount > 0);
  if (!pkg || !validListingPackage) {
    payment.status = 'PENDING';
    payment.paid_at = undefined;
    payment.external_payment_id = undefined;
    return { success: false, error: 'Desteklenmeyen ilan paketi.' };
  }
  const creditType = pkg.code === 'CORPORATE_14_DAY' ? 'CORPORATE' : 'INDIVIDUAL';
  let corporateProfileId: string | null = null;
  if (creditType === 'CORPORATE') {
    const dealer = (db.dealers || []).find((d) => d.id === payment.corporate_profile_id);
    const eligible = dealer
      && (dealer.owner_profile_id || dealer.profile_id) === payment.profile_id
      && dealer.status === 'APPROVED'
      && dealer.moderation_status === 'ACTIVE'
      && dealer.subscription_status === 'ACTIVE'
      && Boolean(dealer.subscription_expires_at)
      && new Date(dealer.subscription_expires_at!).getTime() > Date.now();
    if (!eligible) {
      payment.status = 'PENDING';
      payment.paid_at = undefined;
      payment.external_payment_id = undefined;
      return { success: false, error: 'Kurumsal mağaza ilan kredisi için uygun değil.' };
    }
    corporateProfileId = dealer!.id;
  }

  const credit: ListingCredit = {
    id: `crd-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
    profile_id: payment.profile_id,
    payment_id: payment.id,
    package_id: payment.package_id,
    credit_type: creditType,
    corporate_profile_id: corporateProfileId,
    amount: payment.amount,
    status: 'AVAILABLE',
    created_at: completedAt.toISOString(),
  };

  db.credits.push(credit);
  payment.entitlement_applied_at = completedAt.toISOString();

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
