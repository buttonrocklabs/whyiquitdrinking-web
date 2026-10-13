import { withdrawNoticeEmail } from '../../_emails'
import {
  hashToken,
  json,
  photoUrl,
  photosByStory,
  sendEmail,
  type Env,
  type PhotoRow,
  type StoryRow,
} from '../../_lib'

// The contributor's private manage link (WIQD-16). The token is the only
// credential; story_consents holds its SHA-256 hash, never the token itself.
// Unknown, malformed and revoked tokens all answer the same 404.

const TOKEN_SHAPE = /^[A-Za-z0-9_-]{16,128}$/

/** A manage page is private to whoever holds the link, so nothing about it is cached. */
const PRIVATE = { 'cache-control': 'no-store' }

interface ManageRow {
  id: string
  status: StoryRow['status']
  display_name: string | null
  story_text: string
  photo_key: string | null
  submitted_at: string
  uses: string
  consent_withdrawn_at: string | null
}

type PhotoWithdrawal = PhotoRow & { withdrawn_at: string | null }

async function findStory(env: Env, token: string): Promise<ManageRow | null> {
  if (!TOKEN_SHAPE.test(token)) return null
  // The email column is deliberately not selected: no manage response ever carries it.
  return env.DB.prepare(
    `SELECT s.id, s.status, s.display_name, s.story_text, s.photo_key, s.submitted_at,
            c.uses, c.withdrawn_at AS consent_withdrawn_at
     FROM story_consents c
     JOIN stories s ON s.id = c.story_id
     WHERE c.manage_token_hash = ?`
  )
    .bind(await hashToken(token))
    .first<ManageRow>()
}

function notFound(): Response {
  return json({ ok: false, error: 'not_found' }, { status: 404, headers: PRIVATE })
}

export const onRequestGet: PagesFunction<Env> = async ({ env, params }) => {
  const row = await findStory(env, String(params.token))
  if (!row) return notFound()

  const { results: photoRows } = await env.DB.prepare(
    `SELECT story_id, kind, r2_key, taken_on, withdrawn_at FROM story_photos WHERE story_id = ?`
  )
    .bind(row.id)
    .all<PhotoWithdrawal>()

  const active = photoRows.filter((photo) => photo.withdrawn_at === null)
  const hasPhotos = active.length > 0 || row.photo_key !== null
  // The latest day a photo came down, shown only once none are left.
  const withdrawnDates = photoRows.flatMap((photo) => (photo.withdrawn_at ? [photo.withdrawn_at] : []))
  const photosRemovedOn = !hasPhotos && withdrawnDates.length > 0 ? withdrawnDates.sort().at(-1)! : null

  return json(
    {
      ok: true,
      status: row.status,
      hasPhotos,
      photosRemovedOn,
      storyRemovedOn: row.status === 'withdrawn' ? row.consent_withdrawn_at : null,
      // A removed story has nothing left to show.
      story:
        row.status === 'withdrawn'
          ? null
          : {
              id: row.id,
              displayName: row.display_name,
              storyText: row.story_text,
              photoUrl: photoUrl(row.photo_key),
              photos: photosByStory(active).get(row.id) ?? [],
              submittedAt: row.submitted_at,
            },
    },
    { headers: PRIVATE }
  )
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env, params, waitUntil }) => {
  let action: unknown
  try {
    action = ((await request.json()) as { action?: unknown } | null)?.action
  } catch {
    action = undefined
  }
  if (action !== 'photos' && action !== 'story') {
    return json({ ok: false, error: "action must be 'photos' or 'story'" }, { status: 400, headers: PRIVATE })
  }

  const row = await findStory(env, String(params.token))
  if (!row) return notFound()

  // Repeating a removal is harmless: a story already removed reports that, whichever action came in.
  if (row.status === 'withdrawn') {
    return json({ ok: true, state: 'story_removed' }, { headers: PRIVATE })
  }

  const { results: photoRows } = await env.DB.prepare(
    `SELECT story_id, kind, r2_key, taken_on, withdrawn_at FROM story_photos WHERE story_id = ?`
  )
    .bind(row.id)
    .all<PhotoWithdrawal>()

  // Every photo object this story ever had, pair and legacy. A key already gone from R2 counts as deleted.
  const keys = new Set(photoRows.map((photo) => photo.r2_key))
  if (row.photo_key) keys.add(row.photo_key)
  const photosRemoved = photoRows.filter((photo) => photo.withdrawn_at === null).length + (row.photo_key ? 1 : 0)

  // R2 first, D1 second. If the delete throws, D1 is untouched and the same request can be retried;
  // flipping the rows first would leave the photos public with nothing pointing at them.
  if (keys.size > 0) {
    try {
      await env.MEDIA.delete([...keys])
    } catch (error) {
      console.error('manage: photo delete failed', error)
      return json(
        { ok: false, error: 'delete_failed', message: 'Could not remove the photos. Nothing changed, try again.' },
        { status: 500, headers: PRIVATE }
      )
    }
  }

  const now = new Date().toISOString()
  const markPhotos = env.DB.prepare(
    `UPDATE story_photos SET withdrawn_at = ? WHERE story_id = ? AND withdrawn_at IS NULL`
  ).bind(now, row.id)

  if (action === 'photos') {
    await env.DB.batch([markPhotos, env.DB.prepare(`UPDATE stories SET photo_key = NULL WHERE id = ?`).bind(row.id)])
  } else {
    // The whole story: text and name blanked, email cleared. The token hash stays so the link can say "removed".
    // story_text is NOT NULL, so it is blanked to an empty string.
    await env.DB.batch([
      markPhotos,
      env.DB.prepare(
        `UPDATE stories SET status = 'withdrawn', story_text = '', display_name = NULL, photo_key = NULL WHERE id = ?`
      ).bind(row.id),
      env.DB.prepare(`UPDATE story_consents SET email = NULL, withdrawn_at = ? WHERE story_id = ?`).bind(now, row.id),
    ])
  }

  // Someone has to take down any pin made from this story. A photos request with no photos left
  // (a repeat) changed nothing, so it sends nothing.
  if (env.WITHDRAW_NOTIFY_EMAIL && (action === 'story' || photosRemoved > 0)) {
    let uses: string[] = []
    try {
      uses = JSON.parse(row.uses) as string[]
    } catch {
      // An unreadable uses column still gets its notice, with the uses left out.
    }
    waitUntil(
      sendEmail(env, {
        to: env.WITHDRAW_NOTIFY_EMAIL,
        ...withdrawNoticeEmail({ storyId: row.id, action, photosRemoved, uses, at: now }),
      }).catch((error) => console.error('manage: withdraw notice failed', error))
    )
  }

  return json({ ok: true, state: action === 'photos' ? 'photos_removed' : 'story_removed' }, { headers: PRIVATE })
}
