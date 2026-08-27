import React from 'react'
import type { SensitiveValueProps } from '@renderer/types/SensitiveValue'

export default function SensitiveValue({
  children,
  hidden,
  size,
  tone = 'default',
  label = 'Balance hidden',
  className = ''
}: SensitiveValueProps): React.JSX.Element {
  if (!hidden) {
    return <>{children}</>
  }

  return (
    <span
      role={"img"}
      aria-label={label}
      data-sensitive-size={size}
      className={`sensitive-value sensitive-value--${size} sensitive-value--${tone}${className === '' ? '' : ` ${className}`}`}
    >
      <span aria-hidden={"true"} className={"sensitive-value__mosaic"}>
        {Array.from({ length: 48 }).map((_, index) => (
          <span key={index} />
        ))}
      </span>
    </span>
  )
}
