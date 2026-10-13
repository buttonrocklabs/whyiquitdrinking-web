import { isAuthorized, json, type Env } from '../../_lib'

interface ReviewAction {
  action: 'approve' | 'reject'
  rejectReason?: string
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env, params }) => {
  if (!isAuthorized(request, env)) {
    return json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const id = String(params.id)
  const body = (await request.json()) as Partial<ReviewAction>

  if (body.action !== 'approve' && body.action !== 'reject') {
    return json({ ok: false, error: "action must be 'approve' or 'reject'" }, { status: 400 })
  }

  if (body.action === 'reject') {
    return reject(env, id, body.rejectReason ?? null)
  }

  const result = await env.DB.prepare(
    `UPDATE stories
     SET status = 'approved', reviewed_at = ?, reviewer = 'moderator', reject_reason = NULL
     WHERE id = ? AND status = 'pending'`
  )
    .bind(new Date().toISOString(), id)
    .run()

  if (result.meta.changes === 0) {
    return json({ ok: false, error: 'story not found or already reviewed' }, { status: 404 })
  }

  return json({ ok: true, id, status: 'approved' })
}

// A rejected story comes down with its photos. The photos go first: if the R2 delete
// throws, D1 is untouched and the story is still pending, so the moderator can retry.
// Flipping the status first would leave the photos public at /media/stories/<id>/...
// with the retry hitting the status = 'pending' guard.
async function reject(env: Env, id: string, rejectReason: string | null): Promise<Response> {
  // Only a pending story's photos may be deleted here; an approved one is live.
  const story = await env.DB.prepare(`SELECT photo_key FROM stories WHERE id = ? AND status = 'pending'`)
    .bind(id)
    .first<{ photo_key: string | null }>()

  if (!story) {
    return json({ ok: false, error: 'story not found or already reviewed' }, { status: 404 })
  }

  const { results: photos } = await env.DB.prepare(
    `SELECT r2_key FROM story_photos WHERE story_id = ? AND withdrawn_at IS NULL`
  )
    .bind(id)
    .all<{ r2_key: string }>()

  // The pair photos plus the legacy single photo. A key already gone from R2 counts as deleted.
  const keys = new Set(photos.map((photo) => photo.r2_key))
  if (story.photo_key) keys.add(story.photo_key)

  if (keys.size > 0) {
    try {
      await env.MEDIA.delete([...keys])
    } catch (error) {
      console.error('review reject: photo delete failed', error)
      return json(
        { ok: false, error: 'Could not remove the photos. The story is still pending, try again.' },
        { status: 500 }
      )
    }
  }

  const reviewedAt = new Date().toISOString()
  const [update] = await env.DB.batch([
    env.DB.prepare(
      `UPDATE stories
       SET status = 'rejected', reviewed_at = ?, reviewer = 'moderator', reject_reason = ?, photo_key = NULL
       WHERE id = ? AND status = 'pending'`
    ).bind(reviewedAt, rejectReason, id),
    env.DB.prepare(`UPDATE story_photos SET withdrawn_at = ? WHERE story_id = ? AND withdrawn_at IS NULL`).bind(
      reviewedAt,
      id
    ),
  ])

  if (update.meta.changes === 0) {
    return json({ ok: false, error: 'story not found or already reviewed' }, { status: 404 })
  }

  return json({ ok: true, id, status: 'rejected' })
}
