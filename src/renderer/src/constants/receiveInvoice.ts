export const RECEIVE_QR_SIZE = 225

export const RECEIVE_QR_COPY = {
  copyImage: 'Copy image',
  saveImage: 'Save image',
  copied: 'Payment request image copied',
  copyFailed: 'Could not copy the payment request image',
} as const

export const RECEIVE_INVOICE_COPY = {
  eyebrow: 'Payment request',
  anyAmount: 'Any amount',
  pay: 'Pay',
  testnet: 'Testnet',
  brand: 'Dash',
  paymentLink: 'Payment link',
} as const

export const RECEIVE_INVOICE_ADDRESS_LABELS = {
  core: 'Dash address',
  platform: 'Platform address',
  shielded: 'Shielded address',
} as const

export const RECEIVE_INVOICE_FILE_NAME = 'dash-payment-request.png'

export const RECEIVE_INVOICE_MIME = 'image/png'

export const RECEIVE_INVOICE_MONO_FONT = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'

export const RECEIVE_INVOICE_FONT_WEIGHTS = {
  regular: 500,
  semibold: 600,
  extrabold: 800,
} as const

export const RECEIVE_INVOICE_LAYOUT = {
  width: 540,
  scale: 2,
  padding: 40,
  logoWidth: 36,
  logoHeight: 30,
  wordmarkGap: 10,
  wordmarkSize: 22,
  headerGap: 32,
  eyebrowSize: 14,
  eyebrowLine: 22,
  headlineSize: 30,
  headlineLine: 38,
  qrGap: 28,
  qrMaxSize: 300,
  labelSize: 13,
  labelLine: 22,
  addressSize: 15,
  addressLine: 22,
  linkGap: 20,
  linkSize: 12,
  linkLine: 18,
  badgeHeight: 24,
  badgePaddingX: 10,
  badgeRadius: 8,
  badgeSize: 12,
} as const

export const RECEIVE_INVOICE_COLORS = {
  background: '#FFFFFF',
  text: '#0C1C33',
  muted: 'rgba(12, 28, 51, 0.5)',
  brand: '#4C7EFF',
  badge: '#F98F12',
  badgeText: '#FFFFFF',
} as const

export const DASH_LOGO_VIEWBOX = {width: 30, height: 25} as const

export const DASH_LOGO_PATHS = [
  'M19.6465 0C29.2466 2.13767e-05 30.9542 5.2464 29.585 12.6006C28.6773 17.5547 26.3845 21.3391 22.5537 23.1084C20.8153 23.9084 19.1848 24.3555 15.3389 24.3555H4.44629L5.33887 19.293H14.9229C20.6921 19.3084 22.2159 16.8009 22.9697 14.6162C23.2467 13.8008 23.9084 11.2619 23.9238 9.76953C23.9699 6.84642 22.5383 5.07715 17.6768 5.07715L7.81543 5.06152L8.72363 0H19.6465Z',
  'M15.2002 9.63184C15.2002 9.63184 15.0775 10.232 14.7236 11.709C14.4621 12.8321 14.0462 14.6934 11.1846 14.6934H0C0.00327153 14.6775 0.12745 14.0734 0.476562 12.6162C0.73811 11.493 1.15435 9.63184 4.01562 9.63184H15.2002Z',
] as const
