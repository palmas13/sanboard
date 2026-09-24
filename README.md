# Sanboard – GTA World San Andreas İlan Platformu

![Sanboard Logo](public/favicon.ico)

Sanboard, **GTA World** roleplay evreninde faaliyet gösteren kurumsal, modern ve yüksek performanslı araç ve gayrimenkul ilan platformudur. 

Platform; Sahibinden, Arabam.com ve Amerikan classifieds sistemlerinin güçlü filtreleme, bilgi yoğunluğu ve kullanıcı deneyimi modellerini benimserken, FiveM script veya oyun HUD'ı hissi vermeyen, Los Santos merkezli gerçek bir teknoloji şirketinin web portalı olarak tasarlanmıştır.

> **Önemli İlke:** Sanboard doğrudan oyun içi araç veya mülk devri yapmaz. Platform satıcı ile alıcıyı buluşturur, vitrin sağlar ve iletişim kanallarını üye oyunculara açar. Gerçek satış, pazarlık ve devir işlemleri GTA World San Andreas sunucusu içerisinde gerçekleştirilir.

---

## 🚀 Temel Özellikler

1. **İki Ana İlan Kategorisi**:
   - **Araç**: `Otomobil`, `SUV / Off-Road / Kamyonet`, `Motosiklet` (Motor, Şanzıman, Fren modifiye seviyeleri 0-4, Turbo, Subwoofer, Takas durumu, Kilometre, Plaka).
   - **Mülk**: `Ev / Daire`, `İşyeri`, `Diğer Mülk` (Oda sayısı, Kat, Eşyalı, Dubleks/Normal, Balkon).
2. **Public vs. Üye Veri Ayrımı (Gating)**:
   - Ziyaretçiler vitrin fotoğrafını, ilan başlığını, fiyatını, kategorisini ve yaklaşık konumunu görebilir.
   - Telefon, SanMail, plaka, kilometre, teknik geliştirmeler, tam galeri ve detaylı açıklama **sunucu seviyesinde** filtrelenir; yalnızca giriş yapan üyelere açılır.
3. **Mock GTA World Kimlik Doğrulama**:
   - Gerçek API olmadığı için `MockGtaWorldAuthProvider` üzerinden karakter seçimi (`Mavis Pierce`, `Zade Vexnera`, `Ravi Blumon`).
   - Karakter başına bağımsız Sanboard profili.
4. **Mock Fleeca Bank Checkout**:
   - Sabit $2.000 tutarında 7 Günlük Standart İlan Paketi.
   - Fiyat frontend girdisine güvenilmez; sunucuda belirlenir (price tampering koruması).
   - Geliştirici modu ödeme simülatörü (Başarılı / Başarısız).
5. **İlan Yaşam Döngüsü (Lifecycle)**:
   - İlan yayınlandığı anda 1 adet kredi tüketilir ve tam 7 günlük süre (`expires_at = NOW() + 7 days`) başlar.
   - Süresi dolan ilanlar anında veritabanı/sorgu seviyesinde public aramalardan çıkar.
   - **Yeniden Yayınlama**: Eski ilan aktifleştirilmez; yeni bir paket satın alımıyla sıfırdan yeni ID'li bağımsız bir ilan oluşturulur.
   - **Satıldı Olarak İşaretleme**: Onay modalı sonrasında ilan kalıcı olarak yayından kalkar, fotoğrafları ve favori kayıtları temizlenir.
6. **Koyu / Açık Tema**:
   - Koyu tema varsayılandır (`#0D0E10` arka plan, `#FF8A1F` marka turuncusu).
   - `localStorage` (`sanboard-theme`) ile hatırlanır; sayfa yenilendiğinde sıfır flicker/flash.
7. **Kapsamlı Kullanıcı ve Admin Panelleri**:
   - Kullanıcı paneli (`/hesabim`): İlanlarım (Aktif / Süresi Dolan), Favorilerim, Profilim, İletişim Bilgilerim, Ödemelerim.
   - Admin paneli (`/yonetim`): İlan kaldırma, kullanıcı engelleme (ban), şikayet yönetimi ve paket fiyatı düzenleme.

---

## 🛠️ Teknoloji Yığını

- **Framework**: Next.js 16 (App Router), React 19, TypeScript
- **Stil & Tasarım**: Tailwind CSS v4, PostCSS, Lucide React Icons
- **Doğrulama**: Zod
- **Veritabanı Şeması**: PostgreSQL / Supabase SQL (`supabase/migrations/` ve `seed.sql`)
- **Entegrasyon Mimarisi**: Provider Pattern (`src/lib/integrations/`)

---

## 📦 Kurulum ve Çalıştırma

### 1. Depoyu İndirin ve Bağımlılıkları Yükleyin

```bash
cd sanboard
npm install
```

### 2. Ortam Değişkenlerini Tanımlayın

`.env.example` dosyasını `.env.local` olarak kopyalayın:

```bash
cp .env.example .env.local
```

Varsayılan geliştirme ayarlarıyla `USE_MOCK_GTAWORLD_AUTH=true` ve `USE_MOCK_FLEECA=true` aktif gelir.

### 3. Geliştirme Sunucusunu Başlatın

```bash
npm run dev
```

Tarayıcınızda [http://localhost:3000](http://localhost:3000) adresine gidin.

### 4. Testleri Çalıştırın

```bash
npm test
```

---

## 🗄️ Supabase Kurulumu & Migrations

Eğer projeyi harici bir Supabase projesine bağlamak isterseniz:

1. [Supabase](https://supabase.com) üzerinde yeni bir PostgreSQL projesi oluşturun.
2. `supabase/migrations/20260923000000_init_sanboard.sql` dosyasını SQL Editor üzerinden çalıştırın.
3. Örnek ilan ve karakterleri yüklemek için `supabase/seed.sql` dosyasını çalıştırın.
4. `.env.local` dosyasına Supabase URL ve Key değerlerinizi girin:
   ```env
   DATA_STORE=supabase
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
   SUPABASE_SECRET_KEY=your-secret-key
   ```

---

## 🔌 Gerçek API Entegrasyonu Geldiğinde

Gerçek GTA World UCP OAuth ve Fleeca Bank merchant API'ları temin edildiğinde frontend bileşenlerinde **hiçbir değişiklik yapılmasına gerek yoktur**.

Yalnızca aşağıdaki iki dosyadaki TODO işaretli alanlar implement edilmelidir:

1. **GTA World OAuth**:
   - `src/lib/integrations/gtaworld/real-provider.ts`
   - `.env.local` -> `USE_MOCK_GTAWORLD_AUTH=false`, `GTAWORLD_CLIENT_ID`, `GTAWORLD_CLIENT_SECRET`
2. **Fleeca Bank Ödeme**:
   - `src/lib/integrations/fleeca/real-provider.ts`
   - `.env.local` -> `USE_MOCK_FLEECA=false`, `FLEECA_CLIENT_ID`, `FLEECA_CLIENT_SECRET`

---

## 🛡️ Güvenlik ve İş Kuralları

- **Fiyat Manipülasyonu Koruması**: Client tarafından gönderilen miktar dikkate alınmaz; sunucu $2.000 paket fiyatını doğrudan veritabanından çeker.
- **Kredi Tüketim Güvenliği**: Aynı ilan kredisi iki kez kullanılamaz; yayınlama anında atomic olarak `USED` durumuna geçer.
- **Zod Doğrulamaları**: Başlık katı `60`, açıklama `100` karakter sınırına tabidir. Fotoğraflar maksimum `2 MB` ile sınırlandırılmıştır.
- **Veri Sızıntısı Koruması**: Üye olmayan kullanıcılara telefon, SanMail veya plaka bilgileri API yanıtında kesinlikle gönderilmez.
