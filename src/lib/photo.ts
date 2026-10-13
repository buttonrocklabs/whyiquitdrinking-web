// Browser-side photo cleanup for the Share form. A phone photo carries GPS, camera and
// time data in its Exif and XMP blocks, and the site stores and serves uploaded bytes
// as they arrive. Redrawing the decoded pixels on a canvas and exporting a fresh JPEG
// leaves all of that behind: the exported file has no Exif, XMP or GPS bytes at all.
// The rotation a phone records as an Exif tag is applied to the pixels first, so a
// portrait photo stays upright once the tag is gone.

/** Longest side of the exported photo, in pixels. Smaller photos are never enlarged. */
export const MAX_EDGE_PX = 2000

const JPEG_QUALITY = 0.9

/** The browser could not turn the file into pixels, or could not export them again. */
export class PhotoDecodeError extends Error {
  constructor(message = 'The photo could not be decoded.') {
    super(message)
    this.name = 'PhotoDecodeError'
  }
}

/** HEIC and HEIF by file name or declared type, for choosing which message a failed decode gets. */
export function isHeicFile(file: File): boolean {
  return /\.(heic|heif)$/i.test(file.name) || /^image\/(heic|heif)$/i.test(file.type)
}

function exportName(file: File): string {
  const stem = file.name.replace(/\.[^./\\]*$/, '')
  return `${stem || 'photo'}.jpg`
}

/**
 * Returns a clean JPEG copy of the photo: orientation applied to the pixels, long edge
 * at most MAX_EDGE_PX, transparency filled with white, no metadata. Throws
 * PhotoDecodeError when the browser cannot decode the file or cannot export the result.
 */
export async function prepareImage(file: File): Promise<File> {
  let bitmap: ImageBitmap
  try {
    if (typeof createImageBitmap !== 'function') throw new PhotoDecodeError()
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new PhotoDecodeError()
  }

  try {
    const longEdge = Math.max(bitmap.width, bitmap.height)
    if (longEdge === 0) throw new PhotoDecodeError()
    const scale = Math.min(1, MAX_EDGE_PX / longEdge)
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new PhotoDecodeError()

    // JPEG has no alpha channel; an unfilled canvas would turn transparent PNG pixels black.
    context.fillStyle = 'white'
    context.fillRect(0, 0, width, height)
    context.imageSmoothingQuality = 'high'
    context.drawImage(bitmap, 0, 0, width, height)

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY)
    )
    // A browser that cannot encode JPEG falls back to PNG; that would break the contract.
    if (!blob || blob.type !== 'image/jpeg') throw new PhotoDecodeError()
    return new File([blob], exportName(file), { type: 'image/jpeg' })
  } catch {
    throw new PhotoDecodeError()
  } finally {
    bitmap.close()
  }
}
