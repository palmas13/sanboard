import Image, { type ImageProps } from 'next/image';
import type { ImgHTMLAttributes } from 'react';

type SanboardImageProps = Omit<ImageProps, 'src'> & {
  src: string;
  nativeProps?: Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt' | 'className'>;
};

const OPTIMIZABLE_REMOTE_HOSTS = new Set([
  'images.unsplash.com',
]);

function imageDelivery(src: string): 'direct' | 'optimized' | 'native' {
  if (src.startsWith('/') && !src.startsWith('//')) return 'optimized';
  if (src.startsWith('blob:') || src.startsWith('data:')) return 'native';

  try {
    const url = new URL(src);
    if (url.hostname === 'cdn.sanboard.xyz' || url.hostname.endsWith('.r2.dev') || url.hostname.endsWith('.workers.dev') || url.hostname.endsWith('.r2.cloudflarestorage.com')) {
      return 'direct';
    }
    if (OPTIMIZABLE_REMOTE_HOSTS.has(url.hostname) || url.hostname.endsWith('.supabase.co')) {
      return 'optimized';
    }
  } catch {
    return 'native';
  }

  return 'native';
}

export function SanboardImage({ src, alt, nativeProps, ...props }: SanboardImageProps) {
  const delivery = imageDelivery(src);

  if (delivery === 'native') {
    const { fill, priority: _priority, preload: _preload, quality: _quality, sizes, width, height, style, ...nativeImageProps } = props;
    const nativeStyle = fill
      ? { position: 'absolute' as const, inset: 0, width: '100%', height: '100%', ...style }
      : style;
    return (
      // Blob/data previews and unconfigured legacy hosts intentionally use the browser-native image path.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={alt} width={fill ? undefined : width} height={fill ? undefined : height} sizes={sizes} style={nativeStyle} {...nativeProps} {...nativeImageProps} />
    );
  }

  return <Image src={src} alt={alt} unoptimized={delivery === 'direct'} {...props} />;
}