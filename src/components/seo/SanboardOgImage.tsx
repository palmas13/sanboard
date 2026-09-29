import type { ListingShareData } from '@/lib/seo/listing-share';

export function SanboardOgImage({ listing }: { listing?: ListingShareData | null }) {
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', overflow: 'hidden', background: '#090b0f', color: '#f8fafc', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', background: 'linear-gradient(135deg, #151922 0%, #090b0f 56%, #201207 100%)' }} />
      <div style={{ position: 'absolute', width: 520, height: 520, right: -180, top: -230, display: 'flex', borderRadius: 999, background: 'rgba(255,138,31,0.18)' }} />
      <div style={{ position: 'absolute', width: 360, height: 360, left: -170, bottom: -220, display: 'flex', borderRadius: 999, background: 'rgba(255,138,31,0.10)' }} />
      <div style={{ width: '100%', height: '100%', display: 'flex', padding: 48, gap: 42 }}>
        {listing?.coverImage ? (
          <div style={{ width: 520, height: 534, display: 'flex', position: 'relative', overflow: 'hidden', borderRadius: 28, border: '1px solid rgba(255,255,255,0.13)', boxShadow: '0 28px 70px rgba(0,0,0,0.45)' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={listing.coverImage} alt="" width="520" height="534" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <div style={{ position: 'absolute', inset: 0, display: 'flex', background: 'linear-gradient(180deg, transparent 55%, rgba(0,0,0,0.52) 100%)' }} />
          </div>
        ) : (
          <div style={{ width: listing ? 520 : 360, height: 534, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 28, border: '1px solid rgba(255,138,31,0.28)', background: 'linear-gradient(145deg, rgba(255,138,31,0.17), rgba(255,255,255,0.035))' }}>
            <div style={{ width: 150, height: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 38, background: '#ff8a1f', color: '#111318', fontSize: 92, fontWeight: 900 }}>S</div>
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '8px 0' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 15, marginBottom: 44 }}>
              <div style={{ width: 54, height: 54, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 15, background: '#ff8a1f', color: '#111318', fontSize: 34, fontWeight: 900 }}>S</div>
              <div style={{ display: 'flex', fontSize: 31, fontWeight: 800, letterSpacing: '-0.8px' }}>Sanboard</div>
            </div>
            {listing ? (
              <>
                <div style={{ display: 'flex', color: '#ff9d45', fontSize: 38, fontWeight: 800, marginBottom: 20 }}>{listing.price}</div>
                <div style={{ display: 'flex', fontSize: 46, lineHeight: 1.08, fontWeight: 800, letterSpacing: '-1.7px', maxHeight: 154, overflow: 'hidden' }}>{listing.title}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 30 }}>
                  {[listing.category, listing.location, listing.date !== '-' ? listing.date : undefined].filter(Boolean).map((value) => (
                    <div key={value} style={{ display: 'flex', padding: '10px 16px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.065)', color: '#d5dae3', fontSize: 21, fontWeight: 600 }}>{value}</div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', color: '#ff9d45', fontSize: 25, fontWeight: 800, letterSpacing: '2.5px', textTransform: 'uppercase', marginBottom: 22 }}>Los Santos ilan platformu</div>
                <div style={{ display: 'flex', fontSize: 55, lineHeight: 1.06, fontWeight: 850, letterSpacing: '-2px' }}>Aradığın araç ve mülk ilanları tek yerde.</div>
                <div style={{ display: 'flex', marginTop: 28, color: '#b8bfca', fontSize: 25, lineHeight: 1.4 }}>Keşfet, ilanını yayınla ve doğru alıcıyla buluş.</div>
              </>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#9098a5', fontSize: 22 }}>
            <div style={{ width: 9, height: 9, display: 'flex', borderRadius: 999, background: '#ff8a1f' }} />
            sanboard.xyz
          </div>
        </div>
      </div>
    </div>
  );
}
