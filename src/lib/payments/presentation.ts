import type { Payment } from '@/types';

type PaymentProductMetadata = Pick<
  Payment,
  'entitlement_type' | 'purpose' | 'package_code' | 'package_name'
>;

export function getPaymentProductLabel(payment: PaymentProductMetadata): string {
  if (payment.purpose === 'LISTING_BOOST' || payment.entitlement_type === 'LISTING_BOOST') {
    return 'İlan Öne Çıkarma';
  }
  if (payment.purpose === 'CORPORATE_SUBSCRIPTION' || payment.entitlement_type === 'CORPORATE_SUBSCRIPTION') {
    return 'Kurumsal Üyelik';
  }

  switch (payment.package_code) {
    case 'STANDARD_7_DAY':
      return 'Bireysel İlan Hakkı';
    case 'CORPORATE_14_DAY':
      return 'Kurumsal İlan Hakkı';
    case 'LISTING_BOOST_24_HOUR':
      return 'İlan Öne Çıkarma';
    case 'CORPORATE_SUBSCRIPTION_30_DAY':
      return 'Kurumsal Üyelik';
    default:
      return payment.package_name || (payment.entitlement_type === 'LISTING_CREDIT' ? 'İlan Hakkı' : 'Ödeme Paketi');
  }
}