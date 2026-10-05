import { IPaymentRepository } from '../types';
import { getSupabaseClient, getSupabaseAdminClient } from '../../supabase-client';

import { resolveProfileId, isUuid } from '../../id-mapper';
import { getPackagePrice, isPaymentPackageCode, type PaymentPurpose } from '@/lib/payments/pricing';
import type { PayerIdentityFailureCode, PayerIdentityStatus } from '@/types';

export class SupabasePaymentRepository implements IPaymentRepository {
  private getClient() {
    const client = getSupabaseClient();
    if (!client) {
      throw new Error(
        'Supabase client is not initialized. Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are set.'
      );
    }
    return client;
  }

  private getAdminClient() {
    const admin = getSupabaseAdminClient();
    if (!admin) {
      throw new Error('Supabase admin client is required for trusted payment operations. SUPABASE_SECRET_KEY is missing.');
    }
    return admin;
  }

  async getUserCredits(profileId: string) {
    const client = this.getAdminClient();
    const safeProfileId = resolveProfileId(profileId);
    if (!isUuid(safeProfileId)) {
      return { available: 0, total: 0, credits: [] };
    }

    const { data, error } = await client
      .from('listing_credits')
      .select('*')
      .eq('profile_id', safeProfileId);

    if (error) {
      throw new Error(`Supabase error fetching user credits: ${error.message}`);
    }

    const available = (data || []).filter((c: any) => c.status === 'AVAILABLE' && c.used_at == null).length;
    return { available, total: (data || []).length, credits: data || [] };
  }

  async createPaymentOrder(
    profileId: string,
    packageIdOrCode: string,
    options: { idempotencyKey?: string; corporateProfileId?: string | null; purpose?: PaymentPurpose; targetListingId?: string | null; expectedExternalCharacterId?: string; expectedCharacterName?: string } = {}
  ): Promise<{ orderId: string; amount: number; packageName?: string; entitlementType?: 'LISTING_CREDIT' | 'CORPORATE_SUBSCRIPTION' | 'BOOST_CREDIT' }> {
    const client = this.getAdminClient();

    // Query package by code or by id
    let packageRecord: any = null;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(packageIdOrCode);
    if (isUuid) {
      const { data } = await client.from('packages').select('*').eq('id', packageIdOrCode).maybeSingle();
      packageRecord = data;
    }
    if (!packageRecord) {
      const { data } = await client.from('packages').select('*').eq('code', packageIdOrCode).maybeSingle();
      packageRecord = data;
    }
    if (!packageRecord) {
      throw new Error('İstenen aktif ödeme paketi bulunamadı.');
    }

    if (!packageRecord.active) throw new Error('İstenen ödeme paketi aktif değildir.');
    if (!isPaymentPackageCode(packageRecord.code)) throw new Error('Desteklenmeyen ödeme paketi.');
    if (packageRecord.code === 'CORPORATE_SUBSCRIPTION_30_DAY' || packageRecord.code === 'CORPORATE_PLUS_30_DAY') {
      if (packageRecord.seller_type !== 'CORPORATE' || packageRecord.duration_days !== 30) {
        throw new Error('Kurumsal üyelik paketi yapılandırması geçersizdir.');
      }
      if (!options.corporateProfileId) {
        throw new Error('Kurumsal üyelik ödemesi bir mağazaya bağlı olmalıdır.');
      }
    }
    if (packageRecord.code === 'STANDARD_7_DAY'
      && (packageRecord.seller_type !== 'INDIVIDUAL' || packageRecord.duration_days !== 7)) {
      throw new Error('Bireysel ilan paketi yapılandırması geçersizdir.');
    }
    if (packageRecord.code === 'CORPORATE_14_DAY'
      && (packageRecord.seller_type !== 'CORPORATE' || packageRecord.duration_days !== 14 || !options.corporateProfileId)) {
      throw new Error('Kurumsal ilan paketi yapılandırması geçersizdir.');
    }

    const canonicalPurpose: PaymentPurpose = packageRecord.code === 'CORPORATE_SUBSCRIPTION_30_DAY' || packageRecord.code === 'CORPORATE_PLUS_30_DAY'
      ? 'CORPORATE_SUBSCRIPTION'
      : packageRecord.code === 'LISTING_BOOST_24_HOUR' ? 'LISTING_BOOST' : 'LISTING_PUBLICATION';
    const purpose = options.purpose || canonicalPurpose;
    if (purpose !== canonicalPurpose) throw new Error('Ödeme amacı paketle eşleşmiyor.');
    if (packageRecord.code === 'LISTING_BOOST_24_HOUR'
      && (packageRecord.seller_type !== 'CORPORATE' || packageRecord.duration_days !== 1 || !options.corporateProfileId)) {
      throw new Error('Boost kredisi paketi yapılandırması geçersizdir.');
    }
    const entitlementType = purpose === 'CORPORATE_SUBSCRIPTION' ? 'CORPORATE_SUBSCRIPTION' : purpose === 'LISTING_BOOST' ? 'BOOST_CREDIT' : 'LISTING_CREDIT';

    if (options.idempotencyKey) {
      const { data: existing, error: existingError } = await client
        .from('payments')
        .select('order_id, amount, package_id, corporate_profile_id, entitlement_type, purpose, target_listing_id, expected_external_character_id, expected_character_name')
        .eq('profile_id', profileId)
        .eq('idempotency_key', options.idempotencyKey)
        .maybeSingle();
      if (existingError) throw new Error(existingError.message);
      if (existing) {
        if (existing.package_id !== packageRecord.id || (existing.corporate_profile_id || null) !== (options.corporateProfileId || null)
          || existing.purpose !== purpose || (existing.target_listing_id || null) !== (options.targetListingId || null)) {
          throw new Error('Bu işlem anahtarı farklı bir ödeme için zaten kullanılmış.');
        }
        if (options.expectedExternalCharacterId && options.expectedCharacterName
          && (existing.expected_external_character_id !== options.expectedExternalCharacterId
            || existing.expected_character_name !== options.expectedCharacterName)) {
          throw new Error('Bu işlem anahtarı farklı bir ödeme karakteri için zaten kullanılmış.');
        }
        return {
          orderId: existing.order_id,
          amount: existing.amount,
          packageName: packageRecord.name,
          entitlementType: existing.entitlement_type || entitlementType,
        };
      }
    }

    const orderId = `ORD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const amount = getPackagePrice(packageRecord.code);

    const { error } = await client.from('payments').insert({
      order_id: orderId,
      profile_id: profileId,
      package_id: packageRecord.id,
      amount,
      status: 'PENDING',
      idempotency_key: options.idempotencyKey || null,
      corporate_profile_id: options.corporateProfileId || null,
      entitlement_type: entitlementType,
      purpose,
      target_listing_id: options.targetListingId || null,
      expected_external_character_id: options.expectedExternalCharacterId || null,
      expected_character_name: options.expectedCharacterName || null,
      payer_identity_status: options.expectedExternalCharacterId && options.expectedCharacterName ? 'PENDING' : null,
    });

    if (error) {
      throw new Error(`Supabase error creating payment order: ${error.message}`);
    }

    return { orderId, amount, packageName: packageRecord.name, entitlementType };
  }

  async verifyPayerIdentityAndBind(orderId: string, payerName: string | null, payerRouting: string | null): Promise<{ success: boolean; status: PayerIdentityStatus; failureCode?: PayerIdentityFailureCode }> {
    const client = this.getAdminClient();
    const { data, error } = await client.rpc('verify_sanboard_fleeca_payer', {
      p_order_id: orderId,
      p_payer_name: payerName,
      p_payer_routing: payerRouting,
    });
    if (error) return { success: false, status: 'FAILED', failureCode: 'PAYER_VERIFICATION_FAILED' };
    const result = Array.isArray(data) ? data[0] : data;
    return {
      success: Boolean(result?.success),
      status: (result?.status || 'FAILED') as PayerIdentityStatus,
      failureCode: result?.failure_code || undefined,
    };
  }

  async attachProviderPayment(orderId: string, providerPaymentId: string): Promise<void> {
    const client = this.getAdminClient();
    const { data, error } = await client.from('payments')
      .update({ external_payment_id: providerPaymentId })
      .eq('order_id', orderId).eq('status', 'PENDING')
      .or(`external_payment_id.is.null,external_payment_id.eq.${providerPaymentId}`)
      .select('id').maybeSingle();
    if (error || !data) throw new Error(error?.message || 'Fleeca ödeme kimliği local siparişe bağlanamadı.');
  }

  async completePayment(orderId: string, externalPaymentId?: string): Promise<{ success: boolean; credit?: any; error?: string }> {
    const client = this.getAdminClient();

    const { data, error } = await client.rpc('complete_sanboard_payment', {
      p_order_id: orderId,
      p_external_payment_id: externalPaymentId || null,
    });
    if (error) return { success: false, error: error.message };
    const result = Array.isArray(data) ? data[0] : data;
    return { success: Boolean(result?.success), credit: result?.credit || undefined, error: result?.error || undefined };
  }

  async failPayment(orderId: string, externalPaymentId: string): Promise<{ success: boolean; error?: string }> {
    const client = this.getAdminClient();
    const { data: existing, error: existingError } = await client.from('payments')
      .select('status, external_payment_id, entitlement_applied_at')
      .eq('order_id', orderId).maybeSingle();
    if (existingError || !existing) return { success: false, error: existingError?.message || 'Ödeme kaydı bulunamadı.' };
    if (existing.external_payment_id !== externalPaymentId) return { success: false, error: 'Fleeca ödeme kimliği eşleşmedi.' };
    if (existing.status === 'FAILED') return { success: true };
    if (existing.status !== 'PENDING' || existing.entitlement_applied_at) return { success: false, error: 'Ödeme terminal başarısız duruma geçirilemedi.' };
    const { data, error } = await client.from('payments')
      .update({ status: 'FAILED', processed_at: new Date().toISOString() })
      .eq('order_id', orderId).eq('external_payment_id', externalPaymentId).eq('status', 'PENDING')
      .is('entitlement_applied_at', null).select('id').maybeSingle();
    if (error) return { success: false, error: error.message };
    if (data) return { success: true };
    const { data: terminal, error: terminalError } = await client.from('payments')
      .select('status, external_payment_id, entitlement_applied_at')
      .eq('order_id', orderId).maybeSingle();
    if (terminalError) return { success: false, error: terminalError.message };
    return terminal?.status === 'FAILED'
      && terminal.external_payment_id === externalPaymentId
      && !terminal.entitlement_applied_at
      ? { success: true }
      : { success: false, error: 'Ödeme terminal başarısız duruma geçirilemedi.' };
  }

  async completeBoostPayment(orderId: string): Promise<{ success: boolean; error?: string; purchasedBoostCredits?: number }> {
    const client = this.getAdminClient();
    const { data, error } = await client.rpc('complete_sanboard_boost_payment', { p_order_id: orderId });
    if (error) return { success: false, error: error.message };
    const result = Array.isArray(data) ? data[0] : data;
    return { success: Boolean(result?.success), error: result?.error || undefined, purchasedBoostCredits: result?.purchased_boost_credits };
  }

  async getUserPayments(profileId: string): Promise<any[]> {
    const client = this.getAdminClient();
    const safeProfileId = resolveProfileId(profileId);
    if (!isUuid(safeProfileId)) return [];

    const { data: profile } = await client
      .from('character_profiles')
      .select('payment_history_cleared_at')
      .eq('id', safeProfileId)
      .maybeSingle();

    let query = client
      .from('payments')
      .select('id, order_id, amount, status, entitlement_type, purpose, created_at, package:packages(code, name)')
      .eq('profile_id', safeProfileId);
    if (profile?.payment_history_cleared_at) {
      query = query.gt('created_at', profile.payment_history_cleared_at);
    }
    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Supabase error fetching payments: ${error.message}`);
    }
    return (data || []).map((payment: any) => {
      const paymentPackage = Array.isArray(payment.package) ? payment.package[0] : payment.package;
      return {
        id: payment.id,
        order_id: payment.order_id,
        amount: payment.amount,
        status: payment.status,
        entitlement_type: payment.entitlement_type,
        purpose: payment.purpose,
        package_code: paymentPackage?.code || null,
        package_name: paymentPackage?.name || null,
        created_at: payment.created_at,
      };
    });
  }

  async clearUserPaymentHistory(profileId: string) {
    const client = this.getAdminClient();
    const safeProfileId = resolveProfileId(profileId);
    if (!isUuid(safeProfileId)) return { success: false, error: 'Geçersiz profil.' };
    const clearedAt = new Date().toISOString();
    const { data, error } = await client
      .from('character_profiles')
      .update({ payment_history_cleared_at: clearedAt, updated_at: clearedAt })
      .eq('id', safeProfileId)
      .select('id')
      .maybeSingle();
    if (error || !data) return { success: false, error: error?.message || 'Ödeme geçmişi temizlenemedi.' };
    return { success: true, clearedAt };
  }

  async getPaymentOrder(orderId: string): Promise<any | null> {
    const client = this.getAdminClient();
    const { data, error } = await client.from('payments').select('*').eq('order_id', orderId).maybeSingle();
    if (error) throw new Error(error.message);
    return data || null;
  }

  async getPaymentByExternalPaymentId(externalPaymentId: string): Promise<any | null> {
    const client = this.getAdminClient();
    const { data, error } = await client.from('payments').select('*').eq('external_payment_id', externalPaymentId).maybeSingle();
    if (error) throw new Error(error.message);
    return data || null;
  }
}
