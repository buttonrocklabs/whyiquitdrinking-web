import { PhotoDecodeError, cropImage, isHeicFile, measureImage, prepareImage } from '@/lib/photo'
import { MAX_PHOTO_BYTES, MAX_SOURCE_BYTES, PHOTO_ERRORS } from '../../../shared/pair'
import { frameOf, newEntry, type FlowData, type PhotoEntry, type PhotoKey } from './types'

/** A refused photo. The message is what the visitor reads in the slot. */
export class PhotoRefused extends Error {}

/**
 * The checks a photo has always had, run the moment it is picked: source cap, cleaning
 * (drops location and camera data, applies rotation), size cap after cleaning, and the
 * HEIC message. Throws PhotoRefused with the visitor-facing message on any refusal.
 */
export async function loadPhoto(file: File): Promise<PhotoEntry> {
  if (file.size > MAX_SOURCE_BYTES) throw new PhotoRefused(PHOTO_ERRORS.sourceSize)
  let clean: File
  try {
    clean = await prepareImage(file)
  } catch {
    throw new PhotoRefused(isHeicFile(file) ? PHOTO_ERRORS.heic : PHOTO_ERRORS.type)
  }
  if (clean.size > MAX_PHOTO_BYTES) throw new PhotoRefused(PHOTO_ERRORS.size)
  try {
    const { width, height } = await measureImage(clean)
    return newEntry(clean, width, height)
  } catch {
    throw new PhotoRefused(PHOTO_ERRORS.type)
  }
}

/**
 * Bakes each active photo's framing into the JPEG that gets uploaded. Photos already baked
 * are left alone, one at a time so two large photos are never decoded together. Returns
 * the data with the new baked files, or null when a photo could not be framed.
 */
export async function bakePhotos(data: FlowData, keys: PhotoKey[]): Promise<FlowData | null> {
  const photos = { ...data.photos }
  for (const key of keys) {
    const entry = photos[key]
    if (!entry || entry.baked) continue
    try {
      const baked = await cropImage(entry.clean, entry.view, frameOf(key))
      if (baked.size > MAX_PHOTO_BYTES) return null
      photos[key] = { ...entry, baked }
    } catch (error) {
      if (error instanceof PhotoDecodeError) return null
      throw error
    }
  }
  return { ...data, photos }
}
