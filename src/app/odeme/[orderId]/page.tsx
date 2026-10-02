'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthContext';
import {
  CreditCard,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Loader2,
  Building,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/format';
import { SanboardLogo } from '@/components/common/SanboardLogo';

export default function FleecaCheckoutPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.orderId as string;
  const { currentProfile } = useAuth();

  const [step, setStep] = useState<1 | 2 | 3>(2);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    transactionId?: string;
    error?: string;
  } | null>(null);
  const [order, setOrder] = useState<{ amount: number; entitlementType: 'LISTING_CREDIT' | 'CORPORATE_SUBSCRIPTION'; packageName: string } | null>(null);

  const amount = order?.amount || 0;
  const buyerName = currentProfile?.full_name || 'Sanboard Kullanıcısı';

  useEffect(() => {
    if (!orderId) return;
    fetch(`/api/checkout?orderId=${encodeURIComponent(orderId)}`)
      .then((response) => response.json().then((data) => ({ response, data })))
      .then(({ response, data }) => {
        if (response.ok) setOrder({ amount: data.amount, entitlementType: data.entitlementType, packageName: data.packageName });
        else setResult({ success: false, error: data.error || 'Sipariş bilgisi alınamadı.' });
      })
      .catch(() => setResult({ success: false, error: 'Sipariş bilgisi alınamadı.' }));
  }, [orderId]);

  const handleVerifyPayment = async () => {
    setProcessing(true);
    setResult(null);

    try {
      const res = await fetch('/api/checkout', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setResult({ success: true, transactionId: data.transactionId });
        setStep(3);
      } else {
        setResult({ success: false, error: data.error || 'Ödeme reddedildi.' });
      }
    } catch {
      setResult({ success: false, error: 'Sunucuya bağlanırken bir hata oluştu.' });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-xl w-full surface-card rounded-2xl border border-[var(--border-app)] shadow-2xl overflow-hidden space-y-6">
        {/* Top Header */}
        <div className="p-6 bg-[var(--bg-surface-secondary)] border-b border-[var(--border-app)] flex items-center justify-between">
          <SanboardLogo size="sm" />
          <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-muted)]">
            <Building className="w-4 h-4 text-[#FF8A1F]" />
            <span>Fleeca Bank Checkout</span>
          </div>
        </div>

        {/* Stepper Indicator */}
        <div className="px-6 pt-2">
          <div className="flex items-center justify-between text-xs font-bold text-[var(--text-dim)]">
            <span className={step >= 1 ? 'text-[#FF8A1F]' : ''}>1. Sipariş Özeti</span>
            <span className="h-px w-12 bg-[var(--border-app)]" />
            <span className={step >= 2 ? 'text-[#FF8A1F]' : ''}>2. Fleeca Ödeme</span>
            <span className="h-px w-12 bg-[var(--border-app)]" />
            <span className={step === 3 ? 'text-[#FF8A1F]' : ''}>3. Onay & Kredi</span>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Order Summary Box */}
          <div className="p-4 rounded-xl bg-[var(--bg-surface-secondary)]/60 border border-[var(--border-app)] space-y-3">
            <div className="flex items-center justify-between text-xs text-[var(--text-dim)]">
              <span>Sipariş No</span>
              <span className="font-mono text-[var(--text-main)] font-semibold">{orderId}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-[var(--text-dim)]">
              <span>Paket</span>
              <span className="text-[var(--text-main)] font-semibold">{order?.packageName || 'Paket bilgisi yükleniyor'}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-[var(--text-dim)]">
              <span>Alıcı Karakter</span>
              <span className="text-[var(--text-main)] font-semibold">{buyerName}</span>
            </div>
            <div className="pt-2 border-t border-[var(--border-app)] flex items-center justify-between">
              <span className="text-sm font-bold text-[var(--text-main)]">Toplam Tutar</span>
              <span className="text-xl font-extrabold text-[#FF8A1F]">{formatCurrency(amount)}</span>
            </div>
          </div>

          {/* SUCCESS SCREEN */}
          {step === 3 && result?.success ? (
            <div className="text-center space-y-5 py-4 animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 mx-auto rounded-full bg-[var(--color-success-subtle)] text-[var(--color-success)] flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div className="space-y-1">
                <h2 className="text-2xl font-black text-[var(--text-main)]">
                  Ödeme Başarılı!
                </h2>
                <p className="text-sm text-[var(--text-muted)]">
                  {order?.entitlementType === 'CORPORATE_SUBSCRIPTION'
                    ? 'Fleeca işlemi onaylandı. Kurumsal üyeliğiniz 30 gün uzatıldı.'
                    : 'Fleeca işlemi onaylandı. 1 adet ilan yayınlama hakkınız hesabınıza tanımlandı.'}
                </p>
                <p className="text-xs font-mono text-[var(--text-dim)] pt-1">
                  Referans: {result.transactionId}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[var(--brand-orange-subtle)] border border-[rgba(255,138,31,0.25)] text-center">
                <p className="text-xs font-bold text-[#FF8A1F]">
                   {order?.entitlementType === 'CORPORATE_SUBSCRIPTION'
                     ? 'Kurumsal mağaza özellikleriniz kullanıma hazır.'
                     : 'İlan hakkın hazır. İlanını dilediğin an oluşturup yayınlayabilirsin.'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => router.push(order?.entitlementType === 'CORPORATE_SUBSCRIPTION' ? '/hesabim/kurumsal' : '/ilan-ver/paket')}
                className="w-full btn-primary py-3.5 text-sm font-bold flex items-center justify-center gap-2 shadow-lg"
              >
                <span>{order?.entitlementType === 'CORPORATE_SUBSCRIPTION' ? 'Kurumsal Panele Dön' : 'İlanını Oluştur'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <>
              {/* PAYMENT ATTEMPT SCREEN */}
              {result?.error && (
                <div className="p-3.5 rounded-xl bg-[var(--color-danger-subtle)] text-[var(--color-danger)] text-xs font-semibold border border-[rgba(229,72,77,0.3)] flex items-center gap-2">
                  <XCircle className="w-4 h-4 shrink-0" />
                  <span>{result.error}</span>
                </div>
              )}

              <div className="p-4 rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface)] space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-[var(--text-main)]">
                  <CreditCard className="w-4 h-4 text-[#FF8A1F]" />
                  <span>Fleeca Hesap Tahsilatı</span>
                </div>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                  Ödeme, GTA World Los Santos bankacılık ağı üzerinden <strong className="text-[var(--text-main)]">{buyerName}</strong> adına kayıtlı Fleeca vadesiz hesabınızdan güvenle tahsil edilecektir.
                </p>
              </div>

              {/* FLEECA CHECKOUT CONFIRMATION */}
              <div className="p-4 rounded-xl bg-[var(--bg-surface-secondary)] border border-[var(--border-app)] space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#FF8A1F]">
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Fleeca Ödeme Bağlantısı</span>
                </div>
                <p className="text-[11px] text-[var(--text-dim)]">
                  Gerçek Fleeca ödeme sözleşmesi henüz yapılandırılmadı. Ödeme doğrulanmadan sipariş tamamlanmaz ve hak tanımlanmaz.
                </p>

                <div className="pt-1">
                  <button
                    type="button"
                    disabled={processing}
                    onClick={handleVerifyPayment}
                    className="btn-primary text-xs py-2.5 flex items-center justify-center gap-1.5"
                  >
                    {processing ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    )}
                    <span>Ödeme Durumunu Doğrula</span>
                  </button>
                </div>
              </div>
            </>
          )}

          <div className="flex items-center justify-center gap-1.5 text-[11px] text-[var(--text-dim)] pt-2 border-t border-[var(--border-app)]">
            <ShieldCheck className="w-3.5 h-3.5 text-[var(--color-success)]" />
            <span>256-bit SSL şifreli Fleeca Banking Gate</span>
          </div>
        </div>
      </div>
    </div>
  );
}
