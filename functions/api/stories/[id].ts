import { json, photoUrl, type Env, type StoryRow } from '../../_lib'

// Public permalink read. Only approved stories resolve; pending, rejected and
// unknown ids all return the same 404 so the endpoint reveals nothing about
// the moderation queue.
export const onRequestGet: PagesFunction<Env> = async ({ env, params }) => {
  const id = String(params.id)

  const row = await env.DB.prepare(
    `SELECT id, display_name, story_text, photo_key, submitted_at
     FROM stories
     WHERE id = ? AND status = 'approved'`
  )
    .bind(id)
    .first<Pick<StoryRow, 'id' | 'display_name' | 'story_text' | 'photo_key' | 'submitted_at'>>()

  if (!row) {
    return json({ ok: false, error: 'story not found' }, { status: 404 })
  }

  return json({
    story: {
      id: row.id,
      displayName: row.display_name,
      storyText: row.story_text,
      photoUrl: photoUrl(row.photo_key),
      submittedAt: row.submitted_at,
    },
  })
}
