import {
  DASH_LOGO_PATHS,
  DASH_LOGO_VIEWBOX,
  RECEIVE_INVOICE_COLORS,
  RECEIVE_INVOICE_COPY,
  RECEIVE_INVOICE_FONT_WEIGHTS,
  RECEIVE_INVOICE_LAYOUT,
  RECEIVE_INVOICE_MIME,
  RECEIVE_INVOICE_MONO_FONT,
} from '../constants/receiveInvoice'
import type { ReceiveInvoice, ReceiveInvoiceQr } from '../types/ReceiveInvoice'
import { receiveInvoiceHeadline, wrapByWidth } from './receiveInvoice'

export function receiveInvoiceQr(container: HTMLElement | null): ReceiveInvoiceQr {
  const svg = container?.querySelector('svg')
  const path = svg?.querySelector('path:last-of-type')?.getAttribute('d')
  if (svg == null || path == null) throw new Error('The QR code is not rendered')
  return {path, modules: svg.viewBox.baseVal.width}
}

export function drawReceiveInvoice(invoice: ReceiveInvoice, qr: ReceiveInvoiceQr): HTMLCanvasElement {
  const layout = RECEIVE_INVOICE_LAYOUT
  const colors = RECEIVE_INVOICE_COLORS
  const weights = RECEIVE_INVOICE_FONT_WEIGHTS
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (context == null) throw new Error('Canvas drawing is unavailable')

  const sans = getComputedStyle(document.body).fontFamily
  const font = (weight: number, size: number, family = sans): string => `${weight} ${size}px ${family}`
  const labelFont = font(weights.regular, layout.labelSize)
  const headlineFont = font(weights.extrabold, layout.headlineSize)
  const addressFont = font(weights.regular, layout.addressSize, RECEIVE_INVOICE_MONO_FONT)
  const linkFont = font(weights.regular, layout.linkSize, RECEIVE_INVOICE_MONO_FONT)
  const innerWidth = layout.width - layout.padding * 2
  const wrap = (units: string[], lineFont: string): string[] => {
    context.font = lineFont
    return wrapByWidth(units, innerWidth, line => context.measureText(line).width)
  }

  const headline = wrap(receiveInvoiceHeadline(invoice.amount).split(/(?<= )/), headlineFont)
  const address = wrap([...invoice.address], addressFont)
  const link = invoice.paymentLink == null ? [] : wrap([...invoice.paymentLink], linkFont)
  const cell = Math.floor(layout.qrMaxSize / qr.modules)
  const qrSize = cell * qr.modules
  const linkHeight = link.length > 0 ? layout.linkGap + layout.labelLine + link.length * layout.linkLine : 0
  const height = layout.padding * 2 + layout.logoHeight + layout.headerGap + layout.eyebrowLine
    + headline.length * layout.headlineLine + layout.qrGap * 2 + qrSize
    + layout.labelLine + address.length * layout.addressLine + linkHeight

  canvas.width = layout.width * layout.scale
  canvas.height = height * layout.scale
  context.scale(layout.scale, layout.scale)
  context.fillStyle = colors.background
  context.fillRect(0, 0, layout.width, height)

  context.save()
  context.translate(layout.padding, layout.padding)
  context.scale(layout.logoWidth / DASH_LOGO_VIEWBOX.width, layout.logoHeight / DASH_LOGO_VIEWBOX.height)
  context.fillStyle = colors.brand
  DASH_LOGO_PATHS.forEach(path => context.fill(new Path2D(path)))
  context.restore()

  const headerMiddle = layout.padding + layout.logoHeight / 2
  context.textBaseline = 'middle'
  context.textAlign = 'left'
  context.font = font(weights.extrabold, layout.wordmarkSize)
  context.fillStyle = colors.text
  context.fillText(RECEIVE_INVOICE_COPY.brand, layout.padding + layout.logoWidth + layout.wordmarkGap, headerMiddle)

  context.textAlign = 'center'
  if (invoice.network === 'testnet') {
    context.font = font(weights.semibold, layout.badgeSize)
    const badgeWidth = context.measureText(RECEIVE_INVOICE_COPY.testnet).width + layout.badgePaddingX * 2
    const badgeX = layout.width - layout.padding - badgeWidth
    context.fillStyle = colors.badge
    context.beginPath()
    context.roundRect(badgeX, headerMiddle - layout.badgeHeight / 2, badgeWidth, layout.badgeHeight, layout.badgeRadius)
    context.fill()
    context.fillStyle = colors.badgeText
    context.fillText(RECEIVE_INVOICE_COPY.testnet, badgeX + badgeWidth / 2, headerMiddle)
  }

  let y = layout.padding + layout.logoHeight + layout.headerGap
  const writeLines = (lines: string[], lineFont: string, color: string, lineHeight: number): void => {
    context.font = lineFont
    context.fillStyle = color
    for (const line of lines) {
      context.fillText(line, layout.width / 2, y + lineHeight / 2)
      y += lineHeight
    }
  }

  writeLines([RECEIVE_INVOICE_COPY.eyebrow], font(weights.semibold, layout.eyebrowSize), colors.muted, layout.eyebrowLine)
  writeLines(headline, headlineFont, colors.text, layout.headlineLine)
  y += layout.qrGap

  context.save()
  context.translate((layout.width - qrSize) / 2, y)
  context.scale(cell, cell)
  context.fillStyle = colors.text
  context.fill(new Path2D(qr.path))
  context.restore()
  y += qrSize + layout.qrGap

  writeLines([invoice.addressLabel], labelFont, colors.muted, layout.labelLine)
  writeLines(address, addressFont, colors.text, layout.addressLine)
  if (link.length > 0) {
    y += layout.linkGap
    writeLines([RECEIVE_INVOICE_COPY.paymentLink], labelFont, colors.muted, layout.labelLine)
    writeLines(link, linkFont, colors.text, layout.linkLine)
  }
  return canvas
}

export function receiveInvoicePng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(png => png == null ? reject(new Error('The image could not be encoded')) : resolve(png), RECEIVE_INVOICE_MIME)
  })
}
