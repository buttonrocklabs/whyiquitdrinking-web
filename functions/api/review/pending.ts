import { CONSENT_LABELS, isUseKey } from '../../../shared/consent'
import {
  json,
  photoUrl,
  photosByStory,
  reviewGate,
  type Env,
  type PhotoRow,
  type StoryRow,
} from '../../_lib'

type PendingRow = Pick<StoryRow, 'id' | 'display_name' | 'story_text' | 'photo_key' | 'submitted_at'> & {
  uses: string | null
  consent_text: string | null
}

/**
 * The wording the contributor actually agreed to, one line per box. This is the stored
 * consent_text, which stays true after the shared wording changes. Only when nothing was
 * stored (a story from before the consent table) does it fall back to the current labels.
 */
function agreedTo(storedText: string | null, uses: string[]): string[] {
  const stored = (storedText ?? '').split('\n').filter((line) => line.trim() !== '')
  if (stored.length > 0) return stored
  return uses.filter(isUseKey).map((use) => CONSENT_LABELS[use])
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const denied = await reviewGate(request, env)
  if (denied) return denied

  const [{ results }, { results: photoRows }] = await Promise.all([
    env.DB.prepare(
      `SELECT s.id, s.display_name, s.story_text, s.photo_key, s.submitted_at, c.uses, c.consent_text
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
    stories: results.map((row) => {
      // Stories from before the consent table agreed to the site use only.
      const uses = row.uses ? (JSON.parse(row.uses) as string[]) : ['site']
      return {
        id: row.id,
        displayName: row.display_name,
        storyText: row.story_text,
        photoUrl: photoUrl(row.photo_key),
        photos: photos.get(row.id) ?? [],
        uses,
        agreedTo: agreedTo(row.consent_text, uses),
        submittedAt: row.submitted_at,
      }
    }),
  })
}
