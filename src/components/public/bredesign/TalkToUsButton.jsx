/* Hakum's Facebook page (owner-supplied, 9 Oct 2026). It opens the page, where
   the customer taps Message; an m.me/<username> link would open the chat
   directly once the page has a username. */
export const HAKUM_MESSENGER_URL = 'https://www.facebook.com/p/Hakum-Auto-Care-61573318005308/'

/** The one way to reach the team from a service page: a single button that
 *  stays in the corner while the reader scrolls, instead of one per card. */
export default function TalkToUsButton() {
  return (
    <a
      className="bd-talk-fab"
      href={HAKUM_MESSENGER_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Talk to us on Messenger (opens Facebook in a new tab)"
    >
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 2C6.4 2 2 6.1 2 11.6c0 2.9 1.2 5.4 3.2 7.1V22l3-1.6c1.2.3 2.4.5 3.8.5 5.6 0 10-4.1 10-9.4S17.6 2 12 2zm1 12.6-2.5-2.7-5 2.7 5.5-5.8 2.6 2.7 4.9-2.7-5.5 5.8z" />
      </svg>
      <span>Talk to us</span>
    </a>
  )
}
