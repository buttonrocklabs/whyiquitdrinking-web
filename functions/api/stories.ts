import { json, photoUrl, type Env, type StoryRow } from '../_lib'

const MAX_PHOTO_BYTES = 8 * 1024 * 1024
const MAX_STORY_CHARS = 4000

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const { results } = await env.DB.prepare(
    `SELECT id, display_name, story_text, photo_key, submitted_at
     FROM stories
     WHERE status = 'approved'
     ORDER BY submitted_at DESC
     LIMIT 200`
  ).all<Pick<StoryRow, 'id' | 'display_name' | 'story_text' | 'photo_key' | 'submitted_at'>>()

  return json({
    stories: results.map((row) => ({
      id: row.id,
      displayName: row.display_name,
      storyText: row.story_text,
      photoUrl: photoUrl(row.photo_key),
      submittedAt: row.submitted_at,
    })),
  })
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const form = await request.formData()

  // Honeypot: a real visitor never fills this field (hidden off-screen).
  if (String(form.get('website') ?? '').trim() !== '') {
    return json({ ok: true, id: crypto.randomUUID() }, { status: 201 })
  }

  const displayName = String(form.get('display_name') ?? '').trim().slice(0, 100) || null
  const storyText = String(form.get('story_text') ?? '').trim()
  const consent = String(form.get('consent') ?? '') === 'true'
  const photo = form.get('photo')

  if (!storyText) {
    return json({ ok: false, error: 'story_text is required' }, { status: 400 })
  }
  if (storyText.length > MAX_STORY_CHARS) {
    return json({ ok: false, error: `story_text must be ${MAX_STORY_CHARS} characters or fewer` }, { status: 400 })
  }
  if (!consent) {
    return json({ ok: false, error: 'consent is required' }, { status: 400 })
  }

  const id = crypto.randomUUID()
  let photoKey: string | null = null

  if (photo instanceof File && photo.size > 0) {
    if (photo.size > MAX_PHOTO_BYTES) {
      return json({ ok: false, error: 'photo must be 8MB or smaller' }, { status: 400 })
    }
    if (!photo.type.startsWith('image/')) {
      return json({ ok: false, error: 'photo must be an image' }, { status: 400 })
    }
    const ext = photo.type.split('/')[1]?.split('+')[0] || 'jpg'
    photoKey = `stories/${id}.${ext}`
    await env.MEDIA.put(photoKey, await photo.arrayBuffer(), {
      httpMetadata: { contentType: photo.type },
    })
  }

  await env.DB.prepare(
    `INSERT INTO stories (id, display_name, story_text, photo_key, status, consent_given, submitted_at)
     VALUES (?, ?, ?, ?, 'pending', 1, ?)`
  )
    .bind(id, displayName, storyText, photoKey, new Date().toISOString())
    .run()

  return json({ ok: true, id }, { status: 201 })
}
