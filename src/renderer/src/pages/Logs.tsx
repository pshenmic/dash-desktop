import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { API } from '@renderer/api'
import { LogFileContent, LogFileInfo } from '@renderer/api/types'
import { Button, DocumentIcon, InfoTooltip } from '@renderer/components/dash-ui-kit-extended'
import NoResults from '@renderer/components/ui/NoResults'
import PageHeader from '@renderer/components/ui/PageHeader'
import PageTabs from '@renderer/components/ui/PageTabs'
import Spinner from '@renderer/components/ui/Spinner'
import { toast } from '@renderer/components/ui/Toast'
import { LOG_POLL_INTERVAL } from '@renderer/constants/logsPage'
import { LOG_LINE_LEVEL_CLASS, LOG_VIEWER_BORDER, LOG_VIEWER_EMPTY_TEXTS, LOG_VIEWER_SECONDARY_TEXT } from '@renderer/constants/logsViewer'
import { PAGE_HEADERS } from '@renderer/constants/pageHeaders'
import { SURFACE_PANEL, SURFACE_ROW } from '@renderer/constants/surfaces'
import { currentLogFile, formatFileSize, parseLogLines } from '@renderer/utils/logs'

export default function LogsPage(): React.JSX.Element {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('current')
  const [files, setFiles] = useState<LogFileInfo[]>([])
  const [current, setCurrent] = useState<LogFileContent | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const viewport = useRef<HTMLDivElement>(null)
  const following = useRef(true)
  const attachViewport = useCallback((element: HTMLDivElement | null) => {
    viewport.current = element
    if (element) {
      following.current = true
      element.scrollTop = element.scrollHeight
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>
    let previousName: string | undefined

    const refresh = async (): Promise<void> => {
      try {
        const nextFiles = await API.listLogFiles()
        const file = currentLogFile(nextFiles)
        const content = file ? await API.getLogFile(file.name) : null
        if (cancelled) return
        if (previousName !== content?.name) following.current = true
        previousName = content?.name
        setFiles(nextFiles)
        setCurrent(content)
        setError(null)
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause))
      } finally {
        if (!cancelled) {
          setLoading(false)
          timer = setTimeout(() => void refresh(), LOG_POLL_INTERVAL)
        }
      }
    }

    void refresh()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [])

  const lines = useMemo(() => parseLogLines(current?.content ?? ''), [current?.content])
  const previousFiles = files.filter((file) => file.name !== current?.name)

  useLayoutEffect(() => {
    if (activeTab === 'current' && following.current && viewport.current) {
      viewport.current.scrollTop = viewport.current.scrollHeight
    }
  }, [activeTab, current?.name, current?.content])

  const showInFolder = async (name: string): Promise<void> => {
    try {
      await API.showLogFileInFolder(name)
    } catch (cause) {
      toast.error(`**Could not show log file** ${cause instanceof Error ? cause.message : String(cause)}`)
    }
  }

  return (
    <div className="w-full px-12 pb-8">
      <PageHeader
        title={PAGE_HEADERS.logs.title}
        subtitle={PAGE_HEADERS.logs.subtitle}
        onBack={() => navigate('/settings')}
        backLabel={PAGE_HEADERS.logs.back}
        actions={<>
          <span role="status" className="dash-text-default flex items-center gap-2 text-xs">
            <span className={`size-1.5 rounded-full ${error ? 'bg-amber-400' : 'bg-emerald-400'}`} />
            <span className="opacity-50">{error ? 'Reconnecting' : 'Live'}</span>
            {error && <InfoTooltip content={error} side="bottom" ariaLabel="Show connection error" className="-my-0.5" />}
          </span>
          {activeTab === 'current' && <Button size="compact" colorScheme="primary-light" onClick={() => current && void showInFolder(current.name)} disabled={!current}>Show in folder</Button>}
        </>}
      />

      <div className={`relative flex ${SURFACE_PANEL}`}>
        <PageTabs value={activeTab} onValueChange={(value) => {
          following.current = true
          setActiveTab(value)
        }}
          items={[
            { value: 'current', label: 'Current log', content: (
          <section className={`flex h-[calc(100vh-20.875rem)] min-h-[24rem] min-w-0 flex-col overflow-hidden rounded-[.9375rem] border ${LOG_VIEWER_BORDER} dash-block-3`}>
            <div className={`flex items-center justify-between gap-3 border-b ${LOG_VIEWER_BORDER} px-4 py-3 text-xs ${LOG_VIEWER_SECONDARY_TEXT}`}>
              <span>{current ? `${current.name} · ${formatFileSize(current.size)}` : 'Current log'}</span>
              <span className="shrink-0">{lines.length} lines</span>
            </div>
            <div ref={attachViewport} onScroll={() => {
              const element = viewport.current
              if (element) {
                following.current = element.scrollHeight - element.scrollTop - element.clientHeight <= 24
              }
            }} className="scrollbar-custom min-h-0 flex-1 select-text overflow-y-auto dash-text-default">
              {loading && <div className="flex justify-center py-12"><Spinner /></div>}
              {!loading && !current && <NoResults noResults={LOG_VIEWER_EMPTY_TEXTS.noCurrentLog} />}
              {current && lines.length === 0 && <NoResults noResults={LOG_VIEWER_EMPTY_TEXTS.emptyLogFile} />}
              <div className="w-full py-3 font-mono text-xs leading-5">
                {lines.map((line) => (
                  <div key={line.number} className={`grid grid-cols-[56px_minmax(0,1fr)] px-2 hover:bg-dash-primary-dark-blue/5 dark:hover:bg-white/5 ${LOG_LINE_LEVEL_CLASS[line.level]}`}>
                    <span className={`select-none pr-3 text-right ${LOG_VIEWER_SECONDARY_TEXT}`}>{line.number}</span>
                    <span className="min-w-0 whitespace-pre-wrap [overflow-wrap:anywhere]">{line.raw || ' '}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
            ) },
            { value: 'previous', label: 'Previous logs', content: (
              <div className="min-h-[24rem]">
                {loading && <div className="flex justify-center py-12"><Spinner /></div>}
                {!loading && previousFiles.length === 0 && <NoResults noResults={LOG_VIEWER_EMPTY_TEXTS.noPreviousLogs} />}
                <div className="flex flex-col gap-2">
                  {previousFiles.map((file) => (
                      <button key={file.name} type="button" onClick={() => void showInFolder(file.name)} aria-label={`Show ${file.name} in folder`} className={`${SURFACE_ROW} dash-text-default flex w-full cursor-pointer items-center gap-4 text-left outline-none hover:bg-dash-primary-dark-blue/8 dark:hover:bg-white/8 focus-visible:ring-2 focus-visible:ring-dash-brand dark:focus-visible:ring-dash-mint`}>
                        <DocumentIcon size={20} color="currentColor" className="shrink-0 opacity-50" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{file.name}</span>
                          <span className="mt-1 block text-xs opacity-50">{new Date(file.modifiedAt).toLocaleString()}</span>
                        </span>
                        <span className="shrink-0 text-xs tabular-nums opacity-50">{formatFileSize(file.size)}</span>
                      </button>
                  ))}
                </div>
              </div>
            ) }
          ]}
        />
      </div>
    </div>
  )
}
