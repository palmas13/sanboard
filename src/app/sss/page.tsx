import type { Metadata } from 'next';
import { BadgeHelp, Car, CircleDollarSign, Home, MessageCircle, ShieldCheck } from 'lucide-react';

export const metadata: Metadata = {
  title: 'S.S.S | Sanboard',
  description: 'Sanboard ilan, iletişim ve platform kullanımı hakkında sık sorulan sorular.',
};

const questions = [
  { icon: Car, question: 'Sanboard üzerinden araç veya mülk satın alabilir miyim?', answer: 'Sanboard alıcı ve satıcıyı buluşturan bir ilan platformudur. Pazarlık, inceleme ve devir işlemleri oyun içinde taraflar arasında gerçekleştirilir.' },
  { icon: CircleDollarSign, question: 'İlanlardaki fiyatlar hangi para birimindedir?', answer: 'Platformdaki fiyatlar GTA World oyun içi dolarını ifade eder. Sanboard gerçek para ile araç veya mülk satışı yapmaz.' },
  { icon: MessageCircle, question: 'Satıcıyla nasıl iletişime geçebilirim?', answer: 'Oturum açan kullanıcılar, ilan sahibinin paylaştığı rol içi telefon veya SanMail iletişim bilgilerini ilan detayında görüntüleyebilir.' },
  { icon: ShieldCheck, question: 'İletişim bilgilerim herkese açık mı?', answer: 'Hayır. İlanlardaki iletişim bilgileri üye olmayan ziyaretçilere ve arama motorlarına sunucu seviyesinde maskelenir.' },
  { icon: Home, question: 'İlanlar ne kadar süre yayında kalır?', answer: 'İlan paketleri mevcut kullanım koşullarına göre 7 gün geçerlidir. Süre sonunda ilanlar public aramalardan otomatik olarak çıkarılır.' },
];

export default function SssPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
      <div className="mb-8 max-w-2xl">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#FF8A1F]/20 bg-[var(--brand-orange-subtle)] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.15em] text-[#FF8A1F]"><BadgeHelp className="h-4 w-4" />Sanboard Rehberi</div>
        <h1 className="text-3xl font-black tracking-tight text-[var(--text-main)] sm:text-4xl">Sık Sorulan Sorular</h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--text-muted)] sm:text-base">İlan verme, iletişim ve platform kullanımıyla ilgili temel yanıtları burada bulabilirsiniz.</p>
      </div>
      <div className="grid gap-3">
        {questions.map((item, index) => {
          const Icon = item.icon;
          return <article key={item.question} className="group surface-card rounded-2xl p-5 sm:p-6"><div className="flex gap-4"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#FF8A1F]/15 bg-[var(--brand-orange-subtle)] text-[#FF8A1F] transition-transform duration-200 group-hover:-translate-y-0.5"><Icon className="h-5 w-5" /></div><div><p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-dim)]">{String(index + 1).padStart(2, '0')}</p><h2 className="text-base font-bold text-[var(--text-main)] sm:text-lg">{item.question}</h2><p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{item.answer}</p></div></div></article>;
        })}
      </div>
    </div>
  );
}