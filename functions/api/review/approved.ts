import { isUseKey } from '../../../shared/consent'
import { json, photosByStory, reviewGate, type Env, type PhotoRow, type StoryRow } from '../../_lib'

type ApprovedRow = Pick<StoryRow, 'id' | 'display_name'> & {
  approved_at: string
  uses: string | null
}

/**
 * The use keys the contributor ticked, in the stored order. A story from before the
 * consent table agreed to the site use only. Stored text that is not a JSON array of
 * known keys yields no uses, so it can never open a pin or board use by accident.
 */
function parseUses(stored: string | null): string[] {
  if (stored === null) return ['site']
  try {
    const parsed: unknown = JSON.parse(stored)
    return Array.isArray(parsed) ? parsed.filter(isUseKey) : []
  } catch {
    return []
  }
}

// Moderator list of approved stories with their live photos and ticked uses. The pin
// builder (WIQD-14) asks for pair=1; the counts view (WIQD-18) reads the full list.
//
// What never appears: a story whose status is anything but approved (so a withdrawn story
// is out), a story whose consent row has withdrawn_at set, and any photo with withdrawn_at
// set. A story left with only one live photo has no pair, which is why pair=1 drops it.
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const denied = await reviewGate(request, env)
  if (denied) return denied

  const pairOnly = new URL(request.url).searchParams.get('pair') === '1'

  // The same filter runs in both queries, so the photo query never needs bound ids.
  const approvedStories = `
    FROM stories s
    LEFT JOIN story_consents c ON c.story_id = s.id
    WHERE s.status = 'approved' AND c.withdrawn_at IS NULL`

  const [{ results }, { results: photoRows }] = await Promise.all([
    env.DB.prepare(
      `SELECT s.id, s.display_name, COALESCE(s.reviewed_at, s.submitted_at) AS approved_at, c.uses
       ${approvedStories}
       ORDER BY approved_at DESC`
    ).all<ApprovedRow>(),
    env.DB.prepare(
      `SELECT story_id, kind, r2_key, taken_on
       FROM story_photos
       WHERE withdrawn_at IS NULL
         AND story_id IN (SELECT s.id ${approvedStories})`
    ).all<PhotoRow>(),
  ])
  const photos = photosByStory(photoRows)

  const stories = results
    .map((row) => ({
      id: row.id,
      displayName: row.display_name,
      approvedAt: row.approved_at,
      uses: parseUses(row.uses),
      photos: photos.get(row.id) ?? [],
    }))
    .filter(
      (story) =>
        !pairOnly ||
        (story.photos.some((photo) => photo.kind === 'before') &&
          story.photos.some((photo) => photo.kind === 'after'))
    )

  return json({ stories })
}
