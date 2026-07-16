import React from 'react'
import { cva, VariantProps } from 'class-variance-authority'

const textStyles = cva(
  '', {
    variants: {
      reset: {
        false: 'inline whitespace-normal',
        true: ''
      },
      color: {
        default: 'text-gray-900 dark:text-gray-100',
        'blue-mint': 'text-dash-brand dark:text-dash-mint',
        'blue-dark': 'text-dash-brand-dark dark:text-dash-brand-dim',
        red: 'text-red-700',
        brand: 'text-dash-primary-dark-blue dark:text-white',
        blue: 'text-dash-brand',
      },
      size: {
        10: 'text-[0.625rem]',
        12: 'text-[0.75rem]',
        14: 'text-sm',
        16: 'text-base',
        18: 'text-lg',
        20: 'text-xl',
        24: 'text-[1.5rem]',
        32: 'text-[2rem]',
        36: 'text-[2.25rem]',
        40: 'text-[2.5rem]',
        64: 'text-[4rem]',
      },
      weight: {
        light: 'font-light', // 300
        normal: 'font-normal', // 400
        medium: 'font-medium', // 500
        bold: 'font-bold', // 700
        extrabold: 'font-extrabold' // 800
      },
      italic: {
        false: '',
        true: 'italic'
      },
      underline: {
        false: '',
        true: 'underline'
      },
      lineThrough: {
        false: '',
        true: 'line-through'
      },
      transform: {
        none: '',
        uppercase: 'uppercase',
        capitalize: 'capitalize'
      },
      opacity: {
        0: 'opacity-0',
        10: 'opacity-10',
        20: 'opacity-20',
        30: 'opacity-30',
        40: 'opacity-40',
        50: 'opacity-50',
        60: 'opacity-60',
        70: 'opacity-70',
        80: 'opacity-80',
        90: 'opacity-90',
        100: 'opacity-100'
      },
      monospace: {
        false: '',
        true: 'font-grotesque'
      },
      dim: {
        false: '',
        true: '!opacity-60'
      }
    },
    defaultVariants: {
      reset: false,
      color: 'default',
      size: 16,
      weight: 'normal',
      italic: false,
      underline: false,
      lineThrough: false,
      transform: 'none',
      opacity: 100,
      monospace: false,
      dim: false
    }
  }
)

type TextVariants = VariantProps<typeof textStyles>

export interface TextProps extends TextVariants {
  /** Render as this element or component (e.g. 'h1' or Link). */
  as?: React.ElementType
  /** Additional CSS classes. */
  className?: string
  /** Text children. */
  children?: React.ReactNode
}

/**
 * A versatile text component with size, color, weight, decoration,
 * transform, opacity, monospace, dimming, and theme-aware defaults.
 */
export const Text: React.FC<TextProps> = ({ as, className = '', children, ...variantProps }) => {
  const classes = textStyles({
    ...variantProps,
  }) + (className !== '' ? ` ${className}` : '')

  const Component = as ?? 'span'
  return <Component className={classes}>{children}</Component>
}

export default Text
