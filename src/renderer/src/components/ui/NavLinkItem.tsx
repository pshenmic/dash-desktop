import { NavLink, useLocation } from "react-router-dom";
import { cva } from "class-variance-authority";
import { NavGroupProps } from "./NavGroup";
import { ChevronIcon, Text } from "../dash-ui-kit-enxtended";
import { useRipple } from "@renderer/hooks/useRipple";
import { useEffect, useRef } from "react";

const navLinkStyles = cva(
  `
    relative
    overflow-hidden
    flex
    items-center
    gap-3.75
    px-3.75
    py-2.5
    border-b-1
    border-white dark:border-white/12
    cursor-pointer
    dash-block
    group
  `,
)

const iconStyles = cva(
  `
    w-8.75
    h-8.75
    flex
    items-center
    justify-center
    rounded-full
    transition-[bg,shadow]
    duration-300
    ease
  `,
  {
    variants: {
      isActive: {
        true: 'bg-white/12 text-white',
        false: `
          dash-subtle
          dash-text-default
          group-hover:bg-dash-brand/20
          group-hover:shadow-md
        `
      }
    }
  }
)

const textStyles = cva(
  `
    transition-[translate]
    duration-300
    ease
  `,
  {
    variants: {
      isActive: {
        true: 'text-white !font-extrabold',
        false: 'group-hover:translate-x-1'
      }
    }
  }
)

export default function NavLinkItem({item}: {item: NavGroupProps}): React.JSX.Element {
  const Icon = item?.icon
  const location = useLocation()
  const isActive = location.pathname === item?.items.to
  const navRef = useRef<HTMLAnchorElement>(null)

  const activeRipple = useRipple({
    variant: 'primary',
    opacity: 1,
    zIndex: -1,
  })

  const hoverRipple = useRipple({
    variant: 'primary',
    opacity: 0.15,
    zIndex: 0,
  })

  useEffect(() => {
    if (isActive && navRef.current) {
      activeRipple.show(navRef.current)
    } else {
      activeRipple.hide()
    }
  }, [isActive, activeRipple.show, activeRipple.hide])

  return (
    <NavLink
      ref={navRef}
      key={item?.items.id}
      to={item?.items.to}
      className={navLinkStyles()}
      onClick={(e) => {
        if (!isActive) {
          activeRipple.onMouseEnter(e)
        }
      }}
      onMouseEnter={!isActive ? hoverRipple.onMouseEnter : undefined}
      onMouseMove={hoverRipple.onMouseMove}
      onMouseLeave={hoverRipple.onMouseLeave}
    >
      {({ isActive }) => (
        <>
          {Icon && (
            <div className={iconStyles({ isActive })}>
              <Icon color={"inherit"} className={`transition-transform duration-200 ${!isActive ? "group-hover:scale-105" : ''}`} />
            </div>
          )}
          <Text size={14} color={"brand"} className={textStyles({ isActive })}>
            {item?.items.label}
          </Text>
          {item?.arrow && (
            <ChevronIcon
              color={"inherit"}
              size={16}
              className={`transition-transform duration-200 -rotate-90 ml-auto`}
            />
          )}
        </>
      )}
    </NavLink>
  )
}
