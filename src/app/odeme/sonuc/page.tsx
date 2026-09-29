'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Clock3, Loader2, XCircle } from 'lucide-react';

type State = 'CHECKING' | 'PENDING' | 'SUCCESS' | 'NOT_FOUND' | 'UNVERIFIED';
type Purpose = 'LISTING_PUBLICATION' | 'LISTING_BOOST' | 'CORPORATE_SUBSCRIPTION';

export default function PaymentResultPage() {
  const [state, setState] = useState<State>('CHECKING');
  const [purpose, setPurpose] = useState<Purpose>('LISTING_PUBLICATION');
  const [targetListingId, setTargetListingId] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    const check = async () => {
      attempts += 1;
      try {
        const response = await fetch('/api/payments/status', { cache: 'no-store' });
        const data = await response.json();
        if (cancelled) return;
        if (data.purpose) setPurpose(data.purpose);
        if (data.targetListingId) setTargetListingId(data.targetListingId);
        const next = response.status === 404 ? 'NOT_FOUND' : data.state;
        setState(next);
        if ((next === 'PENDING' || next === 'UNVERIFIED') && attempts < 5) setTimeout(check, 2500);
      } catch {
        if (!cancelled) setState('UNVERIFIED');
      }
    };
    void check();
    return () => { cancelled = true; };
  }, []);

  const successText = purpose === 'LISTING_BOOST'
    ? 'Ödeme başarılı. İlanınız 24 saat öne çıkarıldı.'
    : purpose === 'CORPORATE_SUBSCRIPTION'
      ? 'Ödeme başarılı. Kurumsal üyeliğiniz tanımlandı.'
      : 'Ödeme başarılı. 1 ilan hakkı hesabınıza tanımlandı.';
  const link = purpose === 'CORPORATE_SUBSCRIPTION' ? '/hesabim/kurumsal'
    : purpose === 'LISTING_BOOST' && targetListingId ? `/ilan/${targetListingId}` : '/ilan-ver/yeni';
  const linkText = purpose === 'CORPORATE_SUBSCRIPTION' ? 'Kurumsal Panele Dön'
    : purpose === 'LISTING_BOOST' ? 'İlana Dön' : 'İlan Ver';

  return <div className="min-h-[70vh] flex items-center justify-center px-4">
    <div className="surface-card max-w-lg w-full rounded-2xl border border-[var(--border-app)] p-8 text-center space-y-5">
      {state === 'CHECKING' && <><Loader2 className="w-12 h-12 mx-auto animate-spin text-[#FF8A1F]"/><h1 className="text-2xl font-black">Ödemeniz kontrol ediliyor...</h1></>}
      {state === 'PENDING' && <><Clock3 className="w-12 h-12 mx-auto text-[#FF8A1F]"/><h1 className="text-2xl font-black">Ödeme henüz tamamlanmadı.</h1></>}
      {state === 'SUCCESS' && <><CheckCircle2 className="w-12 h-12 mx-auto text-[var(--color-success)]"/><h1 className="text-2xl font-black">{successText}</h1><Link className="btn-primary inline-flex" href={link}>{linkText}</Link></>}
      {state === 'NOT_FOUND' && <><XCircle className="w-12 h-12 mx-auto text-[var(--color-danger)]"/><h1 className="text-2xl font-black">Ödeme kaydı bulunamadı.</h1></>}
      {state === 'UNVERIFIED' && <><Clock3 className="w-12 h-12 mx-auto text-[var(--text-muted)]"/><h1 className="text-2xl font-black">Ödeme durumu henüz doğrulanamadı.</h1></>}
      {(state === 'PENDING' || state === 'UNVERIFIED') && <p className="text-sm text-[var(--text-muted)]">Durum kısa süre boyunca otomatik olarak yeniden kontrol edilir. Sayfayı yenilemeniz ek hak oluşturmaz.</p>}
    </div>
  </div>;
}