import {
  CalendarDays,
  FastForward,
  Loader2,
  Pause,
  Play,
  Repeat,
  Sparkles,
  Wand2,
} from 'lucide-react'
import { useMemo } from 'react'

export type VisualModeTimelineItem = {
  key: string
  label: string
  count: number
}

type VisualModePanelProps = {
  isVisualMode: boolean
  onToggleVisualMode: () => void
  timelineItems: VisualModeTimelineItem[]
  selectedTimelineKey: string
  onSelectTimelineKey: (key: string) => void
  isPlaying: boolean
  isRepeating: boolean
  onTogglePlay: () => void
  onRestart: () => void
  onToggleRepeat: () => void
  onGenerateTripStory: () => void
  aiTripStory: string
  aiTripStoryError?: string
  isGeneratingTripStory: boolean
  visibleCount: number
  totalCount: number
}

type StorySection = {
  type: 'country' | 'closing'
  header?: string
  body: string
}

const parseAiTripStory = (story: string): StorySection[] => {
  if (!story.trim()) return []

  const sections: StorySection[] = []
  const blockRegex = /:::(country|closing)\s*([\s\S]*?):::/g
  let match: RegExpExecArray | null

  while ((match = blockRegex.exec(story)) !== null) {
    const type = match[1] as 'country' | 'closing'
    const content = match[2].trim()

    const headerMatch = content.match(/HEADER:\s*(.*)/)
    const bodyMatch = content.match(/BODY:\s*([\s\S]*)/)

    const header = headerMatch?.[1]?.trim()
    const body = bodyMatch?.[1]?.trim() || content

    if (body) {
      sections.push({
        type,
        header,
        body,
      })
    }
  }

  if (sections.length) return sections

  return [
    {
      type: 'closing',
      body: story.trim(),
    },
  ]
}

const VisualModePanel = ({
  isVisualMode,
  onToggleVisualMode,
  timelineItems,
  selectedTimelineKey,
  onSelectTimelineKey,
  isPlaying,
  isRepeating,
  onTogglePlay,
  onRestart,
  onToggleRepeat,
  onGenerateTripStory,
  aiTripStory,
  aiTripStoryError,
  isGeneratingTripStory,
  visibleCount,
  totalCount,
}: VisualModePanelProps) => {
  const selectedIndex = useMemo(
    () =>
      Math.max(
        0,
        timelineItems.findIndex(item => item.key === selectedTimelineKey),
      ),
    [selectedTimelineKey, timelineItems],
  )

  const selectedItem = timelineItems[selectedIndex]
  const storySections = useMemo(() => parseAiTripStory(aiTripStory), [aiTripStory])

  return (
    <div className="mb-3">
      <button
        className={`w-full rounded px-3 py-2 font-semibold transition ${
          isVisualMode ? 'bg-warning text-dark' : 'bg-dark text-white hover:bg-darkLight'
        }`}
        type="button"
        onClick={onToggleVisualMode}
      >
        {isVisualMode ? 'Visual mode on' : 'Visual mode'}
      </button>

      {isVisualMode && (
        <div className="mt-3 rounded bg-warning/20 p-2">
          <p className="m-0 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-dark">
            <Sparkles size={14} /> Timeline mode
          </p>

          <p className="m-0 mt-1 text-xs text-dark/70">
            Filter memories by month, animate yellow route lines, and generate an AI trip story.
          </p>

          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between gap-2 text-xs font-semibold text-dark/70">
              <span className="flex items-center gap-1">
                <CalendarDays size={13} /> Timeline
              </span>
              <span>
                {visibleCount}/{totalCount}
              </span>
            </div>

            <input
              className="w-full accent-dark"
              type="range"
              min={0}
              max={Math.max(timelineItems.length - 1, 0)}
              value={selectedIndex}
              disabled={!timelineItems.length}
              onChange={event => {
                const nextItem = timelineItems[Number(event.target.value)]
                if (nextItem) onSelectTimelineKey(nextItem.key)
              }}
            />

            <div className="mt-1 flex items-center justify-between gap-2 text-xs">
              <span className="truncate font-bold text-dark">
                {selectedItem ? selectedItem.label : 'Add dated memories'}
              </span>
              <span className="shrink-0 rounded bg-white/70 px-2 py-1 font-semibold text-dark/70">
                {selectedItem ? `${selectedItem.count}` : '0'}
              </span>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-[1fr_auto_auto] gap-2">
            <button
              className="rounded bg-darkLight px-3 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              disabled={!timelineItems.length}
              onClick={onTogglePlay}
            >
              <span className="inline-flex items-center justify-center gap-2">
                {isPlaying ? <Pause size={15} /> : <Play size={15} />}
                {isPlaying ? 'Pause' : 'Play'}
              </span>
            </button>

            <button
              className="rounded bg-darkLight px-3 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              disabled={!timelineItems.length}
              onClick={onRestart}
              aria-label="Restart timeline"
            >
              <FastForward size={16} />
            </button>

            <button
              className={`rounded px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                isRepeating ? 'bg-warning text-dark' : 'bg-darkLight text-white'
              }`}
              type="button"
              disabled={!timelineItems.length}
              onClick={onToggleRepeat}
              aria-label={isRepeating ? 'Turn repeat off' : 'Turn repeat on'}
              title={isRepeating ? 'Repeat on' : 'Repeat off'}
            >
              <Repeat size={16} />
            </button>
          </div>

          <button
            className="mt-3 w-full rounded bg-dark px-3 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            disabled={!visibleCount || isGeneratingTripStory}
            onClick={onGenerateTripStory}
          >
            <span className="inline-flex items-center justify-center gap-2">
              {isGeneratingTripStory ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Wand2 size={15} />
              )}
              {isGeneratingTripStory ? 'Writing trip story...' : 'Generate AI trip story'}
            </span>
          </button>

          {aiTripStoryError && (
            <p className="m-0 mt-2 rounded bg-white/70 p-2 text-xs font-semibold text-dark">
              {aiTripStoryError}
            </p>
          )}

          {!!storySections.length && (
            <div className="mt-3 max-h-96 space-y-3 overflow-y-auto rounded bg-white/70 p-2 shadow-inner">
              <p className="m-0 flex items-center gap-1 px-1 text-xs font-black uppercase tracking-[0.16em] text-dark">
                <Sparkles size={13} /> AI trip story
              </p>

              {storySections.map((section, index) => {
                if (section.type === 'closing') {
                  return (
                    <section
                      key={`${section.type}-${index}`}
                      className="overflow-hidden rounded border border-warning/70 bg-white shadow-sm"
                    >
                      <p className="m-0 px-3 py-3 text-xs leading-relaxed text-dark">
                        {section.body}
                      </p>
                    </section>
                  )
                }

                return (
                  <section
                    key={`${section.header || 'country'}-${index}`}
                    className="overflow-hidden rounded border border-warning/70 bg-white shadow-sm"
                  >
                    <div className="border-b border-warning/50 bg-warning px-3 py-2">
                      <h4 className="m-0 text-sm font-black uppercase tracking-[0.22em] text-dark">
                        {section.header || 'MEMORY STOP'}
                      </h4>
                    </div>

                    <p className="m-0 px-3 py-3 text-xs leading-relaxed text-dark">
                      {section.body}
                    </p>
                  </section>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default VisualModePanel
