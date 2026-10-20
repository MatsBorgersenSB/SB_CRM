/** Client-side preprocessing that keeps vision-token cost (and upload size) low. */

export const MAX_IMAGE_DIMENSION = 1200;
export const IMAGE_QUALITY = 0.85;
/** Vercel request bodies cap at ~4.5 MB; stay under it for untouched PDFs. */
export const MAX_PDF_BYTES = 4 * 1024 * 1024;

export type PreparedUpload = {
  file: File;
  isPdf: boolean;
};

export class UploadPreparationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadPreparationError";
  }
}

export function isPdfFile(file: File): boolean {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

function scaledSize(width: number, height: number): { width: number; height: number } {
  const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

async function decodeImage(file: File): Promise<{
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
}> {
  if (typeof createImageBitmap === "function") {
    try {
      // `from-image` applies EXIF rotation so phone photos are not sideways.
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        release: () => bitmap.close(),
      };
    } catch {
      /* fall through to <img> decoding */
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await image.decode();
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      release: () => URL.revokeObjectURL(url),
    };
  } catch {
    URL.revokeObjectURL(url);
    throw new UploadPreparationError("Could not read this image. Try a JPEG or PNG photo.");
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/** Scales to max 1200px on the long edge and re-encodes as JPEG at 0.85 quality. */
export async function resizeImage(file: File): Promise<File> {
  const decoded = await decodeImage(file);
  try {
    const { width, height } = scaledSize(decoded.width, decoded.height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) throw new UploadPreparationError("Image processing is not available.");
    // JPEG has no alpha; flatten transparent PNG/GIF onto white.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(decoded.source, 0, 0, width, height);

    const blob = await canvasToBlob(canvas, "image/jpeg", IMAGE_QUALITY);
    if (!blob) throw new UploadPreparationError("Could not compress this image.");

    const baseName = file.name.replace(/\.[^.]+$/, "") || "business-card";
    return new File([blob], `${baseName}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
  } finally {
    decoded.release();
  }
}

/**
 * Images are resized/compressed. PDFs pass through untouched (size-capped); the scan
 * route slices them to the first 2 pages before they reach the model.
 */
export async function prepareUpload(file: File): Promise<PreparedUpload> {
  if (isPdfFile(file)) {
    if (file.size > MAX_PDF_BYTES) {
      throw new UploadPreparationError("PDF is larger than 4 MB. Export a smaller scan.");
    }
    return { file, isPdf: true };
  }
  if (!file.type.startsWith("image/")) {
    throw new UploadPreparationError("Choose a photo or a PDF.");
  }
  return { file: await resizeImage(file), isPdf: false };
}
