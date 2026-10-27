import type { CSSProperties } from 'react'
import { TRANSFER_CARD_GEOMETRY, TRANSFER_TO_MASK_LAYOUT } from '../constants/transferCards'
import type { ElementSize } from '../types/ElementSize'

const { radius, notchHalfWidth, notchDepth, notchEdgeHandle, notchBottomHandle } = TRANSFER_CARD_GEOMETRY

function arcTo(inset: number, x: number, y: number): string {
  const r = radius - inset
  return `A${r} ${r} 0 0 1 ${x} ${y}`
}

function rightSide({ width, height }: ElementSize, inset: number): string {
  return `${arcTo(inset, width - inset, radius)}V${height - radius}${arcTo(inset, width - radius, height - inset)}`
}

function leftSide({ height }: ElementSize, inset: number): string {
  return `H${radius}${arcTo(inset, inset, height - radius)}V${radius}${arcTo(inset, radius, inset)}`
}

function notchCurves(center: number, edge: number): string {
  const bottom = edge + notchDepth
  return `C${center + notchEdgeHandle} ${edge} ${center + notchBottomHandle} ${bottom} ${center} ${bottom}`
    + `C${center - notchBottomHandle} ${bottom} ${center - notchEdgeHandle} ${edge} ${center - notchHalfWidth} ${edge}`
}

function notch({ width, height }: ElementSize, inset: number): string {
  const center = width / 2
  return `H${center + notchHalfWidth}${notchCurves(center, height - inset)}`
}

export function transferNotchPath(): string {
  return `M${notchHalfWidth * 2} 0${notchCurves(notchHalfWidth, 0)}Z`
}

export function transferToMaskStyle(): CSSProperties {
  const width = notchHalfWidth * 2
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${notchDepth}"><path d="${transferNotchPath()}"/></svg>`
  return {
    ...TRANSFER_TO_MASK_LAYOUT,
    maskImage: `linear-gradient(#000, #000), url("data:image/svg+xml,${encodeURIComponent(svg)}")`,
    maskSize: `100% 100%, ${width}px ${notchDepth}px`,
  }
}

export function transferFromCardPath(size: ElementSize, inset = 0): string {
  return `M${radius} ${inset}H${size.width - radius}${rightSide(size, inset)}${notch(size, inset)}${leftSide(size, inset)}Z`
}

export function transferToCardPath(size: ElementSize, inset = 0): string {
  return `M${radius} ${inset}H${size.width - radius}${rightSide(size, inset)}${leftSide(size, inset)}Z`
}

export function transferToBorderPath(size: ElementSize, inset: number): string {
  return `M${size.width - radius} ${inset}${rightSide(size, inset)}${leftSide(size, inset)}`
}
