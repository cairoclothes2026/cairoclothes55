'use client';

import Image from 'next/image';
import { catalogImageUrl } from '@/lib/catalog-image-url';

type CatalogImageProps = {
  image: string | null | undefined;
  width: number;
  height?: number;
  alt: string;
  className?: string;
  loading?: 'eager' | 'lazy';
  priority?: boolean;
  sizes?: string;
};

export function CatalogImage({
  image,
  width,
  height,
  alt,
  className,
  loading = 'lazy',
  priority = false,
  sizes = '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw',
}: CatalogImageProps) {
  const source = catalogImageUrl(image, width);
  const imageStyle = { backgroundColor: 'var(--cream, #F4EFE3)' };

  if (source.startsWith('https://images.unsplash.com/')) {
    return (
      <Image
        src={source}
        alt={alt}
        width={width}
        height={height ?? Math.round(width * 0.75)}
        className={className}
        style={imageStyle}
        loading={loading}
        priority={priority}
        sizes={sizes}
      />
    );
  }

  return (
    <Image
      src={source}
      alt={alt}
      width={width}
      height={height ?? Math.round(width * 0.75)}
      className={className}
      style={imageStyle}
      loading={loading}
      priority={priority}
      sizes={sizes}
      unoptimized
    />
  );
}