import type { Metadata } from 'next';
import { BadgeHelp } from 'lucide-react';
import { FaqExperience, type FaqSection } from '@/components/faq/FaqExperience';

export const metadata: Metadata = {
  title: 'S.S.S | Sanboard',
  description: 'Sanboard ilan, iletişim ve platform kullanımı hakkında sık sorulan sorular.',
};

const sections: FaqSection[] = [
  { id: 'genel', label: 'Genel', items: [{ question: 'Sanboard nedir?', answer: 'Sanboard, Los Santos içindeki araç ve mülk ilanlarını alıcılarla buluşturan bir ilan platformudur.' }, { question: 'Sanboard üzerinden doğrudan satın alma yapılır mı?', answer: 'Hayır. Pazarlık, inceleme ve devir işlemleri oyun içinde taraflar arasında gerçekleştirilir.' }] },
  { id: 'ilanlar', label: 'İlanlar', items: [{ question: 'İlanlar ne kadar süre yayında kalır?', answer: 'Bireysel ilan paketleri mevcut kullanım koşullarına göre 7 gün geçerlidir. Süresi dolan ilanlar genel aramalardan kaldırılır.' }, { question: 'Araç ve mülk ilanı nasıl verilir?', answer: 'İlan Ver adımından uygun paketi seçip kategoriye ait bilgileri ve görselleri tamamlayarak ilanınızı yayınlayabilirsiniz.' }] },
  { id: 'alim-satim', label: 'Alım & Satım', items: [{ question: 'İlanlardaki fiyatlar hangi para birimindedir?', answer: 'Fiyatlar GTA World oyun içi dolarını ifade eder. Sanboard gerçek para ile araç veya mülk satışı yapmaz.' }, { question: 'İlan fiyatı değiştiğinde favoriler korunur mu?', answer: 'Evet. Favori ilişkisi ilana bağlıdır; fiyat değişikliği favori durumunuzu kaldırmaz.' }] },
  { id: 'iletisim', label: 'İletişim', items: [{ question: 'Satıcıyla nasıl iletişime geçebilirim?', answer: 'Satıcının herkese açık olarak seçtiği telefon ve SanMail bilgileri ilan detayında gösterilir.' }, { question: 'Telefon ve SanMail bilgilerimi ayrı ayrı gizleyebilir miyim?', answer: 'Evet. Profilim sayfasında her iletişim kanalı için bağımsız görünürlük seçebilirsiniz.' }] },
  { id: 'hesap', label: 'Hesap', items: [{ question: 'Profil bilgilerimi nereden düzenleyebilirim?', answer: 'Dashboard içindeki Profilim sayfasından profil fotoğrafınızı, telefonunuzu, SanMail adresinizi ve görünürlük tercihlerinizi yönetebilirsiniz.' }] },
  { id: 'gizlilik', label: 'Gizlilik & Güvenlik', items: [{ question: 'Gizli iletişim bilgileri tarayıcıya gönderilir mi?', answer: 'Hayır. Gizli telefon ve SanMail değerleri yalnız görsel olarak saklanmaz; sunucu yanıtı hazırlanırken de maskelenir.' }, { question: 'Ödeme geçmişini temizlemek ödeme kayıtlarını siler mi?', answer: 'Hayır. Bu işlem yalnızca geçmişi sizin görünümünüzden kaldırır; finansal güvenlik ve işlem doğrulama kayıtları korunur.' }] },
];

export default function SssPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <header className="mb-14 max-w-3xl">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#FF8A1F]/20 bg-[var(--brand-orange-subtle)] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.15em] text-[#FF8A1F]"><BadgeHelp className="h-4 w-4" />Sanboard Rehberi</div>
        <h1 className="text-4xl font-black tracking-[-0.035em] text-[var(--text-main)] sm:text-6xl">Sık Sorulan Sorular</h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--text-muted)]">İlanlar, hesap yönetimi, iletişim ve güvenlik hakkında aradığınız temel yanıtları sade bir yapıda keşfedin.</p>
      </header>
      <FaqExperience sections={sections} />
    </div>
  );
}