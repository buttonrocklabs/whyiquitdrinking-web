import { SITE_URL, escapeHtml, type EmailMessage, type Env } from './_lib'

// Every email the site sends is written here, so the wording is in one place.
// Voice: plain, first-person-adjacent, no exclamation points, no urgency.

/** The private link, sent once when a story with a photo pair is submitted. */
export function manageLinkEmail(env: Env, manageToken: string): Omit<EmailMessage, 'to'> {
  const link = `${SITE_URL}/manage/${manageToken}`
  // Only promise a reply when a Reply-To is set; otherwise the sender address is not read.
  const canReply = Boolean(env.BREVO_REPLY_TO)

  const paragraphs = [
    'Hello,',
    'Thank you for sharing your story on Why I Quit Drinking.',
    'Here is your private link:',
    link,
    'Keep it somewhere safe. Anyone who has this link can remove your photos or your whole story, so please keep it to yourself. The link works any time, now or years from now.',
    'When you remove something, it comes off the site right away. A copy that was already loaded somewhere can linger for a few minutes. If we posted a pin with your photos, we take it down too. Copies other people have already saved elsewhere are outside our control.',
    ...(canReply ? ['If you have a question, reply to this email.'] : []),
    'Why I Quit Drinking',
  ]

  return {
    subject: 'Your private link to manage your story',
    text: paragraphs.join('\n\n'),
    html: paragraphs
      .map((paragraph) =>
        paragraph === link
          ? `<p><a href="${escapeHtml(link)}">${escapeHtml(link)}</a></p>`
          : `<p>${escapeHtml(paragraph)}</p>`
      )
      .join(''),
  }
}

export interface WithdrawNotice {
  storyId: string
  action: 'photos' | 'story'
  photosRemoved: number
  uses: string[]
  at: string
}

/** Sent to WITHDRAW_NOTIFY_EMAIL on every removal. Pins are not tracked, so this email is the whole mechanism. */
export function withdrawNoticeEmail(notice: WithdrawNotice): Omit<EmailMessage, 'to'> {
  return {
    subject: 'A WIQD story was withdrawn',
    text: [
      `Story id: ${notice.storyId}`,
      `Action: ${notice.action === 'photos' ? 'photos removed' : 'whole story removed'}`,
      `Photos removed: ${notice.photosRemoved}`,
      `Uses the contributor had agreed to: ${notice.uses.length > 0 ? notice.uses.join(', ') : 'none recorded'}`,
      `Time: ${notice.at}`,
      '',
      `If a pin was made from this story, please take it down. Pin ids start with the first 8 characters of the story id.`,
    ].join('\n'),
  }
}
