import type { Metadata } from 'next';
import { BadgeDollarSign, Building2, FileCheck2, Gamepad2, LockKeyhole, Megaphone, ShieldAlert, Users } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Kullanım Koşulları | Sanboard',
  description: 'Sanboard ilan, hesap, iletişim, güvenlik ve oyun dışı kullanım koşulları.',
};

const icSections = [
  {
    title: 'Platform ve hesaplar', icon: Users,
    paragraphs: [
      'Sanboard, Los Santos genelinde araç ve mülk ilanlarının yayınlanmasını ve ilgilenen kişilerin ilan sahipleriyle iletişim kurmasını sağlayan dijital ilan platformudur.',
      'Sanboard, ilanlarda yer alan araç veya mülklerin sahibi değildir ve taraflar adına satış gerçekleştirmez. Platformun görevi, ilanların yayınlanması ve alıcı ile satıcı arasındaki iletişimin kolaylaştırılmasıyla sınırlıdır.',
      'Bazı özelliklerden yararlanabilmek için kullanıcı hesabı oluşturulması gerekir. Kullanıcı, hesabı üzerinden gerçekleştirdiği işlemlerden ve hesabının güvenliğinden sorumludur. Hesabın başka kişilere kullandırılması veya başka bir kişiyi temsil edecek şekilde kullanılması yasaktır.',
    ],
  },
  {
    title: 'İlan yayınlama esasları', icon: Megaphone,
    paragraphs: [
      'Kullanıcılar yalnızca satışa sunma yetkisine sahip oldukları araç ve mülkler için ilan oluşturabilir. İlan bilgilerinin doğru, güncel ve ilan konusu varlığı temsil edecek şekilde hazırlanması gerekir.',
      'Bireysel ilanlar yayınlandıkları tarihten itibaren 7 gün boyunca aktif kalır. Süresi dolan ilanlar genel listelerden kaldırılır; kullanıcı ilanını yeniden yayınlayabilir. Yeniden yayınlanan ilanlar yeni bir yayın süreci olarak değerlendirilir.',
      'Standart bireysel ilanların yayınlama bedeli $2.000’dır. Bu bedel yalnızca Sanboard ilan yayınlama hizmetinin karşılığıdır, satış komisyonu değildir. Araç veya mülkün satış fiyatı standart ilan bedelini değiştirmez.',
    ],
  },
  {
    title: 'İletişim, satış ve kurumsal hesaplar', icon: Building2,
    paragraphs: [
      'Sanboard üzerinden yayınlanan ilanlarda taraflar doğrudan birbirleriyle iletişim kurar. Fiyat görüşmeleri, buluşma noktası, ödeme koşulları ve mülkiyet devri alıcı ile satıcı arasında gerçekleştirilir. Sanboard özel anlaşmaların bir parçası değildir.',
      'Kullanıcılar telefon veya SanMail bilgilerini hesaplarına ekleyebilir ve her iletişim kanalının görünürlüğünü hesap ayarlarından belirleyebilir. İlan sahibi tarafından gizlenen iletişim bilgileri ilanı görüntüleyen kişilere gösterilmez.',
      'Los Santos’ta faaliyet gösteren uygun işletmeler kurumsal hesap başvurusunda bulunabilir. Kurumsal hesaplar şirket adı altında ilan yayınlama, işletme profili oluşturma ve diğer kurumsal özelliklerden yararlanma hakkına sahip olabilir. Başvurular incelemeye tabidir; başvuru otomatik onay anlamına gelmez.',
    ],
  },
  {
    title: 'İçerik, güvenlik ve yaptırımlar', icon: ShieldAlert,
    paragraphs: [
      'İlan başlığı, açıklaması, görselleri ve diğer bilgiler doğrudan satışa sunulan araç veya mülkle ilgili olmalıdır. Yanıltıcı bilgi içeren, yanlış kategoride yayınlanan veya başka bir ilana ait içerikleri kullanan ilanlar kaldırılabilir.',
      'Favoriye ekleme rezervasyon, öncelik veya satın alma hakkı oluşturmaz. İlan sahibine toplam favori sayısı gösterilebilir.',
      'Sanboard’un normal işleyişini bozmayı, başka hesaplara erişmeyi veya haksız avantaj elde etmeyi amaçlayan işlemler yasaktır. Aykırı ilanlar incelenebilir, görünmez hâle getirilebilir veya kaldırılabilir; tekrarlayan ihlallerde ilan yayınlama yetkisi ve hesap özellikleri geçici ya da kalıcı olarak sınırlandırılabilir.',
      'Sanboard bakım, güncelleme veya teknik sorunlar nedeniyle hizmetlerini geçici olarak durdurabilir. İlan sahiplerinin girdiği bilgilerin doğruluğu garanti edilmez; varlığı incelemek, bilgileri doğrulamak ve satış şartlarını değerlendirmek tarafların sorumluluğundadır.',
    ],
    bullets: ['Yanıltıcı veya gerçeğe aykırı ilanlar', 'Başkasına ait varlıkların izinsiz listelenmesi', 'İlanla ilgisi olmayan görseller ve spam', 'Sistemi kötüye kullanacak biçimde tekrarlı yayın', 'Tehdit, hakaret, taciz veya dolandırıcılık amacı taşıyan içerikler'],
  },
];

const oocSections = [
  { title: 'Bağımsız proje ve marka hakları', icon: Gamepad2, text: 'Sanboard, GTA World Türkiye oyuncuları için bağımsız geliştirilmiş üçüncü taraf bir projedir. Rockstar Games, Take-Two Interactive veya GTA World yönetimiyle resmî ortaklığı, sponsorluğu ya da temsil ilişkisi yoktur. Sistemler GTA World karakterleri ve ekonomik yapısı temel alınarak hazırlanmıştır. GTA, Grand Theft Auto ve ilgili markalar kendi hak sahiplerine aittir.' },
  { title: 'Oyun ekonomisi ve RMT', icon: BadgeDollarSign, text: 'Sanboard’da $ simgesiyle gösterilen tutarlar yalnızca GTA World oyun ekonomisini temsil eder; gerçek ABD doları değildir. Gerçek para ile araç, mülk, oyun parası veya başka bir oyun içi varlığın alım satımı desteklenmez. TL, USD, EUR veya herhangi bir gerçek para birimiyle yapılan işlemler RMT kapsamında değerlendirilir ve yasaktır. İlgili ilanlar kaldırılabilir, hesap erişimi sınırlandırılabilir ve ciddi durumlar GTA World yönetimine bildirilebilir.' },
  { title: 'Veri, gizlilik ve hesap doğrulama', icon: LockKeyhole, text: 'Sanboard yalnızca platform özellikleri için gerekli sınırlı verileri kullanır. Desteklenen işlemlerde GTA World hesap doğrulama sistemi kullanılabilir; giriş bilgileri Sanboard tarafından doğrudan alınmaz, kimlik doğrulama ilgili servis üzerinden yapılır. Sanboard GTA World parolanızı, gerçek ad-soyadınızı, gerçek adresinizi veya banka ve kredi kartı bilgilerinizi istemez. SanMail ve telefon, karaktere ait IC iletişim bilgileridir ve görünürlükleri kullanıcı tarafından kontrol edilir.' },
  { title: 'Bug abuse ve yetki sınırı', icon: FileCheck2, text: 'Sistem açıklarının veya hataların avantaj elde etmek amacıyla kullanılması yasaktır. Hataların destek sistemi üzerinden bildirilmesi beklenir. Bug abuse sonucunda oluşan ilanlar, bakiye hareketleri, kurumsal yetkiler ve diğer değişiklikler geri alınabilir; kasıtlı veya tekrarlayan suistimalde Sanboard erişimi sınırlandırılabilir. Sanboard yaptırımları yalnızca platform erişimini ve özelliklerini kapsar; sunucu içi yaptırımlar GTA World yönetiminin yetkisindedir.' },
];

export default function KullanimKosullariPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <header className="mb-12 max-w-3xl">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#FF8A1F]/20 bg-[var(--brand-orange-subtle)] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.15em] text-[#FF8A1F]"><FileCheck2 className="h-4 w-4" />Sanboard Rehberi</div>
        <h1 className="text-4xl font-black tracking-[-0.035em] text-[var(--text-main)] sm:text-6xl">Kullanım Koşulları</h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--text-muted)]">İlan deneyimine ait rol içi kurallar ile platformun oyun dışı sınırlarını birbirine karıştırmadan, açık bir yapıda inceleyin.</p>
      </header>

      <section aria-labelledby="ic-heading">
        <div className="mb-6 flex items-end justify-between gap-4 border-b border-[var(--border-app)] pb-4">
          <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#FF8A1F]">IC · Los Santos</p><h2 id="ic-heading" className="mt-1 text-2xl font-black text-[var(--text-main)]">İlan ve platform kuralları</h2></div>
          <span className="hidden text-xs text-[var(--text-dim)] sm:block">Son güncelleme: 27 Eylül 2026</span>
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          {icSections.map(({ title, icon: Icon, paragraphs, bullets }, index) => <article key={title} className="surface-card rounded-2xl border border-[var(--border-app)] p-6 sm:p-7"><div className="mb-5 flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--brand-orange-subtle)] text-[#FF8A1F]"><Icon className="h-5 w-5" /></span><div><span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-dim)]">0{index + 1}</span><h3 className="text-lg font-bold text-[var(--text-main)]">{title}</h3></div></div><div className="space-y-4 text-sm leading-7 text-[var(--text-muted)]">{paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}{bullets && <ul className="space-y-2 border-l-2 border-[#FF8A1F]/35 pl-4">{bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>}</div></article>)}
        </div>
      </section>

      <section aria-labelledby="ooc-heading" className="mt-16">
        <div className="mb-6 border-b border-[var(--border-app)] pb-4"><p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-400">OOC · Platform sınırları</p><h2 id="ooc-heading" className="mt-1 text-2xl font-black text-[var(--text-main)]">Oyun dışı bilgilendirmeler</h2><p className="mt-2 text-sm text-[var(--text-muted)]">Bu bölüm gerçek para, üçüncü taraf marka ilişkileri, doğrulama ve teknik suistimal konularını açıklar.</p></div>
        <div className="grid gap-4 md:grid-cols-2">
          {oocSections.map(({ title, icon: Icon, text }) => <article key={title} className="rounded-2xl border border-sky-400/15 bg-sky-400/[0.035] p-6"><div className="mb-3 flex items-center gap-3 text-sky-300"><Icon className="h-5 w-5" /><h3 className="font-bold text-[var(--text-main)]">{title}</h3></div><p className="text-sm leading-7 text-[var(--text-muted)]">{text}</p></article>)}
        </div>
      </section>

      <p className="mt-10 border-t border-[var(--border-app)] pt-6 text-xs leading-6 text-[var(--text-dim)]">Sanboard, hizmetlerinde yapılan değişikliklere bağlı olarak kullanım koşullarını güncelleyebilir. Güncel koşullar her zaman bu sayfa üzerinden yayınlanır.</p>
    </div>
  );
}