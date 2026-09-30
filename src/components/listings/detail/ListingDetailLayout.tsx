export function ListingDetailLayout({
  category,
  gallery,
  seller,
  description,
  details,
}: {
  category: 'vehicle' | 'property';
  gallery: React.ReactNode;
  seller: React.ReactNode;
  description?: React.ReactNode;
  details: React.ReactNode;
}) {
  return (
    <section
      data-testid={`${category}-listing-layout`}
      data-detail-layout="vehicle-theme"
      className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,.85fr)] xl:grid-cols-[minmax(0,1.55fr)_minmax(360px,.9fr)_minmax(245px,.58fr)]"
    >
      <div data-testid={`${category}-gallery-block`} className="min-w-0 lg:col-start-1 lg:row-start-1 xl:col-start-1">
        {gallery}
      </div>
      <aside data-testid={`${category}-seller-rail`} className="min-w-0 space-y-2.5 lg:col-start-2 lg:row-start-1 xl:col-start-3 xl:row-start-1 xl:sticky xl:top-20">
        {seller}
      </aside>
      {description ? <div data-testid={`${category}-description-row`} className="min-w-0 self-stretch lg:col-start-1 lg:row-start-2 xl:col-start-1">{description}</div> : null}
      <div data-testid={`${category}-technical-column`} className="min-w-0 lg:col-start-2 lg:row-start-2 xl:col-start-2 xl:row-start-1 xl:row-span-2">
        {details}
      </div>
    </section>
  );
}