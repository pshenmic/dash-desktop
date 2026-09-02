import {useNavigate} from 'react-router-dom'
import {ArrowIcon} from '@renderer/components/dash-ui-kit-enxtended/icons'
import {Text} from '@renderer/components/dash-ui-kit-enxtended'
import CoreTab from './CoreTab'

export default function ConnectionSettings(): React.JSX.Element {
  const navigate = useNavigate()

  return (
    <div className="w-full px-12 pb-12">
      <div className="mb-12 flex items-center gap-[1.125rem]">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className={`
            flex size-12 items-center justify-center rounded-[.9375rem]
            dash-block cursor-pointer dash-text-default dash-black-border
            hover:bg-dash-primary-dark-blue/8 dark:hover:bg-white/8
          `}
          title="Go back"
        >
          <ArrowIcon size={12} className="dash-text-default" />
        </button>
        <Text as="h1" size={40} weight="normal" color="brand" className="leading-none tracking-[-0.04em]">
          P2P <span className="opacity-50">Connection Settings</span>
        </Text>
      </div>

      <CoreTab />
    </div>
  )
}
