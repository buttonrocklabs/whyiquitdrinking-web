import { CONSENT_LABELS, CONSENT_NOTE } from '../../../shared/consent'
import { EMAIL_MAX_CHARS } from '../../../shared/pair'
import SwitchRow from './SwitchRow'
import { modeOf, type FlowData } from './types'

/**
 * Step 5: the consent switches, all off until the visitor turns them on, worded exactly as
 * the server stores them. A photo pair also asks for the 18+ answer and the private-link
 * email; a single photo or a story alone shows only the site switch.
 */
export default function PrivacyStep({
  data,
  onChange,
}: {
  data: FlowData
  onChange: (change: Partial<FlowData>) => void
}) {
  const mode = modeOf(data)
  const pair = mode === 'pair'

  return (
    <div className="flex flex-col gap-4">
      <p className="text-body text-ink-muted">
        I choose where my {mode === 'none' ? 'story' : 'story and photos'} can be shown. Everything starts switched off.
      </p>

      <div role="group" aria-label="What I agree to" className="flex flex-col gap-3">
        {pair && (
          <SwitchRow checked={data.adult} onChange={(adult) => onChange({ adult })} hint="Required">
            {CONSENT_LABELS.adult}
          </SwitchRow>
        )}
        <SwitchRow checked={data.site} onChange={(site) => onChange({ site })} hint="Required">
          {CONSENT_LABELS.site}
        </SwitchRow>
        {pair && (
          <>
            <SwitchRow checked={data.pins} onChange={(pins) => onChange({ pins })} hint="Optional">
              {CONSENT_LABELS.pins}
            </SwitchRow>
            <SwitchRow checked={data.smBoard} onChange={(smBoard) => onChange({ smBoard })} hint="Optional">
              {CONSENT_LABELS.sm_board}
            </SwitchRow>
          </>
        )}
      </div>

      <p className="text-caption text-ink-muted">{CONSENT_NOTE}</p>

      {pair && (
        <div className="flex flex-col gap-2">
          <label htmlFor="email" className="text-label text-ink">
            Email for my private link
          </label>
          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            maxLength={EMAIL_MAX_CHARS}
            value={data.email}
            onChange={(event) => onChange({ email: event.target.value })}
            className="min-h-11 w-full rounded-md border border-line bg-surface-raised px-4 py-2 text-body text-ink"
          />
          <p className="text-caption text-ink-muted">It never shows on the site. It is only for sending my private link.</p>
        </div>
      )}
    </div>
  )
}
