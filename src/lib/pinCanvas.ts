// Draws the before-and-after pin (WIQD-14) on a browser canvas. The pin always wears the
// Archive theme, whatever theme the moderator has active: colors are read from a hidden
// element carrying data-theme="archive", so there is no hex in this file. Photos come from
// /media on the same origin, so the canvas is never tainted and toBlob works.

import { SITE_HOST, shortMonthYear } from '@/lib/pinText'

export const PIN_WIDTH = 1000
export const PIN_HEIGHT = 1500

const MARGIN = 60
const FRAME_WIDTH = 420
const FRAME_HEIGHT = 660
const FRAME_GAP = 40
const FRAME_RADIUS = 6
const FRAME_OUTLINE = 3

const TITLE_TOP = MARGIN
const TITLE_ZONE_HEIGHT = 250
const TITLE_MAX_LINES = 3
const TITLE_START_SIZE = 64
const TITLE_STEP = 4
/**
 * Ordinary titles (100 characters at most, with spaces) fit in 3 lines by 44px. Text with
 * no spaces to wrap at keeps shrinking down to this, so nothing is ever cut off.
 */
const TITLE_HARD_FLOOR = 24
const TITLE_LINE_HEIGHT = 1.2

const FRAMES_TOP = 430
const LABEL_SIZE = 40
const LABEL_OFFSET = 62
const DATE_SIZE = 32
const DATE_OFFSET = 114
const DOMAIN_SIZE = 48
const DOMAIN_CENTER = PIN_HEIGHT - MARGIN - DOMAIN_SIZE / 2

const SERIF = '"Fraunces", Georgia, serif'
const SANS = '"Inter", system-ui, sans-serif'

export interface PinColors {
  surface: string
  ink: string
  inkMuted: string
  brand: string
  lineStrong: string
}

/** Reads the Archive tokens by styling a hidden element, so the pin never follows the moderator's own theme. */
export function readPinColors(): PinColors {
  const probe = document.createElement('div')
  probe.dataset.theme = 'archive'
  probe.hidden = true
  document.body.append(probe)
  try {
    const styles = getComputedStyle(probe)
    const read = (token: string): string => {
      const value = styles.getPropertyValue(token).trim()
      if (!value) throw new Error(`Theme token ${token} is missing`)
      return value
    }
    return {
      surface: read('--color-surface'),
      ink: read('--color-ink'),
      inkMuted: read('--color-ink-muted'),
      brand: read('--color-brand'),
      lineStrong: read('--color-line-strong'),
    }
  } finally {
    probe.remove()
  }
}

/**
 * Loads exactly the two faces the pin uses (Fraunces 600, Inter 500) for the characters it
 * will draw. Resolves false when a face is not declared or its file cannot load, so the
 * caller can refuse to export a pin set in a fallback font.
 */
export async function loadPinFonts(text: string): Promise<boolean> {
  try {
    const [fraunces, inter] = await Promise.all([
      document.fonts.load(`600 ${TITLE_START_SIZE}px "Fraunces"`, text),
      document.fonts.load(`500 ${LABEL_SIZE}px "Inter"`, text),
    ])
    return fraunces.length > 0 && inter.length > 0
  } catch {
    return false
  }
}

export interface PinPhotos {
  before: ImageBitmap
  after: ImageBitmap
}

async function loadBitmap(url: string): Promise<ImageBitmap> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Photo failed to load (${response.status})`)
  const blob = await response.blob()
  // from-image applies the Exif rotation to the pixels, so a portrait photo draws upright.
  return createImageBitmap(blob, { imageOrientation: 'from-image' })
}

/** Fetches and decodes both photos. If one fails the other is released before the error is thrown. */
export async function loadPinPhotos(beforeUrl: string, afterUrl: string): Promise<PinPhotos> {
  const [before, after] = await Promise.allSettled([loadBitmap(beforeUrl), loadBitmap(afterUrl)])
  if (before.status === 'fulfilled' && after.status === 'fulfilled') {
    return { before: before.value, after: after.value }
  }
  if (before.status === 'fulfilled') before.value.close()
  if (after.status === 'fulfilled') after.value.close()
  const failure = before.status === 'rejected' ? before : after
  throw failure.status === 'rejected' ? failure.reason : new Error('Photo failed to load')
}

export function closePinPhotos(photos: PinPhotos): void {
  photos.before.close()
  photos.after.close()
}

/** Greedy word wrap on the current ctx.font. A single word wider than the line is split by character. */
function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const fits = (value: string) => ctx.measureText(value).width <= maxWidth
  const lines: string[] = []
  let current = ''
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = current ? `${current} ${word}` : word
    if (fits(candidate)) {
      current = candidate
      continue
    }
    if (current) lines.push(current)
    let rest = Array.from(word)
    while (rest.length > 1 && !fits(rest.join(''))) {
      let end = rest.length - 1
      while (end > 1 && !fits(rest.slice(0, end).join(''))) end--
      lines.push(rest.slice(0, end).join(''))
      rest = rest.slice(end)
    }
    current = rest.join('')
  }
  if (current) lines.push(current)
  return lines
}

/** Starts at 64px and steps down 4px until the title fits in 3 lines. Leaves ctx.font at the chosen size. */
function fitTitle(ctx: CanvasRenderingContext2D, title: string): { size: number; lines: string[] } {
  const maxWidth = PIN_WIDTH - MARGIN * 2
  let size = TITLE_START_SIZE
  for (;;) {
    ctx.font = `600 ${size}px ${SERIF}`
    const lines = wrapLines(ctx, title, maxWidth)
    if (lines.length <= TITLE_MAX_LINES || size - TITLE_STEP < TITLE_HARD_FLOOR) return { size, lines }
    size -= TITLE_STEP
  }
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  bitmap: ImageBitmap,
  x: number,
  y: number,
  colors: PinColors
): void {
  // Center-crop to fill the frame: scale to cover, then take the middle of the source.
  const scale = Math.max(FRAME_WIDTH / bitmap.width, FRAME_HEIGHT / bitmap.height)
  const sourceWidth = FRAME_WIDTH / scale
  const sourceHeight = FRAME_HEIGHT / scale
  const sourceX = (bitmap.width - sourceWidth) / 2
  const sourceY = (bitmap.height - sourceHeight) / 2

  ctx.save()
  ctx.beginPath()
  ctx.roundRect(x, y, FRAME_WIDTH, FRAME_HEIGHT, FRAME_RADIUS)
  ctx.clip()
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, sourceX, sourceY, sourceWidth, sourceHeight, x, y, FRAME_WIDTH, FRAME_HEIGHT)
  ctx.restore()

  ctx.strokeStyle = colors.lineStrong
  ctx.lineWidth = FRAME_OUTLINE
  ctx.beginPath()
  ctx.roundRect(
    x + FRAME_OUTLINE / 2,
    y + FRAME_OUTLINE / 2,
    FRAME_WIDTH - FRAME_OUTLINE,
    FRAME_HEIGHT - FRAME_OUTLINE,
    FRAME_RADIUS
  )
  ctx.stroke()
}

export interface PinDrawInput {
  title: string
  beforeTakenOn: string
  afterTakenOn: string
  photos: PinPhotos
  colors: PinColors
}

/** Every character the pin can draw, for loadPinFonts. */
export function pinFontText(title: string, beforeTakenOn: string, afterTakenOn: string): string {
  return `${title} Before After ${shortMonthYear(beforeTakenOn)} ${shortMonthYear(afterTakenOn)} ${SITE_HOST}`
}

/** Draws the whole pin. Synchronous: fonts and photos are loaded before this is called. */
export function drawPin(canvas: HTMLCanvasElement, input: PinDrawInput): void {
  canvas.width = PIN_WIDTH
  canvas.height = PIN_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is not available')
  const { colors, photos } = input

  ctx.fillStyle = colors.surface
  ctx.fillRect(0, 0, PIN_WIDTH, PIN_HEIGHT)

  // Title: centered, wrapped, and centered vertically inside its zone at the top.
  const { size, lines } = fitTitle(ctx, input.title.trim())
  const lineHeight = size * TITLE_LINE_HEIGHT
  const blockTop = TITLE_TOP + (TITLE_ZONE_HEIGHT - lineHeight * lines.length) / 2
  ctx.fillStyle = colors.ink
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  lines.forEach((line, index) => {
    ctx.fillText(line, PIN_WIDTH / 2, blockTop + lineHeight * (index + 0.5))
  })

  // Photo frames, then the label and date under each.
  const leftX = MARGIN
  const rightX = MARGIN + FRAME_WIDTH + FRAME_GAP
  drawFrame(ctx, photos.before, leftX, FRAMES_TOP, colors)
  drawFrame(ctx, photos.after, rightX, FRAMES_TOP, colors)

  const columns = [
    { x: leftX, label: 'Before', date: shortMonthYear(input.beforeTakenOn) },
    { x: rightX, label: 'After', date: shortMonthYear(input.afterTakenOn) },
  ]
  for (const column of columns) {
    const centerX = column.x + FRAME_WIDTH / 2
    ctx.fillStyle = colors.ink
    ctx.font = `500 ${LABEL_SIZE}px ${SANS}`
    ctx.fillText(column.label, centerX, FRAMES_TOP + FRAME_HEIGHT + LABEL_OFFSET)
    ctx.fillStyle = colors.inkMuted
    ctx.font = `500 ${DATE_SIZE}px ${SANS}`
    ctx.fillText(column.date, centerX, FRAMES_TOP + FRAME_HEIGHT + DATE_OFFSET)
  }

  // The only branding: the domain, centered at the bottom.
  ctx.fillStyle = colors.brand
  ctx.font = `600 ${DOMAIN_SIZE}px ${SERIF}`
  ctx.fillText(SITE_HOST, PIN_WIDTH / 2, DOMAIN_CENTER)
}

/** The canvas as a PNG. Always PIN_WIDTH by PIN_HEIGHT pixels, whatever size it is shown at. */
export function pinToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('The browser could not make the PNG'))
    }, 'image/png')
  })
}
