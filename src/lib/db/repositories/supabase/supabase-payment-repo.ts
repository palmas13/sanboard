import { IPaymentRepository } from '../types';
import { getSupabaseClient, getSupabaseAdminClient } from '../../supabase-client';

import { resolveProfileId, isUuid } from '../../id-mapper';

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
    if (admin) return admin;
    return this.getClient();
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

  async consumeCredit(profileId: string, listingId: string): Promise<boolean> {
    const client = this.getAdminClient();

    const { data: availableCredit, error: fetchErr } = await client
      .from('listing_credits')
      .select('id')
      .eq('profile_id', profileId)
      .eq('status', 'AVAILABLE')
      .limit(1)
      .maybeSingle();

    if (fetchErr || !availableCredit) return false;

    const { error } = await client
      .from('listing_credits')
      .update({
        status: 'USED',
        used_listing_id: listingId,
        used_at: new Date().toISOString(),
      })
      .eq('id', availableCredit.id);

    return !error;
  }

  async createPaymentOrder(profileId: string, packageIdOrCode: string): Promise<{ orderId: string; amount: number; packageName?: string }> {
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
      const { data } = await client.from('packages').select('*').eq('active', true).limit(1).maybeSingle();
      packageRecord = data;
    }

    if (!packageRecord) {
      throw new Error('Aktif ilan paketi bulunamadı.');
    }

    const orderId = `ORD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const amount = packageRecord.price;

    const { error } = await client.from('payments').insert({
      order_id: orderId,
      profile_id: profileId,
      package_id: packageRecord.id,
      amount,
      status: 'PENDING',
    });

    if (error) {
      throw new Error(`Supabase error creating payment order: ${error.message}`);
    }

    return { orderId, amount, packageName: packageRecord.name };
  }

  async completePayment(orderId: string, externalPaymentId?: string): Promise<{ success: boolean; credit?: any; error?: string }> {
    const client = this.getAdminClient();

    const { data: payment, error: fetchErr } = await client
      .from('payments')
      .select('*')
      .eq('order_id', orderId)
      .single();

    if (fetchErr || !payment) {
      return { success: false, error: fetchErr?.message || 'Ödeme kaydı bulunamadı.' };
    }

    if (payment.status === 'SUCCESS') {
      return { success: true };
    }

    const { error: updateErr } = await client
      .from('payments')
      .update({
        status: 'SUCCESS',
        external_payment_id: externalPaymentId,
        paid_at: new Date().toISOString(),
      })
      .eq('order_id', orderId);

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    // Query package to determine credit_type
    const { data: pkgData } = await client
      .from('packages')
      .select('code, seller_type')
      .eq('id', payment.package_id)
      .maybeSingle();

    const creditType = pkgData?.code === 'CORPORATE_14_DAY' || pkgData?.seller_type === 'CORPORATE' || payment.amount === 1750 ? 'CORPORATE' : 'INDIVIDUAL';

    // Create listing credit
    const { data: newCredit, error: creditErr } = await client
      .from('listing_credits')
      .insert({
        profile_id: payment.profile_id,
        payment_id: payment.id,
        package_id: payment.package_id,
        credit_type: creditType,
        amount: payment.amount,
        status: 'AVAILABLE',
      })
      .select()
      .single();

    if (creditErr) {
      return { success: false, error: creditErr.message };
    }

    return { success: true, credit: newCredit };
  }

  async getUserPayments(profileId: string): Promise<any[]> {
    const client = this.getAdminClient();
    const safeProfileId = resolveProfileId(profileId);
    if (!isUuid(safeProfileId)) return [];

    const { data, error } = await client
      .from('payments')
      .select('*')
      .eq('profile_id', safeProfileId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Supabase error fetching payments: ${error.message}`);
    }
    return data || [];
  }
}
