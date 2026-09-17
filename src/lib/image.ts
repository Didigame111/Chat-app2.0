/**
 * Client-side image compression.
 *
 * Cloud Storage for Firebase is not part of the free Spark plan, so photos are
 * inlined into the Firestore message document as a compressed data URL. That
 * means the compression here is not a nicety — it is what keeps a 4 MB photo
 * from an iPad camera under the 1 MiB document ceiling.
 */

/** Longest edge we keep. 1280px still looks sharp in a bubble on a 2x iPad. */
const MAX_DIMENSION = 1280;

/** Ceiling for the encoded data URL, comfortably under the firestore.rules cap. */
const MAX_DATA_URL_CHARS = 480_000;

const QUALITY_LADDER = [0.82, 0.72, 0.62, 0.52, 0.42, 0.34];

export const ACCEPTED_IMAGE_TYPES =
  'image/jpeg,image/png,image/gif,image/webp,image/heic,image/heif';

export class ImageTooLargeError extends Error {
  constructor() {
    super('That photo is too detailed to send. Try cropping it first.');
    this.name = 'ImageTooLargeError';
  }
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    // Going through an <img> rather than createImageBitmap means Safari uses
    // the system decoder, so HEIC photos straight from the iPad camera work
    // and EXIF rotation is already applied.
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That file could not be read as an image.'));
    };
    img.src = url;
  });
}

export interface CompressedImage {
  dataUrl: string;
  width: number;
  height: number;
}

export async function compressImage(file: File): Promise<CompressedImage> {
  const img = await loadImage(file);

  const scale = Math.min(1, MAX_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot process images.');
  ctx.imageSmoothingQuality = 'high';
  // JPEG has no alpha; paint a white base so transparent PNGs do not go black.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  for (const quality of QUALITY_LADDER) {
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    if (dataUrl.length <= MAX_DATA_URL_CHARS) {
      return { dataUrl, width, height };
    }
  }

  throw new ImageTooLargeError();
}
