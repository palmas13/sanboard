export interface ListingQualityInput {
  category: 'vehicle' | 'property';
  subcategory?: string;
  title?: string;
  description?: string;
  price?: string | number;
  location?: string;
  imageCount?: number;
  hasContact?: boolean;
  brand?: string;
  model?: string;
  mileage?: string | number;
  fuelType?: string;
  engineHealth?: string | number;
  plate?: string;
  propertyType?: string;
  roomCount?: string;
  floor?: string | number;
  buildingType?: string;
}

export interface ListingQualityResult {
  percentage: number;
  level: 'low' | 'good' | 'detailed';
  label: string;
  suggestions: string[];
}

type Criterion = { weight: number; complete: boolean; suggestion?: string; priority?: number };

const hasText = (value: unknown) => typeof value === 'string' && value.trim().length > 0;
const hasNonNegativeNumber = (value: unknown) => value !== '' && value !== null && value !== undefined && Number(value) >= 0;

export function calculateListingQuality(input: ListingQualityInput): ListingQualityResult {
  const imageCount = Math.max(0, input.imageCount || 0);
  const common: Criterion[] = [
    { weight: 12, complete: hasText(input.title), suggestion: 'İlan başlığı ekle.', priority: 1 },
    { weight: 12, complete: Number(input.price) > 0, suggestion: 'Geçerli bir fiyat ekle.', priority: 1 },
    { weight: 8, complete: hasText(input.subcategory), suggestion: 'Temel kategori bilgisini tamamla.', priority: 1 },
    { weight: 12, complete: hasText(input.description), suggestion: 'İlan açıklaması ekle.', priority: 2 },
    { weight: 10, complete: imageCount >= 1, suggestion: 'En az 1 fotoğraf ekle.', priority: 1 },
    { weight: 10, complete: imageCount >= 3, suggestion: 'Daha fazla görüntülenme için en az 3 fotoğraf ekle.', priority: 3 },
    { weight: 8, complete: Boolean(input.hasContact), suggestion: 'İletişim bilgilerini profilinden tamamla.', priority: 4 },
  ];

  const specific: Criterion[] = input.category === 'vehicle'
    ? [
        { weight: 7, complete: hasText(input.brand), suggestion: 'Araç markasını ekle.', priority: 1 },
        { weight: 7, complete: hasText(input.model), suggestion: 'Araç modelini ekle.', priority: 1 },
        { weight: 6, complete: hasNonNegativeNumber(input.mileage), suggestion: 'Mil bilgisini ekle.', priority: 2 },
        { weight: 4, complete: hasText(input.fuelType), suggestion: 'Yakıt türünü belirt.', priority: 3 },
        { weight: 4, complete: hasNonNegativeNumber(input.engineHealth), suggestion: 'Motor sağlığı bilgisini ekle.', priority: 3 },
      ]
    : [
        { weight: 10, complete: hasText(input.location), suggestion: 'Mülkün konumunu belirt.', priority: 1 },
        { weight: 7, complete: hasText(input.propertyType || input.subcategory), suggestion: 'Mülk türünü belirt.', priority: 1 },
        { weight: 7, complete: hasText(input.roomCount), suggestion: 'Oda sayısını belirt.', priority: 2 },
        { weight: 6, complete: hasNonNegativeNumber(input.floor), suggestion: 'Kat bilgisini ekle.', priority: 3 },
      ];

  const criteria = [...common, ...specific];
  const total = criteria.reduce((sum, item) => sum + item.weight, 0);
  const earned = criteria.reduce((sum, item) => sum + (item.complete ? item.weight : 0), 0);
  const percentage = Math.round((earned / total) * 100);
  const level = percentage < 50 ? 'low' : percentage < 80 ? 'good' : 'detailed';
  const label = level === 'low'
    ? 'İlanını biraz daha tamamlayabilirsin'
    : level === 'good'
      ? 'İlan iyi durumda'
      : 'İlan oldukça detaylı';
  const suggestions = criteria
    .filter((item) => !item.complete && item.suggestion)
    .sort((a, b) => (a.priority || 99) - (b.priority || 99))
    .slice(0, 4)
    .map((item) => item.suggestion as string);

  return { percentage, level, label, suggestions };
}