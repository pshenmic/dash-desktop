import { Tabs } from 'dash-ui-kit/react'
import type { PageTabsProps } from '@renderer/types/PageTabs'

export default function PageTabs(props: PageTabsProps): React.JSX.Element {
  return (
    <Tabs
      {...props}
      size={"xl"}
      triggerClassName={
        'font-medium tracking-[-0.03em] ' +
        'data-[state=active]:text-dash-primary-dark-blue ' +
        'data-[state=inactive]:text-dash-primary-dark-blue/35 ' +
        'dark:data-[state=active]:text-white ' +
        'dark:data-[state=inactive]:text-white/35 ' +
        'dark:data-[state=active]:after:bg-dash-mint!'
      }
    />
  )
}
