// Browser-side photo handling for the Share flow. A phone photo carries GPS, camera and
// time data in its Exif and XMP blocks, and the site stores and serves uploaded bytes
// as they arrive. Redrawing the decoded pixels on a canvas and exporting a fresh JPEG
// leaves all of that behind: the exported file has no Exif, XMP or GPS bytes at all.
// The rotation a phone records as an Exif tag is applied to the pixels first, so a
// portrait photo stays upright once the tag is gone. After cleaning, the visitor frames
// the photo and cropImage bakes that frame into the JPEG that actually gets uploaded.

/** What the file picker offers. Whatever is chosen is re-encoded to a JPEG before upload. */
export const PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp'
export const PHOTO_HELP = 'JPEG, PNG or WebP. We remove location data and shrink large photos for you.'

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

async function encodeJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY)
  )
  // A browser that cannot encode JPEG falls back to PNG; that would break the contract.
  if (!blob || blob.type !== 'image/jpeg') throw new PhotoDecodeError()
  return blob
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

    return new File([await encodeJpeg(canvas)], exportName(file), { type: 'image/jpeg' })
  } catch {
    throw new PhotoDecodeError()
  } finally {
    bitmap.close()
  }
}

/** Pixel size of an image file, for framing math. */
export async function measureImage(file: File): Promise<{ width: number; height: number }> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new PhotoDecodeError()
  }
  const size = { width: bitmap.width, height: bitmap.height }
  bitmap.close()
  return size
}

// Framing. A frame is the fixed-aspect window a photo shows through on the board. The view
// says where the photo sits in it, in units that do not depend on the photo's pixel size or
// on how big the editor is drawn, so the same view bakes the same crop at any size.

export const MIN_ZOOM = 1
export const MAX_ZOOM = 3

/** Zoom 1 is the photo just covering the frame. x and y are the middle of what shows, as 0 to 1 of the photo. */
export interface FrameView {
  zoom: number
  x: number
  y: number
}

export const DEFAULT_VIEW: FrameView = { zoom: 1, x: 0.5, y: 0.5 }

/** A frame's shape and the largest JPEG baked from it. The board shows pair photos at 3:4 and a lone photo at 4:3. */
export interface FrameSpec {
  aspectW: number
  aspectH: number
  maxW: number
  maxH: number
}

export const PAIR_FRAME: FrameSpec = { aspectW: 3, aspectH: 4, maxW: 1500, maxH: 2000 }
export const SINGLE_FRAME: FrameSpec = { aspectW: 4, aspectH: 3, maxW: 2000, maxH: 1500 }

/** Share of the photo's width (fx) and height (fy) showing in a frame of this aspect (width over height). */
export function visibleShare(photoW: number, photoH: number, frameAspect: number, zoom: number) {
  const k = frameAspect / (photoW / photoH)
  return k >= 1 ? { fx: 1 / zoom, fy: 1 / (k * zoom) } : { fx: k / zoom, fy: 1 / zoom }
}

/**
 * Keeps the zoom in range and the photo covering the frame, so no edge of the frame is ever empty.
 * x and y are the middle of what shows, so they stay between half the visible share and its mirror.
 */
export function clampView(view: FrameView, photoW: number, photoH: number, frameAspect: number): FrameView {
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, view.zoom))
  const { fx, fy } = visibleShare(photoW, photoH, frameAspect, zoom)
  return {
    zoom,
    x: Math.min(1 - fx / 2, Math.max(fx / 2, view.x)),
    y: Math.min(1 - fy / 2, Math.max(fy / 2, view.y)),
  }
}

/**
 * Bakes the visitor's framing into a new JPEG of exactly the frame's aspect. It works from
 * the cleaned file, never from an earlier crop, so re-framing cannot crop a crop twice. The
 * output is never larger than the source pixels it shows or the frame's caps.
 */
export async function cropImage(cleaned: File, view: FrameView, frame: FrameSpec): Promise<File> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(cleaned, { imageOrientation: 'from-image' })
  } catch {
    throw new PhotoDecodeError()
  }

  try {
    const aspect = frame.aspectW / frame.aspectH
    const framed = clampView(view, bitmap.width, bitmap.height, aspect)
    const { fx, fy } = visibleShare(bitmap.width, bitmap.height, aspect, framed.zoom)
    const sw = fx * bitmap.width
    const sh = fy * bitmap.height
    const sx = Math.min(bitmap.width - sw, Math.max(0, framed.x * bitmap.width - sw / 2))
    const sy = Math.min(bitmap.height - sh, Math.max(0, framed.y * bitmap.height - sh / 2))

    // Whole multiples of the aspect, so the output is exactly 3:4 or 4:3 with no rounding drift.
    const unit = Math.min(sw / frame.aspectW, sh / frame.aspectH, frame.maxW / frame.aspectW, frame.maxH / frame.aspectH)
    const k = Math.max(1, Math.floor(unit + 1e-6))
    const width = frame.aspectW * k
    const height = frame.aspectH * k

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new PhotoDecodeError()
    context.fillStyle = 'white'
    context.fillRect(0, 0, width, height)
    context.imageSmoothingQuality = 'high'
    context.drawImage(bitmap, sx, sy, sw, sh, 0, 0, width, height)

    return new File([await encodeJpeg(canvas)], cleaned.name, { type: 'image/jpeg' })
  } catch {
    throw new PhotoDecodeError()
  } finally {
    bitmap.close()
  }
}
