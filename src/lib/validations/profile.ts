import { z } from 'zod';

export const profileSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(2, 'Ad Soyad en az 2 karakter olmalıdır')
    .max(50, 'Ad Soyad en fazla 50 karakter olabilir'),
  avatar_url: z.string().min(1, 'Profil fotoğrafı zorunludur'),
  sanmail_email: z
    .string()
    .trim()
    .email('Geçerli bir SanMail adresi giriniz')
    .refine(
      (email) => email.toLowerCase().endsWith('@sanmail.com') || email.includes('@'),
      'SanMail formatına uygun olmalıdır'
    ),
  phone: z
    .string()
    .trim()
    .min(5, 'Telefon numarası en az 5 karakter olmalıdır')
    .max(25, 'Telefon numarası en fazla 25 karakter olabilir')
    .regex(/^[0-9+\s\-()]+$/, 'Geçerli bir telefon numarası giriniz'),
});

export const contactInfoSchema = profileSchema.pick({
  sanmail_email: true,
  phone: true,
});

export type ProfileFormInput = z.infer<typeof profileSchema>;
export type ContactInfoFormInput = z.infer<typeof contactInfoSchema>;
