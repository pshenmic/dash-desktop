export const RECEIVE_EMPTY_TEXTS = {
  noCoreAddresses: 'No unused Core addresses available',
  platformLoadFailed: 'Failed to load platform addresses',
  noPlatformAddresses: 'No unused Platform addresses available',
} as const

export const RECEIVE_AMOUNT_INPUT ='w-full rounded-[.875rem] dash-block px-4 py-3.5 text-sm font-medium dash-text-default outline-none placeholder:text-current placeholder:opacity-40 focus-visible:ring-2 focus-visible:ring-dash-brand dark:focus-visible:ring-dash-mint'

export const SHIELDED_RECEIVE_CARD_WIDTH = 'w-full max-w-190'

export const RECEIVE_QR_FRAME = 'group relative shrink-0 rounded-[.5625rem]'

export const RECEIVE_QR_OVERLAY = 'absolute -inset-2 flex flex-col items-center justify-center gap-2 rounded-[.875rem] bg-white/85 backdrop-blur-[3px] opacity-0 transition-opacity duration-200 group-hover:opacity-100 has-[:focus-visible]:opacity-100 dark:bg-dash-primary-dark-blue/85'

export const RECEIVE_QR_ACTION = 'w-36 normal-case!'
