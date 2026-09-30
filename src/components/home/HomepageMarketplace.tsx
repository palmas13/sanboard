import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Building2, Car, CheckCircle2, Home, Sparkles, Store } from 'lucide-react';
import { CorporateProfile, PublicListingSummary } from '@/types';
import { resolveMediaUrl } from '@/lib/media/url';
import { getCorporateUrl } from '@/lib/urls';
import { HomepageFeaturedRotator } from './HomepageFeaturedRotator';
import { HomepageListingRotator } from './HomepageListingRotator';

function SectionHeader({ icon: Icon, title, subtitle, href }: { icon: typeof Sparkles; title: string; subtitle: string; href: string }) {
  return (
    <header className="homepage-section-header">
      <div className="flex min-w-0 gap-2.5">
        <Icon className="mt-0.5 h-5 w-5 shrink-0 text-[#ff8a1f]" />
        <div>
          <h2 className="text-sm font-extrabold text-[var(--text-main)]">{title}</h2>
          <p className="mt-1 text-[10px] leading-4 text-[var(--text-muted)]">{subtitle}</p>
        </div>
      </div>
      <Link href={href} className="homepage-see-all">Tümünü Gör <ArrowRight className="h-3 w-3" /></Link>
    </header>
  );
}

function CorporateSellerList({ sellers, counts }: { sellers: CorporateProfile[]; counts: Record<string, number> }) {
  if (!sellers.length) return <div className="homepage-empty-state">Henüz görünür kurumsal satıcı bulunmuyor.</div>;
  return (
    <div className="space-y-2.5">
      {sellers.map((seller) => {
        const logo = resolveMediaUrl(seller.logo_path || seller.logo_url);
        return (
          <Link key={seller.id} href={getCorporateUrl(seller)} className="homepage-corporate-row group">
            <span className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#ff8a1f]/30 bg-[var(--bg-surface-secondary)]">
              {logo ? <Image src={logo} alt={`${seller.company_name} logosu`} fill sizes="48px" quality={88} className="object-cover object-center" /> : <Building2 className="h-5 w-5 text-[#ff8a1f]" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5"><strong className="truncate text-[13px] text-[var(--text-main)]">{seller.company_name}</strong>{seller.is_verified && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 fill-[#ff8a1f] text-[#191006]" aria-label="Doğrulanmış satıcı" />}</span>
              <span className="mt-1 block text-[11px] text-[var(--text-muted)]">{counts[seller.id] || 0} aktif ilan</span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-[#ff8a1f] transition-transform group-hover:translate-x-0.5" />
          </Link>
        );
      })}
    </div>
  );
}

export function HomepageMarketplace({ featuredListings, vehicleListings, propertyListings, corporateSellers, corporateListingCounts }: { featuredListings: PublicListingSummary[]; vehicleListings: PublicListingSummary[]; propertyListings: PublicListingSummary[]; corporateSellers: CorporateProfile[]; corporateListingCounts: Record<string, number> }) {
  return (
    <section className="mx-auto max-w-[1560px] px-4 sm:px-6 lg:px-8" aria-label="Sanboard ilan vitrini">
      <div className="homepage-marketplace-grid">
        <div className="homepage-marketplace-column"><SectionHeader icon={Sparkles} title="Öne Çıkan İlanlar" subtitle="Öne çıkarılmış vitrin ilanları" href="/ilanlari-kesfet" /><div className="homepage-marketplace-content"><HomepageFeaturedRotator listings={featuredListings} /></div></div>
        <div className="homepage-marketplace-column"><SectionHeader icon={Car} title="Yeni Araç İlanları" subtitle="En yeni araç ilanlarını keşfet" href="/arac" /><div className="homepage-marketplace-content"><HomepageListingRotator listings={vehicleListings} emptyMessage="Henüz yeni araç ilanı bulunmuyor." label="araç ilanları" /></div></div>
        <div className="homepage-marketplace-column"><SectionHeader icon={Home} title="Yeni Mülk İlanları" subtitle="En yeni mülk ilanlarını keşfet" href="/mulk" /><div className="homepage-marketplace-content"><HomepageListingRotator listings={propertyListings} emptyMessage="Henüz yeni mülk ilanı bulunmuyor." label="mülk ilanları" /></div></div>
        <div className="homepage-marketplace-column"><SectionHeader icon={Store} title="Kurumsal Satıcılar" subtitle="Aktif üyeliğe sahip kurumsal satıcılar" href="/ilanlari-kesfet" /><div className="homepage-marketplace-content"><CorporateSellerList sellers={corporateSellers} counts={corporateListingCounts} /></div></div>
      </div>
    </section>
  );
}