export type FaqItem = readonly [question: string, answer: string];

export interface FaqGroup {
  title: string;
  items: readonly FaqItem[];
}

export const faqGroups: readonly FaqGroup[] = [
  { title: 'Genel', items: [['Sanboard nedir?', 'Sanboard; araç ve mülk sahiplerinin ilanlarını yayınlayabildiği, kullanıcıların ilanları inceleyip karşılaştırabildiği ve satıcılarla doğrudan iletişim kurabildiği dijital bir ilan platformudur.']] },
  { title: 'Platform', items: [['Sanboard üzerinden doğrudan satın alma yapılır mı?', 'Sanboard satışın gerçekleştiği yer değil, alıcıyla satıcının buluştuğu platformdur. İlan üzerinden satıcıya ulaşabilir veya teklif verebilirsin; anlaşma sonrasındaki ödeme ve devir işlemleri tarafların kendi arasında tamamlanır.'], ['Sanboard’da hangi tür ilanlar yayınlanabilir?', 'Sanboard, araç ve mülk ilanlarına odaklanır. Otomobil ve diğer desteklenen araç türlerinin yanı sıra ev ve benzeri mülkler, uygun kategori ve bilgilerle platformda yayınlanabilir.'], ['Sanboard’da teklif sistemi nasıl çalışır?', 'Bir ilana teklif gönderdiğinde, ilan sahibi teklifini görüntüleyebilir ve kabul, ret veya karşı teklif seçeneklerinden biriyle yanıt verebilir. Teklif kabul edildiğinde taraflara gerekli iletişim bilgileri gösterilir; ancak satış ve devir işlemleri Sanboard dışında taraflar arasında tamamlanır.'], ['Kurumsal profil nedir?', 'Kurumsal hesap; bireysel kullanıcı profilinden farklı olarak bir işletmeyi temsil eden satıcı hesabıdır. Başvuru sırasında şirket adı ve kullanım amacı gibi bilgiler değerlendirilir. Onaylanan hesaplar, ilanlarını kurumsal satıcı kimliği altında yayınlayabilir ve kendilerine ait satıcı profiline sahip olur.']] },
  { title: 'Gizlilik & Güvenlik', items: [['Bilgilerim güvende mi?', 'Evet. Sanboard, kullanıcı bilgilerini yalnızca platformun işleyişi için gerekli ölçüde kullanır ve özel iletişim bilgilerini izinsiz olarak diğer kullanıcılara göstermez.'], ['Ödemeler güvenli mi?', 'Sanboard’daki ilan yayınlama ve benzeri platform ödemeleri Fleeca ödeme sistemi üzerinden işlenir. Ödeme sırasında kullanılan finansal bilgiler Fleeca tarafından işlenir; Sanboard bu bilgileri kendi sisteminde doğrudan saklamaz.'], ['Şüpheli bir işlem fark edersem ne yapmalıyım?', 'Şüpheli bir ilan, kullanıcı davranışı veya hesap hareketi fark ettiğinde Sanboard’un raporlama ve destek kanallarını kullanabilirsin. Bildirimin incelenir ve gerekli görülmesi halinde ilgili içerik veya hesap hakkında işlem uygulanır.']] },
];

const homepageQuestions = [
  'Sanboard nedir?',
  'Sanboard üzerinden doğrudan satın alma yapılır mı?',
  'Sanboard’da hangi tür ilanlar yayınlanabilir?',
  'Sanboard’da teklif sistemi nasıl çalışır?',
  'Kurumsal profil nedir?',
  'Şüpheli bir işlem fark edersem ne yapmalıyım?',
] as const;

const allFaqItems: readonly FaqItem[] = faqGroups.flatMap((group) => group.items);

export const homepageFaqItems: readonly FaqItem[] = homepageQuestions.map((question) => {
  const item = allFaqItems.find(([candidate]) => candidate === question);
  if (!item) throw new Error(`Homepage FAQ item is missing: ${question}`);
  return item;
});