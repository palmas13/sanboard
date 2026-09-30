import type { Metadata } from 'next';
import Link from 'next/link';
import { BadgeHelp, FileCheck2, Info, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { FaqAccordion } from '@/components/faq/FaqAccordion';

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
  { title: 'Genel', items: [['Sanboard nedir?', 'Sanboard; araç ve mülk sahiplerinin ilanlarını yayınlayabildiği, kullanıcıların ilanları inceleyip karşılaştırabildiği ve satıcılarla doğrudan iletişim kurabildiği dijital bir ilan platformudur.']] },
  { title: 'Platform', items: [['Sanboard üzerinden doğrudan satın alma yapılır mı?', 'Sanboard satışın gerçekleştiği yer değil, alıcıyla satıcının buluştuğu platformdur. İlan üzerinden satıcıya ulaşabilir veya teklif verebilirsin; anlaşma sonrasındaki ödeme ve devir işlemleri tarafların kendi arasında tamamlanır.'], ['Sanboard’da hangi tür ilanlar yayınlanabilir?', 'Sanboard, araç ve mülk ilanlarına odaklanır. Otomobil ve diğer desteklenen araç türlerinin yanı sıra ev ve benzeri mülkler, uygun kategori ve bilgilerle platformda yayınlanabilir.'], ['Sanboard’da teklif sistemi nasıl çalışır?', 'Bir ilana teklif gönderdiğinde, ilan sahibi teklifini görüntüleyebilir ve kabul, ret veya karşı teklif seçeneklerinden biriyle yanıt verebilir. Teklif kabul edildiğinde taraflara gerekli iletişim bilgileri gösterilir; ancak satış ve devir işlemleri Sanboard dışında taraflar arasında tamamlanır.'], ['Kurumsal profil nedir?', 'Kurumsal hesap; bireysel kullanıcı profilinden farklı olarak bir işletmeyi temsil eden satıcı hesabıdır. Başvuru sırasında şirket adı ve kullanım amacı gibi bilgiler değerlendirilir. Onaylanan hesaplar, ilanlarını kurumsal satıcı kimliği altında yayınlayabilir ve kendilerine ait satıcı profiline sahip olur.']] },
  { title: 'Gizlilik & Güvenlik', items: [['Bilgilerim güvende mi?', 'Evet. Sanboard, kullanıcı bilgilerini yalnızca platformun işleyişi için gerekli ölçüde kullanır ve özel iletişim bilgilerini izinsiz olarak diğer kullanıcılara göstermez.'], ['Ödemeler güvenli mi?', 'Sanboard’daki ilan yayınlama ve benzeri platform ödemeleri Fleeca ödeme sistemi üzerinden işlenir. Ödeme sırasında kullanılan finansal bilgiler Fleeca tarafından işlenir; Sanboard bu bilgileri kendi sisteminde doğrudan saklamaz.'], ['Şüpheli bir işlem fark edersem ne yapmalıyım?', 'Şüpheli bir ilan, kullanıcı davranışı veya hesap hareketi fark ettiğinde Sanboard’un raporlama ve destek kanallarını kullanabilirsin. Bildirimin incelenir ve gerekli görülmesi halinde ilgili içerik veya hesap hakkında işlem uygulanır.']] },
] as const;

const terms = [
  { title: 'Platformun Amacı', text: 'Sanboard, araç ve mülk ilanlarının yayınlanması, görüntülenmesi ve kullanıcıların birbirleriyle iletişim kurması için hizmet veren bir ilan platformudur. Sanboard, ilan konusu varlıkların doğrudan alıcısı, satıcısı veya sahibi değildir.' },
  { title: 'Kullanıcı Sorumluluğu', text: 'Kullanıcılar hesapları üzerinden gerçekleştirdikleri işlemlerden, yayınladıkları ilanlardan ve paylaştıkları bilgilerin doğruluğundan sorumludur.' },
  { title: 'İlan Verme Yetkisi', text: 'Kullanıcı yalnızca satışa sunmaya yetkili olduğu araç veya mülkler için ilan yayınlayabilir. Başkasına ait bir varlığın izinsiz şekilde ilana eklenmesi yasaktır.' },
  { title: 'Yasaklı İçerikler', text: 'Dolandırıcılık amacı taşıyan, yanıltıcı, hakaret içeren, yasa dışı faaliyetleri teşvik eden veya platformun amacı dışında kullanılan içerik sahipleri Sanboard platformundan yasaklanır.' },
  { title: 'Teklif Sistemi', text: 'Sanboard üzerinden gönderilen teklifler taraflar arasındaki görüşmeyi kolaylaştırır. Bir teklifin kabul edilmesi, satışın veya mülkiyet devrinin Sanboard tarafından tamamlandığı anlamına gelmez.' },
  { title: 'Satış ve Devir İşlemleri', text: 'Alıcı ve satıcı arasındaki nihai ödeme, teslim ve devir işlemleri tarafların kendi sorumluluğundadır. Sanboard bu işlemlerin tarafı değildir.' },
  { title: 'İlan Süresi', text: 'İlanlar belirlenen yayın süresi boyunca aktif kalır. Süresi dolan, satılan, kaldırılan veya kurallara aykırı bulunan ilanlar yayından kaldırılabilir.' },
  { title: 'Kurumsal Hesaplar', text: 'Kurumsal satıcı olarak işlem yapmak isteyen kullanıcıların gerekli başvuru sürecini tamamlaması gerekir. Sanboard, başvuruları inceleme ve uygun bulunmayan başvuruları reddetme hakkını saklı tutar.' },
  { title: 'Hesap Güvenliği', text: 'Kullanıcı, hesabının ve karakter erişiminin güvenliğinden sorumludur. Yetkisiz kullanım veya şüpheli hareket fark edildiğinde destek ekibine bildirilmelidir.' },
  { title: 'Hizmetin Kötüye Kullanılması', text: 'Spam, sahte teklif, sistem açıklarından yararlanma, diğer kullanıcıları yanıltma veya platform işleyişini bozacak davranışlar yasaktır.' },
] as const;

const privacyItems = [
  { title: 'İletişim Bilgilerinin Görünürlüğü', text: 'Telefon ve SanMail gibi iletişim bilgileri, yalnızca görünürlük tercihleri ve ilgili işlem akışı doğrultusunda paylaşılır. Kabul edilen bir teklif sonrasında ilan sahibinin görünür iletişim bilgileri ilgili kullanıcıya gösterilebilir.', icon: LockKeyhole },
  { title: 'Özel Bilgilerin Korunması', text: 'Özel olarak belirlenen iletişim bilgileri diğer kullanıcılara açılmaz. Sanboard yalnızca ilgili işlem için gerekli olan ve paylaşılmasına izin verilen bilgileri görünür hale getirir.', icon: ShieldCheck },
  { title: 'Ödeme Bilgileri', text: 'Fleeca üzerinden gerçekleştirilen ödemelerde finansal bilgiler ödeme sağlayıcısı tarafından işlenir. Sanboard, ödeme bilgilerinin tamamını kendi sisteminde saklamaz; yalnızca işlem durumu ve sonucu gibi gerekli kayıtları takip eder.', icon: Mail },
  { title: 'Hesap Güvenliği', text: 'Kullanıcılar hesaplarının güvenliğini korumakla sorumludur. Yetkisiz erişim veya şüpheli bir işlem fark edilmesi halinde Sanboard destek kanalları üzerinden bildirim yapılmalıdır.', icon: ShieldCheck },
] as const;

const aboutItems = [
  { title: 'Sanboard’un Amacı', text: 'Sanboard, San Andreas genelindeki araç ve mülk ilanlarını tek bir platformda bir araya getirerek alıcılarla satıcıların daha kolay, düzenli ve hızlı şekilde buluşmasını sağlar. Kullanıcılar sahip oldukları araç veya mülkleri ilana çıkarabilir, ilgilendikleri ilanları keşfedebilir ve ihtiyaçlarına uygun seçenekleri karşılaştırabilir.', icon: Info },
  { title: 'Nasıl Çalışır?', text: 'Kullanıcılar ilanları kategori, fiyat ve diğer özelliklere göre inceleyebilir; favorilerine ekleyebilir, karşılaştırabilir ve uygun gördükleri ilanlar için teklif gönderebilir. Teklif kabul edildiğinde taraflar iletişime geçerek süreci kendi aralarında tamamlar. Sanboard, ilan ve iletişim sürecini kolaylaştırır; doğrudan satış veya devir işleminin tarafı değildir.', icon: BadgeHelp },
] as const;

function isSectionKey(value: string | string[] | undefined): value is SectionKey {
  return typeof value === 'string' && sections.some((section) => section.key === value);
}

function FaqContent() {
  return <div className="space-y-8">{faqGroups.map((group) => <section key={group.title}><h2 className="mb-3 text-xs font-extrabold uppercase tracking-[0.18em] text-[#FF8A1F]">{group.title}</h2><FaqAccordion items={group.items} /></section>)}</div>;
}

function TermsContent() {
  return <div className="grid gap-4 md:grid-cols-2">{terms.map((term, index) => <article key={term.title} className="rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] p-5"><span className="text-[10px] font-black tracking-[0.18em] text-[#FF8A1F]">{String(index + 1).padStart(2, '0')}</span><h2 className="mt-2 font-bold text-[var(--text-main)]">{term.title}</h2><p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">{term.text}</p></article>)}</div>;
}

function PrivacyContent() {
  return <div className="space-y-4">{privacyItems.map((item) => <InfoCard key={item.title} icon={item.icon} title={item.title}>{item.text}</InfoCard>)}</div>;
}

function AboutContent() {
  return <div className="grid gap-4 sm:grid-cols-2">{aboutItems.map((item) => <InfoCard key={item.title} icon={item.icon} title={item.title}>{item.text}</InfoCard>)}</div>;
}

function InfoCard({ icon: Icon, title, children }: { icon: typeof Info; title: string; children: React.ReactNode }) {
  return <article className="rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] p-5 sm:p-6"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--brand-orange-subtle)] text-[#FF8A1F]"><Icon className="h-5 w-5" /></span><h2 className="mt-4 font-bold text-[var(--text-main)]">{title}</h2><div className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{children}</div></article>;
}

export default async function ExploreInfoPage({ searchParams }: PageProps<'/kesfet'>) {
  const requestedSection = (await searchParams).section;
  const activeKey: SectionKey = isSectionKey(requestedSection) ? requestedSection : 'sss';

  return (
    <div className="relative isolate overflow-hidden px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
      <div className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[420px] w-[760px] -translate-x-1/2 rounded-full bg-[#FF8A1F]/10 blur-[120px]" />
      <main className="mx-auto max-w-7xl">
        <header className="max-w-3xl"><h1 className="text-4xl font-black tracking-[-0.04em] text-[var(--text-main)] sm:text-6xl">Keşfet Akışı</h1><p className="mt-5 max-w-2xl text-base leading-7 text-[var(--text-muted)]">Platformu tanıyın, kuralları inceleyin ve merak ettiklerinize tek merkezden ulaşın.</p></header>
        <div className="mt-10 grid items-start gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">
          <nav aria-label="Bilgi merkezi bölümleri" className="grid gap-2 sm:grid-cols-2 lg:sticky lg:top-24 lg:grid-cols-1">{sections.map((section) => { const Icon = section.icon; const active = section.key === activeKey; return <Link key={section.key} href={`/kesfet?section=${section.key}`} aria-current={active ? 'page' : undefined} className={`flex items-center gap-3 rounded-2xl border p-4 transition-all ${active ? 'border-[#FF8A1F]/40 bg-[#FF8A1F]/10 shadow-[0_15px_35px_rgba(255,138,31,0.08)]' : 'border-[var(--border-app)] bg-[var(--bg-surface)] hover:border-[#FF8A1F]/25 hover:bg-[var(--bg-surface-secondary)]'}`}><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${active ? 'bg-[#FF8A1F] text-[#1A0E04]' : 'bg-[var(--brand-orange-subtle)] text-[#FF8A1F]'}`}><Icon className="h-4 w-4" /></span><span><span className="block text-sm font-bold text-[var(--text-main)]">{section.label}</span><span className="mt-0.5 block text-[11px] text-[var(--text-muted)]">{section.description}</span></span></Link>; })}</nav>
          <section data-testid="info-content-panel" className="min-w-0 rounded-[2rem] border border-[var(--border-app)] bg-[var(--bg-surface-secondary)]/35 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.14)] sm:p-7 lg:p-8">{activeKey === 'sss' && <FaqContent />}{activeKey === 'kullanim-kosullari' && <TermsContent />}{activeKey === 'gizlilik' && <PrivacyContent />}{activeKey === 'hakkimizda' && <AboutContent />}</section>
        </div>
      </main>
    </div>
  );
}