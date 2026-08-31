import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import SensitiveValue from '@renderer/components/ui/SensitiveValue'

describe('SensitiveValue', () => {
  it('omits hidden content from rendered output', () => {
    const secret = '3,141.59265359 Dash'
    const markup = renderToStaticMarkup(
      <SensitiveValue hidden size={"hero"}>
        <span>{secret}</span>
      </SensitiveValue>
    )

    expect(markup).not.toContain(secret)
    expect(markup).toContain('aria-label="Balance hidden"')
    expect(markup).toContain('aria-hidden="true"')
  })

  it('renders visible content unchanged', () => {
    const secret = '0.0042 Dash'
    const markup = renderToStaticMarkup(
      <SensitiveValue hidden={false} size={"card"}>
        <span>{secret}</span>
      </SensitiveValue>
    )

    expect(markup).toContain(secret)
    expect(markup).not.toContain('sensitive-value')
  })

  it('uses identical hidden markup regardless of secret length', () => {
    const renderHidden = (secret: string): string =>
      renderToStaticMarkup(
        <SensitiveValue hidden size={"sidebar"}>
          <span>{secret}</span>
        </SensitiveValue>
      )

    expect(renderHidden('0.01 Dash')).toBe(renderHidden('3,000,000,000.12345678 Dash'))
  })
})
