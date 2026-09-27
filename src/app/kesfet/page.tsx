import type { Metadata } from 'next';
import Link from 'next/link';
import { BadgeHelp, Building2, CarFront, FileCheck2, Info, LockKeyhole, Mail, ShieldCheck, Sparkles } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Bilgi Merkezi | Sanboard',
  description: 'Sanboard hakkında sık sorulan sorular, kullanım koşulları, gizlilik politikası ve platform bilgileri.',
};

const sections = [
  { key: 'sss', label: 'S.S.S', description: 'Merak edilenlere hızlı yanıtlar', icon: BadgeHelp },
  { key: 'kullanim-kosullari', label: 'Kullanım Koşulları', description: 'Platform ve ilan kuralları', icon: FileCheck2 },
  { key: 'gizlilik', label: 'Gizlilik', description: 'Veri ve görünürlük politikası', icon: ShieldCheck },
  { key: 'hakkimizda', label: 'Hakkımızda', description: 'Sanboard nasıl çalışır?', icon: Info },
] as const;

type SectionKey = (typeof sections)[number]['key'];

const faqGroups = [
  { title: 'Genel', items: [['Sanboard nedir?', 'Sanboard, Los Santos içindeki araç ve mülk ilanlarını alıcılarla buluşturan bir ilan platformudur.'], ['Sanboard üzerinden doğrudan satın alma yapılır mı?', 'Hayır. Pazarlık, inceleme, ödeme ve devir işlemleri oyun içinde taraflar arasında gerçekleştirilir.']] },
  { title: 'İlanlar ve hesap', items: [['İlanlar ne kadar süre yayında kalır?', 'Bireysel ilan paketleri mevcut kullanım koşullarına göre 7 gün geçerlidir. Süresi dolan ilanlar genel aramalardan kaldırılır.'], ['Araç veya mülk ilanı nasıl verilir?', 'İlan Ver adımından uygun kategoriyi seçip bilgileri ve görselleri tamamlayarak ilanınızı yayınlayabilirsiniz.'], ['Profil bilgilerimi nereden düzenleyebilirim?', 'Hesabım içindeki Profil Ayarları sayfasından iletişim bilgilerinizi, profil görselinizi ve görünürlük tercihlerinizi yönetebilirsiniz.']] },
  { title: 'İletişim ve güvenlik', items: [['Satıcıyla nasıl iletişime geçebilirim?', 'Satıcının herkese açık olarak seçtiği telefon ve SanMail bilgileri ilan detayında gösterilir.'], ['Gizli iletişim bilgileri tarayıcıya gönderilir mi?', 'Hayır. Gizli telefon ve SanMail değerleri sunucu yanıtı hazırlanırken maskelenir.']] },
] as const;

const terms = [
  { title: 'Platform ve hesaplar', text: 'Sanboard tarafları buluşturan bağımsız bir ilan platformudur; satışın, ödemenin veya mülkiyet devrinin tarafı değildir. Hesap güvenliği ve hesap üzerinden yapılan işlemler kullanıcı sorumluluğundadır.' },
  { title: 'İlan yayınlama', text: 'Yalnızca satış yetkinizin bulunduğu araç veya mülk için ilan yayınlayabilirsiniz. Başlık, açıklama, kategori, fiyat ve görseller doğru ve güncel olmalıdır. Bireysel ilanlar 7 gün aktif kalır.' },
  { title: 'İletişim ve satış', text: 'Fiyat, buluşma, ödeme ve devir koşullarını alıcı ile satıcı belirler. Favoriye eklemek rezervasyon, öncelik veya satın alma hakkı oluşturmaz.' },
  { title: 'İçerik ve güvenlik', text: 'Yanıltıcı bilgi, yanlış kategori, izinsiz içerik, spam, tehdit, taciz, dolandırıcılık ve başka hesaplara erişme girişimleri yasaktır.' },
  { title: 'Ücretler ve süreler', text: 'Standart bireysel ilan yayınlama bedeli $2.000’dır ve bu tutar satış komisyonu değildir. Bakım veya teknik sorunlarda hizmet geçici olarak durdurulabilir.' },
  { title: 'OOC sınırlar', text: 'Sanboard GTA World’den bağımsız bir topluluk projesidir. Gerçek para ticareti (RMT), gerçek banka verileri ve oyun dışı finansal işlemler desteklenmez.' },
] as const;

function isSectionKey(value: string | string[] | undefined): value is SectionKey {
  return typeof value === 'string' && sections.some((section) => section.key === value);
}

function FaqContent() {
  return <div className="space-y-8">{faqGroups.map((group) => <section key={group.title}><h2 className="mb-3 text-xs font-extrabold uppercase tracking-[0.18em] text-[#FF8A1F]">{group.title}</h2><div className="grid gap-3">{group.items.map(([question, answer]) => <details key={question} className="group rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] p-5 open:border-[#FF8A1F]/30"><summary className="cursor-pointer list-none pr-6 text-sm font-bold text-[var(--text-main)] marker:content-none">{question}</summary><p className="mt-3 border-t border-[var(--border-app)] pt-3 text-sm leading-6 text-[var(--text-muted)]">{answer}</p></details>)}</div></section>)}</div>;
}

function TermsContent() {
  return <div><div className="mb-6 flex items-center gap-2 text-xs text-[var(--text-dim)]"><FileCheck2 className="h-4 w-4 text-[#FF8A1F]" />Son güncelleme: 27 Eylül 2026</div><div className="grid gap-4 md:grid-cols-2">{terms.map((term, index) => <article key={term.title} className="rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] p-5"><span className="text-[10px] font-black tracking-[0.18em] text-[#FF8A1F]">0{index + 1}</span><h2 className="mt-2 font-bold text-[var(--text-main)]">{term.title}</h2><p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">{term.text}</p></article>)}</div><p className="mt-6 text-xs leading-6 text-[var(--text-dim)]">Koşullar hizmetlerdeki değişikliklere göre güncellenebilir. Güncel sürüm her zaman bu bilgi merkezinde yayınlanır.</p></div>;
}

function PrivacyContent() {
  return <div className="space-y-4"><InfoCard icon={LockKeyhole} title="İletişim bilgileriniz">Telefon ve SanMail bilgileri yalnızca seçtiğiniz görünürlük tercihleri doğrultusunda gösterilir. Gizlenen değerler sunucu seviyesinde maskelenir.</InfoCard><InfoCard icon={ShieldCheck} title="Hesap ve işlem güvenliği">Platformda gerçek banka bilgisi, kredi kartı veya oyun hesabı şifresi tutulmaz. Yetkilendirme ve karakter erişimi sunucu tarafında doğrulanır.</InfoCard><InfoCard icon={Mail} title="Roleplay verileri">Fleeca ödemeleri roleplay çerçevesinde oyun içi bankacılık protokolüyle işlenir. Güvenlik ve işlem doğrulama kayıtları hizmet bütünlüğü için korunabilir.</InfoCard></div>;
}

function AboutContent() {
  return <div className="space-y-6"><div className="rounded-2xl border border-[#FF8A1F]/20 bg-[#FF8A1F]/[0.06] p-6"><Sparkles className="h-5 w-5 text-[#FF8A1F]" /><h2 className="mt-4 text-xl font-black text-[var(--text-main)]">Los Santos’un ilan platformu</h2><p className="mt-3 text-sm leading-7 text-[var(--text-muted)]">Sanboard, GTA World evreninde araç ve mülk alım satımını kolaylaştıran bağımsız bir roleplay ilan ağıdır. Alıcı ile satıcıyı profesyonel bir ortamda buluşturur; devir işlemini doğrudan gerçekleştirmez.</p></div><div className="grid gap-4 sm:grid-cols-2"><InfoCard icon={CarFront} title="Araç pazarı">Otomobil, SUV, motosiklet ve diğer araç ilanlarını tek akışta keşfedin.</InfoCard><InfoCard icon={Building2} title="Mülk portföyü">Daire, villa, iş yeri ve Los Santos’un özel lokasyonlarını inceleyin.</InfoCard></div><Link href="/ilanlari-kesfet" className="btn-primary inline-flex px-5 py-3 text-sm">İlanları Keşfet</Link></div>;
}

function InfoCard({ icon: Icon, title, children }: { icon: typeof Info; title: string; children: React.ReactNode }) {
  return <article className="rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] p-5 sm:p-6"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--brand-orange-subtle)] text-[#FF8A1F]"><Icon className="h-5 w-5" /></span><h2 className="mt-4 font-bold text-[var(--text-main)]">{title}</h2><div className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{children}</div></article>;
}

export default async function ExploreInfoPage({ searchParams }: PageProps<'/kesfet'>) {
  const requestedSection = (await searchParams).section;
  const activeKey: SectionKey = isSectionKey(requestedSection) ? requestedSection : 'sss';
  const activeSection = sections.find((section) => section.key === activeKey)!;
  const ActiveIcon = activeSection.icon;

  return (
    <div className="relative isolate overflow-hidden px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
      <div className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[420px] w-[760px] -translate-x-1/2 rounded-full bg-[#FF8A1F]/10 blur-[120px]" />
      <main className="mx-auto max-w-7xl">
        <header className="max-w-3xl"><div className="inline-flex items-center gap-2 rounded-full border border-[#FF8A1F]/20 bg-[var(--brand-orange-subtle)] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.15em] text-[#FF8A1F]"><Sparkles className="h-4 w-4" />Sanboard Rehberi</div><h1 className="mt-5 text-4xl font-black tracking-[-0.04em] text-[var(--text-main)] sm:text-6xl">Bilgi Merkezi</h1><p className="mt-5 max-w-2xl text-base leading-7 text-[var(--text-muted)]">Platformu tanıyın, kuralları inceleyin ve merak ettiklerinize tek merkezden ulaşın.</p></header>
        <div className="mt-10 grid items-start gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">
          <nav aria-label="Bilgi merkezi bölümleri" className="grid gap-2 sm:grid-cols-2 lg:sticky lg:top-24 lg:grid-cols-1">{sections.map((section) => { const Icon = section.icon; const active = section.key === activeKey; return <Link key={section.key} href={`/kesfet?section=${section.key}`} aria-current={active ? 'page' : undefined} className={`flex items-center gap-3 rounded-2xl border p-4 transition-all ${active ? 'border-[#FF8A1F]/40 bg-[#FF8A1F]/10 shadow-[0_15px_35px_rgba(255,138,31,0.08)]' : 'border-[var(--border-app)] bg-[var(--bg-surface)] hover:border-[#FF8A1F]/25 hover:bg-[var(--bg-surface-secondary)]'}`}><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${active ? 'bg-[#FF8A1F] text-[#1A0E04]' : 'bg-[var(--brand-orange-subtle)] text-[#FF8A1F]'}`}><Icon className="h-4 w-4" /></span><span><span className="block text-sm font-bold text-[var(--text-main)]">{section.label}</span><span className="mt-0.5 block text-[11px] text-[var(--text-muted)]">{section.description}</span></span></Link>; })}</nav>
          <section className="min-w-0 rounded-[2rem] border border-[var(--border-app)] bg-[var(--bg-surface-secondary)]/35 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.14)] sm:p-8 lg:p-10"><header className="mb-8 border-b border-[var(--border-app)] pb-6"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FF8A1F]/10 text-[#FF8A1F]"><ActiveIcon className="h-5 w-5" /></span><h2 className="mt-4 text-2xl font-black tracking-[-0.025em] text-[var(--text-main)] sm:text-3xl">{activeSection.label}</h2><p className="mt-2 text-sm text-[var(--text-muted)]">{activeSection.description}</p></header>{activeKey === 'sss' && <FaqContent />}{activeKey === 'kullanim-kosullari' && <TermsContent />}{activeKey === 'gizlilik' && <PrivacyContent />}{activeKey === 'hakkimizda' && <AboutContent />}</section>
        </div>
      </main>
    </div>
  );
}