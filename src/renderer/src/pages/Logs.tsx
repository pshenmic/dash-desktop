import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Tabs } from 'dash-ui-kit/react'
import { API } from '@renderer/api'
import { LogFileContent, LogFileInfo } from '@renderer/api/types'
import { Button, ChevronIcon, DocumentIcon, Heading, InfoCircleIcon } from '@renderer/components/dash-ui-kit-enxtended'
import Spinner from '@renderer/components/ui/Spinner'
import { toast } from '@renderer/components/ui/Toast'
import { LOG_POLL_INTERVAL } from '@renderer/constants/logsPage'
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
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate('/settings')} className="dash-text-default flex size-8 items-center justify-center rounded-[.625rem] hover:bg-dash-primary-dark-blue/8 dark:hover:bg-white/10" aria-label="Back to settings" title="Back to settings">
            <ChevronIcon size={14} color="currentColor" className="rotate-90" />
          </button>
          <Heading as="h1" size="xl" weight="extrabold" color="brand-white">Application logs</Heading>
        </div>
        {activeTab === 'current' && <Button size="sm" colorScheme="primary-light" className="h-8! min-h-0! rounded-[.625rem]! px-3!" onClick={() => current && void showInFolder(current.name)} disabled={!current}>Show in folder</Button>}
      </div>

      <div className="dash-text-default mb-6 flex items-center gap-2 opacity-50">
        <InfoCircleIcon size={14} color="currentColor" className="shrink-0" />
        <span className="text-xs">Logs may contain wallet addresses and technical details. Review a file before sharing it.</span>
      </div>

      {error && <div role="alert" className="mb-4 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">Could not load logs: {error}. Retrying automatically…</div>}

      <Tabs value={activeTab} onValueChange={(value) => {
        following.current = true
        setActiveTab(value)
      }} size="xl"
        triggerClassName="font-medium data-[state=active]:text-dash-primary-dark-blue data-[state=inactive]:text-dash-primary-dark-blue/40 dark:data-[state=active]:text-white dark:data-[state=inactive]:text-white/40"
        items={[
          { value: 'current', label: 'Current log', content: (
        <section className="mt-4 flex h-[calc(100vh-21rem)] min-h-[24rem] min-w-0 flex-col overflow-hidden rounded-xl border border-white/10 bg-[#0b1626]">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 text-xs text-slate-400">
            <span>{current ? `${current.name} · ${formatFileSize(current.size)}` : 'Current log'}</span>
            <span className="flex shrink-0 items-center gap-2"><span className={`size-1.5 rounded-full ${error ? 'bg-amber-400' : 'bg-emerald-400'}`} />{error ? 'Reconnecting' : 'Live'} · {lines.length} lines</span>
          </div>
          <div ref={attachViewport} onScroll={() => {
            const element = viewport.current
            if (element) {
              following.current = element.scrollHeight - element.scrollTop - element.clientHeight <= 24
            }
          }} className="scrollbar-custom min-h-0 flex-1 select-text overflow-y-auto text-slate-200">
            {loading && <div className="flex justify-center py-12"><Spinner /></div>}
            {!loading && !current && <div className="p-8 text-center text-sm text-slate-400">No current log is available yet.</div>}
            {current && lines.length === 0 && <div className="p-8 text-center text-sm text-slate-400">This log file is empty.</div>}
            <div className="w-full py-3 font-mono text-xs leading-5">
              {lines.map((line) => (
                <div key={line.number} className={`grid grid-cols-[56px_minmax(0,1fr)] px-2 hover:bg-white/5 ${line.level === 'error' ? 'text-red-300' : line.level === 'warn' ? 'text-amber-300' : line.level === 'debug' ? 'opacity-60' : ''}`}>
                  <span className="select-none pr-3 text-right text-slate-600">{line.number}</span>
                  <span className="min-w-0 whitespace-pre-wrap [overflow-wrap:anywhere]">{line.raw || ' '}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
          ) },
          { value: 'previous', label: 'Previous logs', content: (
            <div className="mt-4 min-h-[24rem]">
              {loading && <div className="flex justify-center py-12"><Spinner /></div>}
              {!loading && previousFiles.length === 0 && <p className="dash-text-default py-12 text-center text-sm opacity-50">No previous logs.</p>}
              <div className="divide-y divide-dash-primary-dark-blue/10 dark:divide-white/10">
                {previousFiles.map((file) => (
                    <button key={file.name} type="button" onClick={() => void showInFolder(file.name)} aria-label={`Show ${file.name} in folder`} className="dash-text-default flex w-full cursor-pointer items-center gap-4 rounded-lg px-4 py-4 text-left hover:bg-dash-primary-dark-blue/5 dark:hover:bg-white/5">
                      <DocumentIcon size={20} color="currentColor" className="shrink-0 opacity-40" />
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
  )
}
