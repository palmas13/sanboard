import { z } from 'zod';
import { VEHICLE_LEVEL_FIELDS, VehicleLevelField } from '@/lib/listings/vehicle-levels';
import { isMotorcycleCategory, isValidVehicleSelection, VEHICLE_CATEGORIES } from '@/lib/constants/vehicleCategories';

export const LISTING_TITLE_MAX_LENGTH = 40;
export const LISTING_TITLE_MAX_ERROR = 'İlan başlığı en fazla 40 karakter olabilir.';

export const vehicleCategories = VEHICLE_CATEGORIES;

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

const vehicleLevelSchema = (field: VehicleLevelField) => {
  const definition = VEHICLE_LEVEL_FIELDS[field];
  return z.number().int(`${definition.label} seviyesi tam sayı olmalıdır`).min(0).max(
    definition.max,
    `${definition.label} seviyesi en fazla ${definition.max} olabilir`
  );
};

export const imageSchema = z.object({
  id: z.string().optional(),
  storage_path: z.string().min(1, 'Fotoğraf yolu zorunludur'),
  sort_order: z.number().int().default(0),
  is_cover: z.boolean().default(false),
  size_bytes: z.number().max(2 * 1024 * 1024, 'Her fotoğraf maksimum 2 MB olabilir'),
});

const listingImagesSchema = (maxImages: number) => z
  .array(imageSchema)
  .min(1, 'En az 1 fotoğraf yüklenmelidir')
  .max(maxImages, `En fazla ${maxImages} fotoğraf yüklenebilir`)
  .refine(
    (imgs) => imgs.filter((img) => img.is_cover).length === 1,
    'Tam olarak bir vitrin fotoğrafı seçilmelidir'
  );

export const baseListingFields = {
  title: z
    .string()
    .trim()
    .min(3, 'Başlık en az 3 karakter olmalıdır')
    .max(LISTING_TITLE_MAX_LENGTH, LISTING_TITLE_MAX_ERROR),
  description: z
    .string()
    .trim()
    .max(100, 'Açıklama en fazla 100 karakter olabilir'),
  price: z
    .number({ message: 'Geçerli bir fiyat giriniz' })
    .positive('Fiyat 0\'dan büyük olmalıdır')
    .max(1_000_000_000, 'Fiyat çok yüksek'),
  offers_enabled: z.boolean().default(true),
  minimum_offer_amount: z.number().int('Minimum teklif tam sayı olmalıdır').positive('Minimum teklif 0’dan büyük olmalıdır').max(1_000_000_000, 'Minimum teklif çok yüksek').optional().nullable(),
  images: listingImagesSchema(3),
  seller_type: z.enum(['INDIVIDUAL', 'CORPORATE']).optional().nullable(),
  corporate_profile_id: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((val) => (val && val.length > 0 ? val : null)),
};

export const baseListingSchema = z.object({
  ...baseListingFields,
  location: z.string().trim().min(2, 'Konum en az 2 karakter olmalıdır').max(80, 'Konum en fazla 80 karakter olabilir').optional().nullable(),
}).refine((value) => value.minimum_offer_amount == null || value.minimum_offer_amount <= value.price, {
  message: 'Minimum teklif ilan fiyatından yüksek olamaz.', path: ['minimum_offer_amount'],
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
  engine_upgrade: vehicleLevelSchema('engine_upgrade').default(0),
  transmission_upgrade: vehicleLevelSchema('transmission_upgrade').default(0),
  brake_upgrade: vehicleLevelSchema('brake_upgrade').default(0),
  turbo: z.boolean().default(false),
  subwoofer: z.boolean().default(false),
  trade_available: z.boolean().default(false),
  lock_level: vehicleLevelSchema('lock_level').optional().nullable(),
  alarm_level: vehicleLevelSchema('alarm_level').optional().nullable(),
  anti_theft_level: vehicleLevelSchema('anti_theft_level').optional().nullable(),
  engine_health: z.number().int('Motor sağlığı tam sayı olmalıdır').min(0, 'Motor sağlığı 0’dan küçük olamaz').max(100, 'Motor sağlığı 100’den büyük olamaz').optional().nullable(),
  suspension: vehicleLevelSchema('suspension').optional().nullable(),
  fuel_type: z.enum(['BENZIN', 'DIZEL', 'ELEKTRIK']).optional().nullable(),
  factory_price: z.number().int('Fabrika çıkış fiyatı tam sayı olmalıdır').positive('Fabrika çıkış fiyatı 0’dan büyük olmalıdır').optional().nullable(),
}).superRefine((value, ctx) => {
  if (value.minimum_offer_amount != null && value.minimum_offer_amount > value.price) {
    ctx.addIssue({ code: 'custom', message: 'Minimum teklif ilan fiyatından yüksek olamaz.', path: ['minimum_offer_amount'] });
  }
  if (!isValidVehicleSelection(value.subcategory, value.brand, value.model)) {
    ctx.addIssue({ code: 'custom', message: 'Araç kategorisi, marka ve model eşleşmesi geçersiz.', path: ['model'] });
  }
  if (isMotorcycleCategory(value.subcategory) && value.suspension != null) {
    ctx.addIssue({ code: 'custom', message: 'Motosiklet ilanlarında süspansiyon seviyesi kullanılamaz.', path: ['suspension'] });
  }
});

export const propertyListingSchema = z.object({
  ...baseListingFields,
  images: listingImagesSchema(5),
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
}).refine((value) => value.minimum_offer_amount == null || value.minimum_offer_amount <= value.price, {
  message: 'Minimum teklif ilan fiyatından yüksek olamaz.', path: ['minimum_offer_amount'],
});

export const listingUnionSchema = z.union([vehicleListingSchema, propertyListingSchema]);

export type VehicleListingFormInput = z.infer<typeof vehicleListingSchema>;
export type PropertyListingFormInput = z.infer<typeof propertyListingSchema>;
export type ListingFormInput = z.infer<typeof listingUnionSchema>;
