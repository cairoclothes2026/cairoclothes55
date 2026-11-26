export const productImageBucket = 'product-images';
export const productImageMaxBytes = 5 * 1024 * 1024;
const productImageTargetBytes = 350 * 1024;
const productImageMaxDimension = 1400;

export function productImageExtension(image: Blob) {
  if (image.size < 1 || image.size > productImageMaxBytes) return null;
  switch (image.type) {
    case 'image/jpeg': return 'jpg';
    case 'image/png': return 'png';
    case 'image/webp': return 'webp';
    default: return null;
  }
}

/** Resize and encode product photos in the browser before upload. */
export async function compressProductImage(file: File): Promise<File> {
  if (!productImageExtension(file)) throw new Error('invalid_image');
  if (typeof createImageBitmap !== 'function') return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('invalid_image');
  }

  try {
    const scale = Math.min(1, productImageMaxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, width, height);

    for (const quality of [0.82, 0.72, 0.62, 0.52]) {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
      if (!blob || blob.type !== 'image/webp') return file;
      if (blob.size <= productImageTargetBytes || quality === 0.52) {
        if (blob.size >= file.size) return file;
        return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.webp`, { type: 'image/webp', lastModified: file.lastModified });
      }
    }
    return file;
  } finally {
    bitmap.close();
  }
}
