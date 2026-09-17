import { isAuthorized, json, photoUrl, type Env, type StoryRow } from '../../_lib'

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  if (!isAuthorized(request, env)) {
    return json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const { results } = await env.DB.prepare(
    `SELECT id, display_name, story_text, photo_key, submitted_at
     FROM stories
     WHERE status = 'pending'
     ORDER BY submitted_at ASC`
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
