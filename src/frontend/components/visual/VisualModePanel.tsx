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
    <div className="mb-4 text-base">
      <button
        className={`w-full rounded px-4 py-3 text-base font-semibold transition ${
          isVisualMode ? 'bg-warning text-dark' : 'bg-dark text-white hover:bg-darkLight'
        }`}
        type="button"
        onClick={onToggleVisualMode}
      >
        {isVisualMode ? 'Visual mode on' : 'Visual mode'}
      </button>

      {isVisualMode && (
        <div className="mt-4 rounded bg-warning/20 p-4">
          <p className="m-0 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.16em] text-dark">
            <Sparkles size={16} /> Timeline mode
          </p>

          <p className="m-0 mt-2 text-sm leading-relaxed text-dark/80">
            Filter memories by month, animate yellow route lines, and generate an AI trip story.
          </p>

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between gap-2 text-sm font-semibold text-dark/70">
              <span className="flex items-center gap-2">
                <CalendarDays size={15} /> Timeline
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

            <div className="mt-2 flex items-center justify-between gap-2 text-sm">
              <span className="truncate font-bold text-dark">
                {selectedItem ? selectedItem.label : 'Add dated memories'}
              </span>
              <span className="shrink-0 rounded bg-white/70 px-3 py-1 font-semibold text-dark/70">
                {selectedItem ? `${selectedItem.count}` : '0'}
              </span>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-[1fr_auto_auto] gap-3">
            <button
              className="rounded bg-darkLight px-4 py-3 text-base text-white disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              disabled={!timelineItems.length}
              onClick={onTogglePlay}
            >
              <span className="inline-flex items-center justify-center gap-2">
                {isPlaying ? <Pause size={17} /> : <Play size={17} />}
                {isPlaying ? 'Pause' : 'Play'}
              </span>
            </button>

            <button
              className="rounded bg-darkLight px-4 py-3 text-white disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              disabled={!timelineItems.length}
              onClick={onRestart}
              aria-label="Restart timeline"
            >
              <FastForward size={18} />
            </button>

            <button
              className={`rounded px-4 py-3 disabled:cursor-not-allowed disabled:opacity-50 ${
                isRepeating ? 'bg-warning text-dark' : 'bg-darkLight text-white'
              }`}
              type="button"
              disabled={!timelineItems.length}
              onClick={onToggleRepeat}
              aria-label={isRepeating ? 'Turn repeat off' : 'Turn repeat on'}
              title={isRepeating ? 'Repeat on' : 'Repeat off'}
            >
              <Repeat size={18} />
            </button>
          </div>

          <button
            className="mt-4 w-full rounded bg-dark px-4 py-3 text-base font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            disabled={!visibleCount || isGeneratingTripStory}
            onClick={onGenerateTripStory}
          >
            <span className="inline-flex items-center justify-center gap-2">
              {isGeneratingTripStory ? (
                <Loader2 size={17} className="animate-spin" />
              ) : (
                <Wand2 size={17} />
              )}
              {isGeneratingTripStory ? 'Writing trip story...' : 'Generate AI trip story'}
            </span>
          </button>

          {aiTripStoryError && (
            <p className="m-0 mt-3 rounded bg-white/70 p-3 text-sm font-semibold leading-relaxed text-dark">
              {aiTripStoryError}
            </p>
          )}

          {!!storySections.length && (
            <div className="mt-4 max-h-[55vh] space-y-4 overflow-y-auto rounded bg-white/70 p-3 shadow-inner">
              <p className="m-0 flex items-center gap-2 px-1 text-sm font-black uppercase tracking-[0.18em] text-dark">
                <Sparkles size={15} /> AI trip story
              </p>

              {storySections.map((section, index) => {
                if (section.type === 'closing') {
                  return (
                    <section
                      key={`${section.type}-${index}`}
                      className="overflow-hidden rounded border border-warning/70 bg-white shadow-sm"
                    >
                      <p className="m-0 px-4 py-4 text-base leading-relaxed text-dark">
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
                    <div className="border-b border-warning/50 bg-warning px-4 py-3">
                      <h4 className="m-0 text-base font-black uppercase tracking-[0.25em] text-dark">
                        {section.header || 'MEMORY STOP'}
                      </h4>
                    </div>

                    <p className="m-0 px-4 py-4 text-base leading-relaxed text-dark">
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
