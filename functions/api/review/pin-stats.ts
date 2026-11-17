import { json, reviewGate, type Env } from '../../_lib'

interface PinStatsRow {
  pin_id: string
  first_at: string
  visits: number
  submitted: number
  approved: number
  sm_clicks: number
}

/**
 * WIQD-17: counts per pin id for the moderator Counts tab, newest first by each pin's first
 * event. Submitted = every submit event, counted at submit time. Approved = those whose story
 * is approved now. Same passphrase gate as the other review routes.
 */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const denied = await reviewGate(request, env)
  if (denied) return denied

  const { results } = await env.DB.prepare(
    `SELECT e.pin_id AS pin_id,
            MIN(e.created_at) AS first_at,
            SUM(CASE WHEN e.event = 'visit' THEN 1 ELSE 0 END) AS visits,
            SUM(CASE WHEN e.event = 'submit' THEN 1 ELSE 0 END) AS submitted,
            SUM(CASE WHEN e.event = 'submit' AND s.status = 'approved' THEN 1 ELSE 0 END) AS approved,
            SUM(CASE WHEN e.event = 'sm_click' THEN 1 ELSE 0 END) AS sm_clicks
     FROM pin_events e
     LEFT JOIN stories s ON s.id = e.story_id
     GROUP BY e.pin_id
     ORDER BY first_at DESC
     LIMIT 500`
  ).all<PinStatsRow>()

  return json({
    pins: results.map((row) => ({
      pin: row.pin_id,
      firstAt: row.first_at,
      visits: row.visits,
      submitted: row.submitted,
      approved: row.approved,
      smClicks: row.sm_clicks,
    })),
  })
}
