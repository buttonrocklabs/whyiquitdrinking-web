import {
  CONSENT_KEYS,
  CONSENT_LABELS,
  CONSENT_VERSION,
  USE_KEYS,
  type ConsentKey,
} from '../../shared/consent'
import { PAIR_ERRORS, checkPair, hasPairInput } from '../../shared/pair'
import {
  hashToken,
  json,
  newManageToken,
  photoUrl,
  photosByStory,
  readPhoto,
  type Env,
  type PhotoRow,
  type StoryRow,
} from '../_lib'

const MAX_STORY_CHARS = 4000

interface Upload {
  /** 'legacy' is the single optional photo on a story without a pair. */
  kind: 'legacy' | 'before' | 'after'
  key: string
  mime: string
  bytes: ArrayBuffer
  takenOn: string
}

/** A real file from the form, or null for a missing field or an empty file input. */
function fileField(form: FormData, name: string): File | null {
  const value = form.get(name)
  return value instanceof File && value.size > 0 ? value : null
}

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const [{ results }, { results: photoRows }] = await Promise.all([
    env.DB.prepare(
      `SELECT id, display_name, story_text, photo_key, submitted_at
       FROM stories
       WHERE status = 'approved'
       ORDER BY submitted_at DESC
       LIMIT 200`
    ).all<Pick<StoryRow, 'id' | 'display_name' | 'story_text' | 'photo_key' | 'submitted_at'>>(),
    // Same 200 stories as above, so the photo query never needs bound ids.
    env.DB.prepare(
      `SELECT story_id, kind, r2_key, taken_on
       FROM story_photos
       WHERE withdrawn_at IS NULL
         AND story_id IN (
           SELECT id FROM stories WHERE status = 'approved' ORDER BY submitted_at DESC LIMIT 200
         )`
    ).all<PhotoRow>(),
  ])
  const photos = photosByStory(photoRows)

  return json({
    stories: results.map((row) => ({
      id: row.id,
      displayName: row.display_name,
      storyText: row.story_text,
      photoUrl: photoUrl(row.photo_key),
      photos: photos.get(row.id) ?? [],
      submittedAt: row.submitted_at,
    })),
  })
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const form = await request.formData()

  // Honeypot: a real visitor never fills this field (hidden off-screen). The
  // reply carries a token of the same shape, never stored, so it looks identical.
  if (String(form.get('website') ?? '').trim() !== '') {
    return json({ ok: true, id: crypto.randomUUID(), manageToken: newManageToken() }, { status: 201 })
  }

  const displayName = String(form.get('display_name') ?? '').trim().slice(0, 100) || null
  const storyText = String(form.get('story_text') ?? '').trim()
  const flag = (name: string) => String(form.get(name) ?? '') === 'true'
  const consent = flag('consent')
  const photo = fileField(form, 'photo')
  const beforePhoto = fileField(form, 'before_photo')
  const afterPhoto = fileField(form, 'after_photo')
  const beforeTakenOn = String(form.get('before_taken_on') ?? '').trim()
  const afterTakenOn = String(form.get('after_taken_on') ?? '').trim()
  const email = String(form.get('email') ?? '').trim()

  if (!storyText) {
    return json({ ok: false, error: 'story_text is required' }, { status: 400 })
  }
  if (storyText.length > MAX_STORY_CHARS) {
    return json({ ok: false, error: `story_text must be ${MAX_STORY_CHARS} characters or fewer` }, { status: 400 })
  }
  if (!consent) {
    return json({ ok: false, error: 'consent is required' }, { status: 400 })
  }

  // Anything pair-shaped means the whole pair is required; without it, the
  // pair-only fields (email, 18+, pins, SM board) are dropped.
  const hasPair = hasPairInput({
    hasBeforePhoto: beforePhoto !== null,
    hasAfterPhoto: afterPhoto !== null,
    beforeTakenOn,
    afterTakenOn,
  })
  if (hasPair) {
    if (photo) {
      return json({ ok: false, error: PAIR_ERRORS.mixed }, { status: 400 })
    }
    const problem = checkPair({
      hasBeforePhoto: beforePhoto !== null,
      hasAfterPhoto: afterPhoto !== null,
      beforeTakenOn,
      afterTakenOn,
      email,
      adult: flag('adult'),
      now: new Date(),
    })
    if (problem) {
      return json({ ok: false, error: problem }, { status: 400 })
    }
  }

  const id = crypto.randomUUID()
  const submittedAt = new Date().toISOString()

  // Check every photo before anything is stored, so a refusal leaves nothing behind.
  const uploads: Upload[] = []
  const candidates: [Upload['kind'], File | null, string][] = hasPair
    ? [
        ['before', beforePhoto, beforeTakenOn],
        ['after', afterPhoto, afterTakenOn],
      ]
    : [['legacy', photo, '']]
  for (const [kind, file, takenOn] of candidates) {
    if (!file) continue
    const checked = await readPhoto(file)
    if (!checked.ok) {
      return json({ ok: false, error: checked.error }, { status: 400 })
    }
    const key = kind === 'legacy' ? `stories/${id}.${checked.ext}` : `stories/${id}/${kind}.${checked.ext}`
    uploads.push({ kind, key, mime: checked.mime, bytes: checked.bytes, takenOn })
  }

  // The server writes the consent record from its own wording, never from the client.
  const ticked = new Set<ConsentKey>(['site'])
  if (hasPair) {
    ticked.add('adult')
    if (flag('pins')) ticked.add('pins')
    if (flag('sm_board')) ticked.add('sm_board')
  }
  const uses = USE_KEYS.filter((key) => ticked.has(key))
  const consentText = CONSENT_KEYS.filter((key) => ticked.has(key))
    .map((key) => CONSENT_LABELS[key])
    .join('\n')

  const manageToken = newManageToken()
  const manageTokenHash = await hashToken(manageToken)
  const legacyKey = uploads.find((upload) => upload.kind === 'legacy')?.key ?? null

  try {
    for (const upload of uploads) {
      await env.MEDIA.put(upload.key, upload.bytes, { httpMetadata: { contentType: upload.mime } })
    }
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO stories (id, display_name, story_text, photo_key, status, consent_given, submitted_at)
         VALUES (?, ?, ?, ?, 'pending', 1, ?)`
      ).bind(id, displayName, storyText, legacyKey, submittedAt),
      env.DB.prepare(
        `INSERT INTO story_consents
           (story_id, email, adult_confirmed, uses, consent_text, consent_version, consented_at, manage_token_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        id,
        hasPair ? email : null,
        hasPair ? 1 : 0,
        JSON.stringify(uses),
        consentText,
        CONSENT_VERSION,
        submittedAt,
        manageTokenHash
      ),
      ...uploads
        .filter((upload) => upload.kind !== 'legacy')
        .map((upload) =>
          env.DB.prepare(
            `INSERT INTO story_photos (id, story_id, kind, r2_key, taken_on, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`
          ).bind(crypto.randomUUID(), id, upload.kind, upload.key, upload.takenOn, submittedAt)
        ),
    ])
  } catch (error) {
    console.error('story submit failed', error)
    // Nothing in D1 points at these objects, so none of them may be left in R2.
    try {
      await env.MEDIA.delete(uploads.map((upload) => upload.key))
    } catch (cleanupError) {
      console.error('story photo cleanup failed', cleanupError)
    }
    return json({ ok: false, error: 'Something went wrong. Try again.' }, { status: 500 })
  }

  return json({ ok: true, id, manageToken }, { status: 201 })
}
