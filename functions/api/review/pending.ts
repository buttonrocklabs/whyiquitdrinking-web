import {
  isAuthorized,
  json,
  photoUrl,
  photosByStory,
  type Env,
  type PhotoRow,
  type StoryRow,
} from '../../_lib'

type PendingRow = Pick<StoryRow, 'id' | 'display_name' | 'story_text' | 'photo_key' | 'submitted_at'> & {
  uses: string | null
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  if (!isAuthorized(request, env)) {
    return json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const [{ results }, { results: photoRows }] = await Promise.all([
    env.DB.prepare(
      `SELECT s.id, s.display_name, s.story_text, s.photo_key, s.submitted_at, c.uses
       FROM stories s
       LEFT JOIN story_consents c ON c.story_id = s.id
       WHERE s.status = 'pending'
       ORDER BY s.submitted_at ASC`
    ).all<PendingRow>(),
    env.DB.prepare(
      `SELECT story_id, kind, r2_key, taken_on
       FROM story_photos
       WHERE withdrawn_at IS NULL
         AND story_id IN (SELECT id FROM stories WHERE status = 'pending')`
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
      // Stories from before the consent table agreed to the site use only.
      uses: row.uses ? (JSON.parse(row.uses) as string[]) : ['site'],
      submittedAt: row.submitted_at,
    })),
  })
}
