import React from 'react'
import { useTheme } from 'dash-ui-kit/react'
import { useColorScheme } from '@renderer/hooks/useColorScheme'
// import { useColorScheme } from 'dash-ui-kit/react'

type HeadingColor = 'black' | 'gray' | 'blue' | 'red' | 'green' | 'brand-white'

interface HeadingProps {
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | 'xl36' | 'xl40'
  weight?: 'normal' | 'medium' | 'semibold' | 'bold' | 'extrabold'
  color?: HeadingColor
  colorLight?: HeadingColor
  colorDark?: HeadingColor
  className?: string
  children: React.ReactNode
}

const sizeClasses = {
  xs: 'text-xs', // 12px
  sm: 'text-sm', // 14px
  md: 'text-base', // 16px
  lg: 'text-lg', // 18px
  xl: 'text-xl', // 20px
  xl36: 'text-[2.25rem]', // 36px
  '2xl': 'text-[2.375rem] leading-[1.3]', // 38px
  xl40: 'text-[2.5rem]', // 40px
  '3xl': 'text-[3rem] leading-[1.2]', // 48px
}

const weightClasses = {
  normal: 'font-normal', // 400
  medium: 'font-medium', // 500
  semibold: 'font-semibold', // 600
  bold: 'font-bold', // 700
  extrabold: 'font-extrabold' // 800
}

const colorClasses = {
  light: {
    black: 'text-black',
    gray: 'text-gray-600',
    blue: 'text-blue-600',
    red: 'text-red-600',
    green: 'text-green-600',
    "brand-white": 'text-dash-primary-dark-blue',
  },
  dark: {
    black: 'text-white',
    gray: 'text-gray-300',
    blue: 'text-blue-400',
    red: 'text-red-400',
    green: 'text-green-400',
    "brand-white": 'text-white',
  }
}

export const Heading: React.FC<HeadingProps> = ({
  as = 'h1',
  size = '2xl',
  weight = 'extrabold',
  color,
  colorLight,
  colorDark,
  className = '',
  children
}) => {
  const { theme } = useTheme()
  const effectiveColor = useColorScheme(color, colorLight, colorDark) ?? 'black'
  const Component = as

  const classes = [
    sizeClasses[size],
    weightClasses[weight],
    colorClasses[theme][effectiveColor],
    'tracking-[-0.4px]',
    className
  ].filter(Boolean).join(' ')

  return (
    <Component className={classes}>
      {children}
    </Component>
  )
}

export type { HeadingProps }
