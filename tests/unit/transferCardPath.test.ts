import { describe, it, expect } from 'vitest'
import { transferFromCardPath, transferNotchPath, transferToBorderPath, transferToCardPath, transferToMaskStyle } from '../../src/renderer/src/utils/transferCardPath'

const arcRadii = (path: string): string[] => [...path.matchAll(/A(\S+) (\S+) /g)].map(match => `${match[1]} ${match[2]}`)

const tongueAtOrigin = (path: string, left: number, edge: number): string => {
  const [, startX, curves] = path.match(/H([\d.]+)(C[^H]+)/) ?? []
  const shifted = curves.replace(/([\d.]+) ([\d.]+)/g, (_, x: string, y: string) => `${Number(x) - left} ${Number(y) - edge}`)
  return `M${Number(startX) - left} 0${shifted}Z`
}

describe('transferToCardPath', () => {
  it('draws a rounded rectangle in real pixels', () => {
    expect(transferToCardPath({ width: 622, height: 128 }))
      .toBe('M24 0H598A24 24 0 0 1 622 24V104A24 24 0 0 1 598 128H24A24 24 0 0 1 0 104V24A24 24 0 0 1 24 0Z')
  })

  it('keeps 24px circular corners at every size', () => {
    for (const size of [{ width: 622, height: 128 }, { width: 1183, height: 128 }, { width: 781, height: 172 }]) {
      expect(arcRadii(transferToCardPath(size))).toEqual(['24 24', '24 24', '24 24', '24 24'])
    }
  })
})

describe('transferFromCardPath', () => {
  it('cuts a fixed 240x22 notch centred on the bottom edge', () => {
    expect(transferFromCardPath({ width: 622, height: 128 })).toBe(
      'M24 0H598A24 24 0 0 1 622 24V104A24 24 0 0 1 598 128'
      + 'H431C371 128 351 150 311 150C271 150 251 128 191 128'
      + 'H24A24 24 0 0 1 0 104V24A24 24 0 0 1 24 0Z',
    )
  })

  it('keeps the notch size when the card grows', () => {
    const path = transferFromCardPath({ width: 1000, height: 200 })
    expect(path).toContain('H620C560 200 540 222 500 222C460 222 440 200 380 200H24')
    expect(arcRadii(path)).toEqual(['24 24', '24 24', '24 24', '24 24'])
  })

  it('insets the stroke half a pixel inside the fill', () => {
    const path = transferFromCardPath({ width: 622, height: 128 }, 0.5)
    expect(path.startsWith('M24 0.5H598A23.5 23.5 0 0 1 621.5 24')).toBe(true)
    expect(path).toContain('H431C371 127.5 351 149.5 311 149.5C271 149.5 251 127.5 191 127.5')
    expect(arcRadii(path)).toEqual(['23.5 23.5', '23.5 23.5', '23.5 23.5', '23.5 23.5'])
  })
})

describe('transferNotchPath', () => {
  it('is the From tongue shifted to the origin', () => {
    expect(transferNotchPath()).toBe('M240 0C180 0 160 22 120 22C80 22 60 0 0 0Z')
    expect(tongueAtOrigin(transferFromCardPath({ width: 622, height: 128 }), 191, 128)).toBe(transferNotchPath())
    expect(tongueAtOrigin(transferFromCardPath({ width: 1000, height: 200 }), 380, 200)).toBe(transferNotchPath())
    expect(tongueAtOrigin(transferFromCardPath({ width: 622, height: 128 }, 0.5), 191, 127.5)).toBe(transferNotchPath())
  })
})

describe('transferToMaskStyle', () => {
  it('cuts the notch path at its own size from the To card', () => {
    const style = transferToMaskStyle()
    expect(style.maskSize).toBe('100% 100%, 240px 22px')
    expect(style.maskImage).toContain(encodeURIComponent('viewBox="0 0 240 22"'))
    expect(style.maskImage).toContain(encodeURIComponent(`d="${transferNotchPath()}"`))
  })
})

describe('transferToBorderPath', () => {
  it('leaves the top edge open between the two top corners', () => {
    expect(transferToBorderPath({ width: 622, height: 132 }, 0.5)).toBe(
      'M598 0.5A23.5 23.5 0 0 1 621.5 24V108A23.5 23.5 0 0 1 598 131.5'
      + 'H24A23.5 23.5 0 0 1 0.5 108V24A23.5 23.5 0 0 1 24 0.5',
    )
  })
})
