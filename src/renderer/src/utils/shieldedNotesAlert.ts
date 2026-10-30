import { SHIELDED_NOTES_ALERT_TEXTS } from '@renderer/constants/shieldedNotesAlert'

export function newShieldedNotesTitle(count: number): string {
  const noun = count === 1 ? SHIELDED_NOTES_ALERT_TEXTS.noteSingular : SHIELDED_NOTES_ALERT_TEXTS.notePlural
  return `${count.toLocaleString('en-US')} new ${noun} ${SHIELDED_NOTES_ALERT_TEXTS.newNotesLocation}`
}
