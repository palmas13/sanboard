import { IPaymentRepository } from '../types';
import { getSupabaseClient, getSupabaseAdminClient } from '../../supabase-client';

import { resolveProfileId, isUuid } from '../../id-mapper';
import { getPaymentPrice, type PaymentPurpose } from '@/lib/payments/pricing';

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

    const available = (data || []).filter((c: any) => c.status === 'AVAILABLE').length;
    return { available, total: (data || []).length, credits: data || [] };
  }

  async createPaymentOrder(
    profileId: string,
    packageIdOrCode: string,
    options: { idempotencyKey?: string; corporateProfileId?: string | null; purpose?: PaymentPurpose; targetListingId?: string | null } = {}
  ): Promise<{ orderId: string; amount: number; packageName?: string; entitlementType?: 'LISTING_CREDIT' | 'CORPORATE_SUBSCRIPTION' | 'LISTING_BOOST' }> {
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
    if (packageRecord.code === 'CORPORATE_SUBSCRIPTION_30_DAY') {
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

    const purpose = options.purpose || (packageRecord.code === 'CORPORATE_SUBSCRIPTION_30_DAY' ? 'CORPORATE_SUBSCRIPTION' : 'LISTING_PUBLICATION');
    const entitlementType = purpose === 'CORPORATE_SUBSCRIPTION' ? 'CORPORATE_SUBSCRIPTION' : purpose === 'LISTING_BOOST' ? 'LISTING_BOOST' : 'LISTING_CREDIT';

    if (options.idempotencyKey) {
      const { data: existing, error: existingError } = await client
        .from('payments')
        .select('order_id, amount, package_id, corporate_profile_id, entitlement_type, purpose, target_listing_id')
        .eq('profile_id', profileId)
        .eq('idempotency_key', options.idempotencyKey)
        .maybeSingle();
      if (existingError) throw new Error(existingError.message);
      if (existing) {
        if (existing.package_id !== packageRecord.id || (existing.corporate_profile_id || null) !== (options.corporateProfileId || null)
          || existing.purpose !== purpose || (existing.target_listing_id || null) !== (options.targetListingId || null)) {
          throw new Error('Bu işlem anahtarı farklı bir ödeme için zaten kullanılmış.');
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
    const amount = getPaymentPrice(purpose);

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
    });

    if (error) {
      throw new Error(`Supabase error creating payment order: ${error.message}`);
    }

    return { orderId, amount, packageName: packageRecord.name, entitlementType };
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

  async completeBoostPayment(orderId: string): Promise<{ success: boolean; error?: string; featured_until?: string }> {
    const client = this.getAdminClient();
    const { data, error } = await client.rpc('complete_sanboard_boost_payment', { p_order_id: orderId });
    if (error) return { success: false, error: error.message };
    const result = Array.isArray(data) ? data[0] : data;
    return { success: Boolean(result?.success), error: result?.error || undefined, featured_until: result?.featured_until || undefined };
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
      .select('id, order_id, amount, status, created_at')
      .eq('profile_id', safeProfileId);
    if (profile?.payment_history_cleared_at) {
      query = query.gt('created_at', profile.payment_history_cleared_at);
    }
    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Supabase error fetching payments: ${error.message}`);
    }
    return data || [];
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
}
