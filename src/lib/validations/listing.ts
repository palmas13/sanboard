import { z } from 'zod';

export const vehicleCategories = [
  'Otomobil',
  'SUV / Off-Road / Kamyonet',
  'Motosiklet',
] as const;

export const propertyTypes = [
  'Ev / Daire',
  'İşyeri',
  'Diğer Mülk',
] as const;

export const roomCounts = [
  'Stüdyo',
  '1+0',
  '1+1',
  '2+1',
  '3+1',
  '4+1',
  '5+1+',
] as const;

export const buildingTypes = ['Normal', 'Dubleks'] as const;

export const imageSchema = z.object({
  id: z.string().optional(),
  storage_path: z.string().min(1, 'Fotoğraf yolu zorunludur'),
  sort_order: z.number().int().default(0),
  is_cover: z.boolean().default(false),
  size_bytes: z.number().max(2 * 1024 * 1024, 'Her fotoğraf maksimum 2 MB olabilir'),
});

export const baseListingFields = {
  title: z
    .string()
    .trim()
    .min(3, 'Başlık en az 3 karakter olmalıdır')
    .max(60, 'İlan başlığı en fazla 60 karakter olabilir'),
  description: z
    .string()
    .trim()
    .max(100, 'Açıklama en fazla 100 karakter olabilir'),
  price: z
    .number({ message: 'Geçerli bir fiyat giriniz' })
    .positive('Fiyat 0\'dan büyük olmalıdır')
    .max(1_000_000_000, 'Fiyat çok yüksek'),
  images: z
    .array(imageSchema)
    .min(1, 'En az 1 fotoğraf yüklenmelidir')
    .max(3, 'En fazla 3 fotoğraf yüklenebilir')
    .refine(
      (imgs) => imgs.filter((img) => img.is_cover).length === 1,
      'Tam olarak bir vitrin fotoğrafı seçilmelidir'
    ),
};

export const baseListingSchema = z.object({
  ...baseListingFields,
  location: z.string().trim().min(2, 'Konum en az 2 karakter olmalıdır').max(80, 'Konum en fazla 80 karakter olabilir').optional().nullable(),
});

export const vehicleListingSchema = z.object({
  ...baseListingFields,
  category: z.literal('vehicle'),
  subcategory: z.enum(vehicleCategories, {
    message: 'Geçerli bir araç kategorisi seçiniz',
  }),
  location: z.null().or(z.undefined()).optional(),
  brand: z.string().trim().min(1, 'Araç markası zorunludur'),
  model: z.string().trim().min(1, 'Araç modeli zorunludur'),
  plate: z.string().trim().min(2, 'Plaka bilgisi zorunludur'),
  mileage: z
    .number({ message: 'Kilometre geçerli bir sayı olmalıdır' })
    .int()
    .min(0, 'Kilometre negatif olamaz'),
  engine_upgrade: z.number().int().min(0).max(4).default(0),
  transmission_upgrade: z.number().int().min(0).max(4).default(0),
  brake_upgrade: z.number().int().min(0).max(4).default(0),
  turbo: z.boolean().default(false),
  subwoofer: z.boolean().default(false),
  trade_available: z.boolean().default(false),
});

export const propertyListingSchema = z.object({
  ...baseListingFields,
  category: z.literal('property'),
  subcategory: z.enum(propertyTypes, {
    message: 'Geçerli bir mülk türü seçiniz',
  }),
  location: z
    .string()
    .trim()
    .min(2, 'Konum en az 2 karakter olmalıdır')
    .max(80, 'Konum en fazla 80 karakter olabilir'),
  floor: z.number({ message: 'Kat bilgisi sayı olmalıdır' }).int(),
  room_count: z.enum(roomCounts, {
    message: 'Geçerli bir oda sayısı seçiniz',
  }),
  furnished: z.boolean().default(false),
  building_type: z.enum(buildingTypes).default('Normal'),
  balcony: z.boolean().default(false),
});

export const listingUnionSchema = z.discriminatedUnion('category', [
  vehicleListingSchema,
  propertyListingSchema,
]);

export type VehicleListingFormInput = z.infer<typeof vehicleListingSchema>;
export type PropertyListingFormInput = z.infer<typeof propertyListingSchema>;
export type ListingFormInput = z.infer<typeof listingUnionSchema>;
