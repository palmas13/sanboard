/**
 * Format currency to GTA World format: $75.000
 */
export function formatCurrency(amount: number): string {
  const formatted = new Intl.NumberFormat('tr-TR', {
    maximumFractionDigits: 0,
  }).format(amount);
  return `$${formatted}`;
}

/**
 * Format date in Turkish: 23 Eylül 2026
 */
export function formatDate(dateString?: string): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

/**
 * Format date with time: 23 Eylül 2026 15:30
 */
export function formatDateTime(dateString?: string): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/**
 * Calculates remaining time until expiration: e.g. "4 gün 7 saat kaldı" or "Süresi Doldu"
 */
export function formatTimeRemaining(expiresAt?: string): {
  text: string;
  isExpired: boolean;
  days: number;
  hours: number;
} {
  if (!expiresAt) {
    return { text: 'Belirsiz', isExpired: true, days: 0, hours: 0 };
  }

  const now = new Date().getTime();
  const expiry = new Date(expiresAt).getTime();
  const diff = expiry - now;

  if (diff <= 0) {
    return { text: 'Süresi Doldu', isExpired: true, days: 0, hours: 0 };
  }

  const totalHours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;

  if (days > 0) {
    return {
      text: `${days} gün ${hours} saat kaldı`,
      isExpired: false,
      days,
      hours,
    };
  }

  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) {
    return {
      text: `${hours} saat ${minutes} dakika kaldı`,
      isExpired: false,
      days: 0,
      hours,
    };
  }

  return {
    text: `${minutes} dakika kaldı`,
    isExpired: false,
    days: 0,
    hours: 0,
  };
}

/**
 * Strip any HTML tags and escape to prevent XSS
 */
export function sanitizeText(text: string): string {
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/[<>&"']/g, (char) => {
      switch (char) {
        case '<':
          return '&lt;';
        case '>':
          return '&gt;';
        case '&':
          return '&amp;';
        case '"':
          return '&quot;';
        case "'":
          return '&#x27;';
        default:
          return char;
      }
    });
}

/**
 * Generate human-friendly listing number: #SB-XXXXXX
 */
export function generateListingNumber(seq: number): string {
  return `#SB-${(100000 + (seq % 900000)).toString()}`;
}
