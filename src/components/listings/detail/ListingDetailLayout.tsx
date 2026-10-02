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
  if (category === 'vehicle') {
    return (
      <section
        data-testid="vehicle-listing-layout"
        data-detail-layout="vehicle-theme"
        className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(330px,.9fr)] xl:grid-cols-[minmax(0,1.7fr)_minmax(340px,.95fr)_minmax(260px,.7fr)]"
      >
        <div className="flex min-w-0 flex-col gap-4 lg:grid lg:grid-rows-[minmax(20rem,1fr)_auto]" data-testid="vehicle-content-column">
          <div data-testid="vehicle-gallery-block" className="min-w-0 lg:min-h-80">{gallery}</div>
          {description ? <div data-testid="vehicle-description-row" className="min-h-0 min-w-0">{description}</div> : null}
        </div>
        <div data-testid="vehicle-technical-column" className="min-w-0 lg:col-start-2 xl:col-start-2">{details}</div>
        <aside data-testid="vehicle-seller-rail" className="min-w-0 space-y-2.5 lg:col-start-2 xl:col-start-3 xl:row-start-1 xl:sticky xl:top-20 xl:self-start">{seller}</aside>
      </section>
    );
  }

  return (
    <section
      data-testid="property-listing-layout"
      data-detail-layout="vehicle-theme"
      className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,1fr)_minmax(260px,.75fr)]"
    >
      <div data-testid="property-gallery-block" className="min-w-0 lg:col-span-2 xl:col-span-1 xl:col-start-1 xl:row-start-1">
        {gallery}
      </div>
      <div data-testid="property-technical-column" className="min-w-0 lg:col-start-1 lg:row-start-2 xl:col-start-2 xl:row-start-1 xl:row-span-2 xl:self-stretch">
        {details}
      </div>
      <aside data-testid="property-seller-rail" className="min-w-0 space-y-2.5 lg:col-start-2 lg:row-start-2 xl:col-start-3 xl:row-start-1 xl:row-span-2 xl:sticky xl:top-20">
        {seller}
      </aside>
      {description ? <div data-testid="property-description-row" className="min-w-0 lg:col-span-2 lg:row-start-3 xl:col-span-1 xl:col-start-1 xl:row-start-2">{description}</div> : null}
    </section>
  );
}