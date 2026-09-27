import type { Metadata } from 'next';
import {
  BadgeDollarSign,
  Building2,
  Clock3,
  FileCheck2,
  Gamepad2,
  LockKeyhole,
  Mail,
  Megaphone,
  ShieldAlert,
  Users,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Kullanım Koşulları | Sanboard',
  description: 'Sanboard ilan, hesap, iletişim, güvenlik ve oyun dışı kullanım koşulları.',
};

const icSections = [
  {
    title: 'Platform ve Hesaplar',
    icon: Users,
    tags: ['IC'],
    items: [
      'Sanboard, araç ve mülk ilanlarını yayınlayan ve tarafları buluşturan bir platformdur.',
      'Satışın, ödemenin veya mülkiyet devrinin tarafı değildir.',
      'Hesap kişiye özeldir; hesap güvenliği ve yapılan işlemler kullanıcı sorumluluğundadır.',
      'Başka bir kişiyi temsil etmek veya hesabı başkasına kullandırmak yasaktır.',
    ],
  },
  {
    title: 'İlan Yayınlama Kuralları',
    icon: Megaphone,
    tags: ['7 gün'],
    items: [
      'Yalnızca satış yetkinizin bulunduğu araç veya mülk için ilan yayınlayabilirsiniz.',
      'Başlık, açıklama, kategori, fiyat ve görseller doğru ve güncel olmalıdır.',
      'Bireysel ilanlar 7 gün aktif kalır; süresi dolan ilan yeniden yayınlanabilir.',
      'Yeniden yayınlama yeni bir yayın süreci olarak değerlendirilir.',
    ],
  },
  {
    title: 'İletişim ve Satış',
    icon: Mail,
    tags: ['SanMail'],
    items: [
      'Fiyat, buluşma, ödeme ve devir koşullarını alıcı ile satıcı doğrudan belirler.',
      'Telefon ve SanMail görünürlüğü kullanıcı tarafından ayrı ayrı yönetilir.',
      'Gizlenen iletişim bilgileri ilanı görüntüleyen kişilere gösterilmez.',
      'Favoriye eklemek rezervasyon, öncelik veya satın alma hakkı oluşturmaz.',
    ],
  },
  {
    title: 'Kurumsal Hesaplar',
    icon: Building2,
    tags: ['Kurumsal'],
    items: [
      'Los Santos’ta faaliyet gösteren uygun işletmeler kurumsal hesap başvurusu yapabilir.',
      'Başvurular incelemeye tabidir ve gönderim otomatik onay anlamına gelmez.',
      'Onaylı hesaplar şirket adıyla ilan ve işletme profili özelliklerine erişebilir.',
    ],
  },
  {
    title: 'İçerik ve Güvenlik',
    icon: LockKeyhole,
    tags: ['Güvenli kullanım'],
    items: [
      'İçerik yalnızca ilandaki araç veya mülkle ilgili olmalıdır.',
      'Yanıltıcı bilgi, yanlış kategori, izinsiz içerik, spam, tehdit ve taciz yasaktır.',
      'Başka hesaplara erişme veya haksız avantaj sağlama girişimleri yasaktır.',
      'Varlığı, bilgileri ve satış şartlarını doğrulamak tarafların sorumluluğundadır.',
    ],
  },
  {
    title: 'Ücretler ve Süreler',
    icon: BadgeDollarSign,
    tags: ['$2.000', '7 gün'],
    items: [
      'Standart bireysel ilan yayınlama bedeli $2.000’dır.',
      'Bu tutar yalnızca ilan hizmeti içindir; satış komisyonu değildir.',
      'Araç veya mülkün satış fiyatı standart ilan bedelini değiştirmez.',
      'Bakım veya teknik sorunlarda hizmet geçici olarak durdurulabilir.',
    ],
  },
  {
    title: 'Yaptırımlar ve İhlaller',
    icon: ShieldAlert,
    tags: ['İnceleme'],
    items: [
      'Aykırı ilanlar incelenebilir, görünmez hâle getirilebilir veya kaldırılabilir.',
      'Tekrarlayan ihlallerde ilan ve hesap özellikleri geçici ya da kalıcı sınırlandırılabilir.',
      'Sistemi kötüye kullanan tekrarlı yayınlar ve dolandırıcılık amaçlı içerikler kaldırılır.',
    ],
  },
];

const oocSections = [
  {
    title: 'Bağımsız proje',
    icon: Gamepad2,
    items: [
      'Sanboard, GTA World Türkiye oyuncuları için geliştirilmiş bağımsız bir üçüncü taraf projesidir.',
      'Rockstar Games, Take-Two Interactive veya GTA World yönetimiyle resmî ortaklığı yoktur.',
      'GTA ve ilgili markalar kendi hak sahiplerine aittir.',
    ],
  },
  {
    title: 'Oyun ekonomisi ve RMT',
    icon: BadgeDollarSign,
    items: [
      '$ simgesi yalnızca GTA World oyun ekonomisini ifade eder; gerçek para değildir.',
      'TL, USD, EUR veya başka gerçek para birimleriyle oyun içi varlık ticareti yasaktır.',
      'RMT ilanları kaldırılabilir ve ciddi durumlar GTA World yönetimine bildirilebilir.',
    ],
  },
  {
    title: 'Veri ve doğrulama',
    icon: LockKeyhole,
    items: [
      'Yalnızca platform özellikleri için gerekli sınırlı veriler kullanılır.',
      'GTA World doğrulamasında parola Sanboard tarafından alınmaz.',
      'Gerçek kimlik, adres veya banka ve kredi kartı bilgileri istenmez.',
      'SanMail ve telefon, görünürlüğü kullanıcıya bağlı IC iletişim bilgileridir.',
    ],
  },
  {
    title: 'Bug abuse ve yetki sınırı',
    icon: FileCheck2,
    items: [
      'Sistem açıklarını avantaj amacıyla kullanmak yasaktır; hatalar destek sistemine bildirilmelidir.',
      'Suistimalle oluşan ilan, bakiye ve kurumsal yetkiler geri alınabilir.',
      'Sanboard yalnızca platform erişimini yönetir; sunucu yaptırımları GTA World yönetimine aittir.',
    ],
  },
];

export default function KullanimKosullariPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <header className="mb-10 max-w-3xl">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#FF8A1F]/20 bg-[var(--brand-orange-subtle)] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.15em] text-[#FF8A1F]">
          <FileCheck2 className="h-4 w-4" /> Sanboard Rehberi
        </div>
        <h1 className="text-4xl font-black tracking-[-0.035em] text-[var(--text-main)] sm:text-5xl">Kullanım Koşulları</h1>
        <p className="mt-4 text-base text-[var(--text-muted)]">Sanboard’u kullanırken bilmeniz gereken temel kurallar.</p>
        <p className="mt-3 flex items-center gap-1.5 text-xs text-[var(--text-dim)]"><Clock3 className="h-3.5 w-3.5" /> Son güncelleme: 27 Eylül 2026</p>
      </header>

      <section aria-labelledby="ic-heading">
        <div className="mb-6 border-b border-[var(--border-app)] pb-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#FF8A1F]">IC · Los Santos</p>
          <h2 id="ic-heading" className="mt-1 text-2xl font-black text-[var(--text-main)]">İlan ve platform kuralları</h2>
        </div>
        <div className="grid items-start gap-4 md:grid-cols-2">
          {icSections.map(({ title, icon: Icon, tags, items }, index) => (
            <article key={title} className="surface-card rounded-2xl border border-[var(--border-app)] p-5 sm:p-6">
              <div className="mb-4 flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-orange-subtle)] text-[#FF8A1F]"><Icon className="h-4.5 w-4.5" /></span>
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-dim)]">0{index + 1}</span>
                  <h3 className="text-base font-bold text-[var(--text-main)] sm:text-lg">{title}</h3>
                </div>
                <div className="flex max-w-[45%] flex-wrap justify-end gap-1.5">
                  {tags.map((tag) => <span key={tag} className="rounded-md border border-[#FF8A1F]/20 bg-[var(--brand-orange-subtle)] px-2 py-1 text-[10px] font-bold text-[#FF8A1F]">{tag}</span>)}
                </div>
              </div>
              <ul className="space-y-2.5 text-sm leading-6 text-[var(--text-muted)]">
                {items.map((item) => <li key={item} className="flex gap-2.5"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[#FF8A1F]" /><span>{item}</span></li>)}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="ooc-heading" className="mt-14">
        <div className="mb-6 border-b border-[var(--border-app)] pb-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-400">OOC · Platform sınırları</p>
          <h2 id="ooc-heading" className="mt-1 text-2xl font-black text-[var(--text-main)]">Oyun dışı bilgilendirmeler</h2>
        </div>
        <div className="grid items-start gap-4 md:grid-cols-2">
          {oocSections.map(({ title, icon: Icon, items }) => (
            <article key={title} className="rounded-2xl border border-sky-400/15 bg-sky-400/[0.035] p-5 sm:p-6">
              <div className="mb-3 flex items-center gap-3"><Icon className="h-5 w-5 text-sky-300" /><h3 className="font-bold text-[var(--text-main)]">{title}</h3></div>
              <ul className="space-y-2 text-sm leading-6 text-[var(--text-muted)]">
                {items.map((item) => <li key={item} className="flex gap-2.5"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-sky-400" /><span>{item}</span></li>)}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <p className="mt-10 border-t border-[var(--border-app)] pt-6 text-xs leading-6 text-[var(--text-dim)]">Koşullar, hizmetlerdeki değişikliklere göre güncellenebilir. Güncel sürüm her zaman bu sayfada yayınlanır.</p>
    </div>
  );
}