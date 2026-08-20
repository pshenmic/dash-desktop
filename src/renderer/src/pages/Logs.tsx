import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { API } from '@renderer/api'
import { LogFileContent, LogFileInfo } from '@renderer/api/types'
import { LogLevel, ParsedLogLine } from '@renderer/types/Log'
import { Button, ChevronIcon, Heading, InfoCircleIcon, Input, Text } from '@renderer/components/dash-ui-kit-enxtended'
import Spinner from '@renderer/components/ui/Spinner'
import { toast } from '@renderer/components/ui/Toast'
import CopyButton from '@renderer/components/ui/CopyButton'
import SegmentedControl from '@renderer/components/ui/SegmentedControl'
import DropdownField from '@renderer/components/ui/DropdownField'
import { INITIAL_LOG_LINES, LOG_LEVEL_OPTIONS, LOG_LINES_INCREMENT, LOG_LINE_DISPLAY_OPTIONS } from '@renderer/constants/logsPage'
import { filterLogLines, formatFileSize, newestLogWindow, parseLogLines } from '@renderer/utils/logs'

export default function LogsPage(): React.JSX.Element {
  const navigate = useNavigate()
  const [files, setFiles] = useState<LogFileInfo[]>([])
  const [selectedName, setSelectedName] = useState<string | null>(null)
  const [selected, setSelected] = useState<LogFileContent | null>(null)
  const [query, setQuery] = useState('')
  const [level, setLevel] = useState<LogLevel>('all')
  const [lineDisplay, setLineDisplay] = useState<'scroll' | 'wrap'>('scroll')
  const [lineLimit, setLineLimit] = useState(INITIAL_LOG_LINES)
  const [loadingFiles, setLoadingFiles] = useState(true)
  const [loadingContent, setLoadingContent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadContent = useCallback(async (name: string): Promise<void> => {
    setLoadingContent(true)
    setError(null)
    try {
      setSelected(await API.getLogFile(name))
      setSelectedName(name)
      setLineLimit(INITIAL_LOG_LINES)
    } catch (cause) {
      setSelected(null)
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setLoadingContent(false)
    }
  }, [])

  const refresh = useCallback(async (): Promise<void> => {
    setLoadingFiles(true)
    setError(null)
    try {
      const nextFiles = await API.listLogFiles()
      setFiles(nextFiles)
      const nextName = nextFiles.some((file) => file.name === selectedName) ? selectedName : nextFiles[0]?.name ?? null
      if (nextName) await loadContent(nextName)
      else {
        setSelectedName(null)
        setSelected(null)
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setLoadingFiles(false)
    }
  }, [loadContent, selectedName])

  useEffect(() => { void refresh() }, [])

  const allLines = useMemo(() => parseLogLines(selected?.content ?? ''), [selected?.content])
  const filteredLines = useMemo(() => filterLogLines(allLines, query, level), [allLines, query, level])
  const visibleLines = useMemo(() => newestLogWindow(filteredLines, lineLimit), [filteredLines, lineLimit])

  const showInFolder = async (): Promise<void> => {
    if (!selectedName) return
    try {
      await API.showLogFileInFolder(selectedName)
    } catch (cause) {
      toast.error(`**Could not show log file** ${cause instanceof Error ? cause.message : String(cause)}`)
    }
  }

  const lineColor = (line: ParsedLogLine): string => {
    if (line.level === 'error') return 'text-red-500 dark:text-red-300'
    if (line.level === 'warn') return 'text-amber-600 dark:text-amber-300'
    if (line.level === 'debug') return 'opacity-60'
    return ''
  }

  return (
    <div className="w-full px-12">
      <div className="dash-card-base rounded-3xl p-6 shadow-[8px_0_64px_0_rgba(12,28,51,0.08)]">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => navigate('/settings')} className="dash-text-default flex size-8 items-center justify-center rounded-[.625rem] hover:bg-dash-primary-dark-blue/8 dark:hover:bg-white/10" aria-label="Back to settings" title="Back to settings">
              <ChevronIcon size={14} color="currentColor" className="rotate-90" />
            </button>
            <Heading as="h1" size="xl" weight="extrabold" color="brand-white">Application logs</Heading>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" colorScheme="primary-light" className="h-8! min-h-0! rounded-[.625rem]! px-3!" onClick={() => void refresh()} disabled={loadingFiles}>Refresh</Button>
            <Button size="sm" colorScheme="primary-light" className="h-8! min-h-0! rounded-[.625rem]! px-3!" onClick={() => void showInFolder()} disabled={!selected}>Show Log in Folder</Button>
          </div>
        </div>

        <div className="mb-4 flex items-center gap-2 text-amber-700 dark:text-amber-200">
          <InfoCircleIcon size={14} color="currentColor" className="shrink-0" />
          <span className="text-xs">Logs may contain wallet addresses and technical details. Review a file before sharing it.</span>
        </div>

        {error && (
          <div className="mb-5 flex items-center justify-between rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">
            <span>Could not load logs: {error}</span>
            <button type="button" className="font-semibold underline" onClick={() => void refresh()}>Retry</button>
          </div>
        )}

        <div className="grid h-[calc(100vh-18rem)] min-h-[24rem] max-h-[34rem] grid-cols-[210px_minmax(0,1fr)] overflow-hidden">
          <aside className="flex min-h-0 flex-col border-r border-dash-primary-dark-blue/10 p-2 dark:border-white/12">
            <Text size={12} weight="medium" color="brand" opacity={50} transform="uppercase" className="shrink-0">Log files</Text>
            <div className="scrollbar-custom mt-2 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pr-1">
              {loadingFiles && files.length === 0 && <div className="flex justify-center py-12"><Spinner /></div>}
              {!loadingFiles && files.length === 0 && <Text size={12} color="brand" opacity={50}>No log files are available yet.</Text>}
              {files.map((file) => (
                <button key={file.name} type="button" onClick={() => void loadContent(file.name)} className={`rounded-lg px-2.5 py-2 text-left transition-colors ${selectedName === file.name ? 'bg-dash-brand text-white' : 'dash-text-default hover:bg-dash-primary-dark-blue/8 dark:hover:bg-white/10'}`}>
                  <span className="block break-all text-sm font-semibold">{file.name.replace('wallet-', '')}</span>
                  <span className={`mt-1 block text-xs ${selectedName === file.name ? 'text-white/70' : 'opacity-50'}`}>{formatFileSize(file.size)} · {new Date(file.modifiedAt).toLocaleString()}</span>
                  {file.rotated && <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${selectedName === file.name ? 'bg-white/15' : 'bg-dash-primary-dark-blue/8 dark:bg-white/10'}`}>Rotated</span>}
                </button>
              ))}
            </div>
          </aside>

          <section className="flex min-h-0 min-w-0 flex-col">
            <div className="flex items-center gap-2 border-b border-dash-primary-dark-blue/10 p-2 dark:border-white/12">
              <div className="min-w-44 flex-1">
                <Input aria-label="Search logs" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search logs…" size="sm" variant="outlined" colorScheme="primary" className="h-8! rounded-[.625rem]!" />
              </div>
              <div className="w-32 shrink-0">
                <DropdownField ariaLabel="Log level" value={level} onChange={(value) => setLevel(value as LogLevel)} options={LOG_LEVEL_OPTIONS} textSize={12} triggerClassName="h-8 rounded-[.625rem] dash-block px-3 dash-black-border" />
              </div>
              <div className="flex items-center gap-2">
                <Text size={12} color="brand" opacity={50}>Long lines</Text>
                <SegmentedControl options={LOG_LINE_DISPLAY_OPTIONS} value={lineDisplay} onChange={setLineDisplay} className="p-0.5! [&_button]:px-2.5! [&_button]:py-1!" />
              </div>
              <div className="ml-auto flex items-center gap-1.5">
                <Text size={12} color="brand" opacity={50}>Visible lines</Text>
                <CopyButton text={visibleLines.map((line) => line.raw).join('\n')} disabled={visibleLines.length === 0} />
              </div>
            </div>

            <div className="dash-text-default flex items-center justify-between border-b border-dash-primary-dark-blue/10 px-3 py-1.5 text-xs dark:border-white/12">
              <span>{selected ? `${selected.name} · ${formatFileSize(selected.size)}` : 'Select a log file'}</span>
              <span className="opacity-60">{visibleLines.length} of {filteredLines.length} matching · {allLines.length} total</span>
            </div>

            <div className="relative min-h-0 flex-1 select-text overflow-auto bg-[#07111f] text-slate-200">
              {loadingContent && <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#07111f]/80"><Spinner /></div>}
              {!loadingContent && selected && allLines.length === 0 && <div className="p-8 text-center text-sm text-slate-400">This log file is empty.</div>}
              {!loadingContent && selected && allLines.length > 0 && filteredLines.length === 0 && <div className="p-8 text-center text-sm text-slate-400">No lines match the current filters.</div>}
              {visibleLines.length > 0 && (
                <div className={`${lineDisplay === 'wrap' ? 'w-full' : 'min-w-max'} py-2 font-mono text-xs leading-5`}>
                  {filteredLines.length > visibleLines.length && <div className="sticky left-0 mb-2 px-4"><button type="button" className="rounded-lg bg-white/10 px-3 py-1 hover:bg-white/15" onClick={() => setLineLimit((value) => value + LOG_LINES_INCREMENT)}>Load older lines</button></div>}
                  {visibleLines.map((line) => (
                    <div key={line.number} className={`grid grid-cols-[56px_minmax(0,1fr)] px-2 hover:bg-white/5 ${lineColor(line)}`}>
                      <span className="select-none pr-3 text-right text-slate-600">{line.number}</span>
                      <span className={lineDisplay === 'wrap' ? 'min-w-0 whitespace-pre-wrap break-words' : 'whitespace-pre'}>{line.raw || ' '}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
