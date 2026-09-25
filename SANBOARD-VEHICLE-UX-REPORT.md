# SANBOARD — Araç İlan Listeleme UX Yenilemesi, Akıllı Benzer İlanlar ve Kalıcı İlan Karşılaştırma Raporu

**Tarih:** 25 Eylül 2026  
**Durum:** Başarılı (0 Hata, 0 Test Başarısızlığı, 0 Build Hatası)  
**Önerilen Commit Mesajı:** `feat: araç listeleme ve ilan karşılaştırma deneyimini geliştir`

---

## 1. Değiştirilen Dosyalar

1. `src/types/index.ts`
   - `PublicListingSummary` arayüzüne opsiyonel `brand?: string` ve `model?: string` alanları eklendi.
2. `src/lib/db/listings.ts`
   - `ListingFilterParams` arayüzüne `sellerType` ve `'oldest'` sıralama seçeneği eklendi.
   - `sanitizeListingForPublic` fonksiyonuna `brand` ve `model` atamaları eklendi.
   - `getPublicListings` fonksiyonuna `sellerType` filtresi ve `'oldest'` sıralama desteği eklendi.
   - `getSimilarListings(currentListingId, limit)` akıllı benzer ilan algoritması eklendi.
   - `getCompareListings(ids)` karşılaştırma için güvenli ilan çekme fonksiyonu eklendi.
3. `src/lib/db/repositories/types.ts`
   - `IListingRepository` arayüzüne `getSimilarListings` ve `getCompareListings` opsiyonel metotları eklendi.
4. `src/lib/db/repositories/memory/memory-listing-repo.ts`
   - `getSimilarListings` ve `getCompareListings` metotları memory repository adapter'ına eklendi.
5. `src/components/listings/FilterSidebar.tsx`
   - Satıcı Tipi filtresi (`Tümü`, `Bireysel`, `Kurumsal`) entegre edildi.
   - URL parametreleri ile senkronizasyon ve sıfırlama mekanizması bağlandı.
6. `src/components/listings/ListingSortBar.tsx`
   - `En Eski` ("oldest") sıralama seçeneği eklendi.
   - Liste (`List`) ve Kart (`LayoutGrid`) görünüm toggle butonları entegre edildi.
7. `src/app/layout.tsx`
   - `CompareProvider` ve kalıcı yüzen `CompareTray` bileşeni tüm sisteme entegre edildi.
8. `src/app/arac/page.tsx`
   - Sayfa çıktısı `VehicleListingsView` ile zenginleştirildi; satıcı tipi filtresi URL'den okunup repository sorgusuna bağlandı.
9. `src/app/ilan/[id]/page.tsx`
   - Araç ilanlarında başlık/fiyat bölümüne `CompareButton` yerleştirildi.
   - Sayfa sonuna sunucu taraflı benzer ilanları getiren `<SimilarListings />` vitrini eklendi.
10. `package.json`
    - Test betiğine `tests/vehicle-ux.test.ts` dahil edildi.

---

## 2. Yeni Eklenen Bileşenler ve Rotalar

1. `src/components/listings/VehicleListingRow.tsx`: Masaüstünde yatay satır (125–155 px yükseklik), mobilde responsive kompakt kart hibrit listing bileşeni.
2. `src/components/listings/ActiveFilterChips.tsx`: Aktif filtreleri etiket olarak gösteren ve tek tek veya topluca kaldırılmasını sağlayan çip bileşeni.
3. `src/components/listings/VehicleListingsView.tsx`: Araç ilanlarında varsayılan olarak liste görünümünü açan, grid görünümüne geçiş sağlayan ve tercihi `localStorage`'da saklayan istemci görünüm yöneticisi.
4. `src/components/listings/SimilarListingCard.tsx`: Benzer ilan önerileri için optimize edilmiş kompakt araç kartı (~240-260px).
5. `src/components/listings/SimilarListings.tsx`: İlan detayının altında yer alan, scroll-reveal ve kademeli (stagger) animasyonlu yatay carousel vitrini.
6. `src/components/compare/CompareContext.tsx`: Karşılaştırma durumunu yöneten, maksimum 2 aracı `localStorage` üzerinde izole tutan React Context Provider.
7. `src/components/compare/CompareButton.tsx`: İlan detayında yer alan, aracı karşılaştırmaya ekleyip çıkaran akıllı buton.
8. `src/components/compare/CompareTray.tsx`: En az 1 ilan seçildiğinde sayfanın alt ortasında beliren, slotları ve "Karşılaştır" aksiyonunu sunan yüzen panel.
9. `src/components/compare/VehicleComparisonTable.tsx`: Gerçek araç teknik verilerini yan yana kıyaslayan, farklı değerleri görsel olarak hafifçe vurgulayan tablo.
10. `src/app/arac/karsilastir/page.tsx`: `/arac/karsilastir` rotası; iki aracı yan yana kartlar ve teknik tabloyla sunan tam sayfa karşılaştırma arayüzü.
11. `src/app/api/listings/similar/route.ts`: Benzer ilanları çeken API rotası (`GET /api/listings/similar?id=...&limit=4`).
12. `src/app/api/listings/compare/route.ts`: Karşılaştırılacak ilanları güvenlik ve görünürlük kurallarına uygun çeken API rotası (`GET /api/listings/compare?ids=...`).
13. `tests/vehicle-ux.test.ts`: Görevin 24 zorunlu senaryosunu test eden kapsamlı birim test dosyası.

---

## 3. Araç İlanları Listeleme UI Değişiklikleri

- **Satır Tasarımı:** Klasik büyük kartlar yerine masaüstünde yatay satır/card hibriti oluşturuldu (~125–155 px yükseklik).
- **Görsel Alanı:** 16:10 en-boy oranında, ~180–200 px genişliğinde, CDN URL'li, lazy loading destekli ve hover anında `scale(1.025)` mikro animasyonlu kapak görseli.
- **Kolon Düzeni:**
  - Marka + Model: En belirgin kalın tipografi.
  - İlan Başlığı: İkincil açıklayıcı başlık.
  - Kategori Chip'i: Otomobil, SUV / Off-Road / Kamyonet, Motosiklet.
  - Satıcı Tipi Badge'i: Bireysel (User ikonu) veya Kurumsal (Building2 ikonu).
  - İlan Numarası ve Yayın Tarihi: İkincil renk tonunda formatlanmış tarih.
  - Fiyat: Vurgulu `#FF8A1F` turuncu renk (önceki fiyat indirimi varsa üzeri çizili olarak gösterilir).
  - Favori Butonu: Event propagation (`e.stopPropagation()`) yönetilerek satır tıklamasından izole edildi.
- **Kritik Kural:** Araç yılı ana satır kolonu olarak GÖSTERİLMEDİ.

---

## 4. Filtre Sistemi

- Sol tarafta masaüstünde `sticky top-20` konumlanan filtre paneli.
- Kategori, Marka (araç kataloğundan dinamik), Model (seçilen markaya göre dinamik), Min/Maks Fiyat, Satıcı Tipi (Tümü, Bireysel, Kurumsal), Kilometre, Turbo, Subwoofer ve Takas filtreleri.
- Liste üzerinde seçili filtreleri gösteren ve tek tıkla silinmesini sağlayan `ActiveFilterChips` alanı.

---

## 5. Query Param Yapısı

Filtreler URL query parametreleri üzerinden yönetilir:
- `subcategory`: Araç kategorisi (`Otomobil`, `Motosiklet`, vb.)
- `brand`: Araç markası (örn: `Pegassi`)
- `model`: Araç modeli (örn: `Bati 801`)
- `minPrice`: Minimum fiyat (örn: `10000`)
- `maxPrice`: Maksimum fiyat (örn: `50000`)
- `sellerType`: Satıcı tipi (`INDIVIDUAL` veya `CORPORATE`)
- `q`: Serbest arama metni
- `sort`: Sıralama (`newest`, `oldest`, `price_asc`, `price_desc`, `popular`)

---

## 6. Akıllı Benzer İlan Algoritması (Similar Listings)

1. **Aday Havuzu Oluşturma (Candidate Pool):**
   - Sadece `category === 'vehicle'` olan aktif ilanlar.
   - Mevcut ilan (`currentListingId`) kesinlikle hariç tutulur.
   - `REMOVED`, `SOLD`, `EXPIRED`, `DRAFT` olan ilanlar elenir.
   - Kurumsal mağazası `SUSPENDED` veya `DELETED` olan ilanlar elenir.
2. **Puanlama (Scoring):**
   - **Aynı Alt Kategori:** +50 Puan
   - **Aynı Model:** +40 Puan
   - **Aynı Marka:** +30 Puan
   - **Fiyat Yakınlığı:**
     - Fark %0–10: +40 Puan
     - Fark %10–25: +25 Puan
     - Fark %25–40: +15 Puan
     - Fark >%40: +5 Puan
   - **Teknik Özellik Yakınlığı:** Aynı yakıt tipi (+5), aynı turbo durumu (+3).
3. **Sıralama ve Fallback:**
   - Puanı en yüksek olan adaylar ilk sıralara yerleşir. Eşitlik durumunda en yeni yayınlanan ilan önceliklendirilir.

---

## 7. Compare (İlan Karşılaştırma) Durum Mimarisi

- **Kalıcı `localStorage` Anahtarları:**
  - `sanboard_compare_vehicle_ids`: Karşılaştırılacak araç ID'lerinin dizisi (maksimum 2 adet, örn. `["id-1", "id-2"]`).
  - `sanboard_compare_vehicle_previews`: Tray'de anında görsel/başlık gösterebilmek için hafif önizleme verisi.
- **Kural & Limitler:**
  - Maksimum 2 araç.
  - Aynı ilan iki kez eklenemez (duplicate önleme).
  - Slot temizlendiğinde (`[X]`), kalan ilan korunur ve yeni bir araç eklenebilir.
  - Sayfa gezintilerinde ve tarayıcı yenilemelerinde (F5) state korunur.
  - Mülk (`property`) ilanları karşılaştırma akışına giremez.
  - Favoriler sistemi ile karşılaştırma sistemi tamamen bağımsızdır.

---

## 8. Compare Page (`/arac/karsilastir`) Yapısı

- **Üst Kısım:** İki araç kartı yan yana (Kapak fotoğrafı, başlık, marka/model, fiyat, kategori, satıcı rozeti, "İlana Git" ve "Kaldır").
- **Eksik Slot Durumu:** Tek ilanla girildiğinde 2. slot "İkinci Bir Araç Seçin" ve "Araç İlanlarına Dön" CTA'sı gösterir.
- **Geçersiz İlan Durumu:** Silinmiş veya süresi dolmuş ilanlar güvenli bir hata kartı ve "Listeden Kaldır" butonu ile ele alınır.
- **Teknik Karşılaştırma Tablosu (`VehicleComparisonTable`):**
  - Yapışkan (sticky) tablo başlığı.
  - İki değer birbirinden farklıysa subtle yüzey vurgusu (`#FF8A1F/[0.03]`).
  - Kesinlikle taraflı veya yargılayıcı ifadeler ("WINNER", "DAHA İYİ") kullanılmaz.

---

## 9. Kullanılan Gerçek Araç Teknik Nitelikleri

Sistemde uydurma veya tahminî alanlar yerine gerçek `VehicleDetails` alanları kullanılmıştır:
- Fiyat (`price`)
- Araç Kategorisi (`subcategory`)
- Marka (`brand`)
- Model (`model`)
- Kilometre (`mileage`)
- Motor Sağlığı (`engine_health`)
- Motor Güçlendirmesi (`engine_upgrade`: 0–4)
- Fren Güçlendirmesi (`brake_upgrade`: 0–4)
- Şanzıman Güçlendirmesi (`transmission_upgrade`: 0–4)
- Turbo (`turbo`: boolean)
- Subwoofer (`subwoofer`: boolean)
- Takas İmkanı (`trade_available`: boolean)
- Yakıt Tipi (`fuel_type`: 'BENZIN' | 'DIZEL' | 'ELEKTRIK')
- Süspansiyon (`suspension`)
- Kilit Seviyesi (`lock_level`)
- Alarm Seviyesi (`alarm_level`)
- İmmobilizer / Anti-Theft (`anti_theft_level`)
- Plaka Türü (`plate`)
- Fabrika Fiyatı (`factory_price`)

---

## 10. Responsive Davranış ve Animasyonlar

- **Masaüstü:** Yatay satır listeleme, sticky filtre paneli, yüzen karşılaştırma tray'i, 4 kartlı benzer ilan vitrini.
- **Mobil:** Yatay tablo taşmasını önleyen dikey kompakt kart düzeni, filtre çekmecesi (drawer).
- **Animasyonlar:**
  - Listing row hover: 200ms `ease-out`, `translateY(-1px)`, hafif border turuncusu.
  - Kapak fotoğrafı: `scale(1.025)`.
  - Benzer ilanlar: Scroll ile yaklaşıldığında IntersectionObserver ile tetiklenen 0–150ms kademeli (stagger) geçiş.
  - `prefers-reduced-motion`: Tüm CSS geçişlerinde ve animasyonlarda `motion-reduce:transition-none` ile desteklenmiştir.

---

## 11. Veritabanı, Repository ve Migration Durumu

- **Migration Gerekli Oldu Mu?:** Hayır. Karşılaştırma durumu istemci tarafında (`localStorage`) yönetilmekte olup, benzer ilanlar mevcut veritabanı sorguları ve filtreleme fonksiyonları üzerinden çalışmaktadır. Gereksiz veya duplicate migration üretilmemiştir.
- **Repository Değişikliği:** `IListingRepository` arayüzüne `getSimilarListings` ve `getCompareListings` metotları eklenmiş, `MemoryListingRepository` üzerinden ilgili motorlara bağlanmıştır.

---

## 12. Test ve Build Sonuçları

- **Test Koşumu:** `npm test`
  - **Mevcut Testler:** 155 test
  - **Yeni Eklenen Araç UX & Compare Testleri:** 24 test
  - **Toplam Test:** 179 test
  - **Başarısızlık:** 0
  - **Hata:** 0
- **Üretim Derlemesi:** `npm run build`
  - **TypeScript Hataları:** 0
  - **Sayfa Derleme Hataları:** 0
  - **Oluşturulan Rotalar:** 52/52 sayfa başarıyla statik/dinamik derlendi.

---

## 13. Performans ve Güvenlik Önlemleri

- **N+1 Sorgu Önleme:** `getPublicListings` ve `getCompareListings` toplu ID filtreleri ile çalışır, her ilan için tek tek sorgu atılmaz.
- **Sınırlandırılmış Aday Havuzu:** Benzer ilan algoritması tüm tabloyu belleğe çekmez; veritabanı/store seviyesinde kategori ve durum filtreleri ile aday kümesini daraltır.
- **Görünürlük ve Moderasyon:** `REMOVED`, `EXPIRED` veya askıya alınmış (`SUSPENDED`/`DELETED`) kurumsal mağazaların ilanları benzer ilanlarda ve karşılaştırma sayfasında gösterilmez.
- **CDN Entegrasyonu:** Tüm görseller `cdn.sanboard.xyz` Worker alanı üzerinden çözümlenir (`resolveMediaUrl`), `r2.dev` doğrudan sunulmaz.
