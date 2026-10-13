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

  const status = body.action === 'approve' ? 'approved' : 'rejected'
  const rejectReason = body.action === 'reject' ? (body.rejectReason ?? null) : null

  const result = await env.DB.prepare(
    `UPDATE stories
     SET status = ?, reviewed_at = ?, reviewer = 'moderator', reject_reason = ?
     WHERE id = ? AND status = 'pending'`
  )
    .bind(status, new Date().toISOString(), rejectReason, id)
    .run()

  if (result.meta.changes === 0) {
    return json({ ok: false, error: 'story not found or already reviewed' }, { status: 404 })
  }

  // A rejected pair comes down: delete both photos from R2, then mark them withdrawn.
  if (body.action === 'reject') {
    const { results: photos } = await env.DB.prepare(
      `SELECT r2_key FROM story_photos WHERE story_id = ? AND withdrawn_at IS NULL`
    )
      .bind(id)
      .all<{ r2_key: string }>()

    if (photos.length > 0) {
      await env.MEDIA.delete(photos.map((photo) => photo.r2_key))
      await env.DB.prepare(
        `UPDATE story_photos SET withdrawn_at = ? WHERE story_id = ? AND withdrawn_at IS NULL`
      )
        .bind(new Date().toISOString(), id)
        .run()
    }
  }

  return json({ ok: true, id, status })
}
