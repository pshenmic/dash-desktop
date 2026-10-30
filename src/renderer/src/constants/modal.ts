import { ModalActionTone } from '../enums/ModalActionTone'
import { ModalSize } from '../enums/ModalSize'

export const MODAL_MAX_WIDTH: Record<ModalSize, string> = {
  [ModalSize.Sm]: '24rem',
  [ModalSize.Md]: '30rem',
  [ModalSize.Lg]: '42rem',
}

export const MODAL_HORIZONTAL_MARGIN = 16

export const MODAL_CLASS_NAME = [
  'max-h-[calc(100dvh-2rem)] overflow-y-auto !rounded-3xl !p-6 !gap-0 !z-99 !shadow-[0_0_64px_0_rgba(12,28,51,0.24)]',
  '!bg-white dark:!bg-white/12 dark:backdrop-blur-[2rem] animate-[modal-fade-in_0.22s_cubic-bezier(0.16,1,0.3,1)]',
  '[div:has(+&)]:!z-99 [div:has(+&)]:!bg-dash-primary-dark-blue/40 [.dark_div:has(+&)]:!bg-dash-primary-dark-blue/72',
  '[div:has(+&)]:animate-[overlay-fade-in_0.18s_ease-out]',
  '[&>div:first-child]:!mb-2 [&>div:first-child>h2]:!font-extrabold [&>div:first-child>h2]:!tracking-normal',
  '[&>div:first-child>button]:!text-dash-primary-dark-blue dark:[&>div:first-child>button]:!text-white',
  '[&>div:first-child>button_svg]:!text-current',
].join(' ')

export const MODAL_ACTION_COLOR_SCHEME: Record<ModalActionTone, 'primary' | 'red-strong'> = {
  [ModalActionTone.Primary]: 'primary',
  [ModalActionTone.Danger]: 'red-strong',
}
