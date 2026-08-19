export interface Stage {
  label: string
}

export default function PipelineStrip({
  stages,
  activeIndex,
}: {
  stages: Stage[]
  /** index of the stage currently running; stages before it are marked done */
  activeIndex: number
}) {
  return (
    <div className="pipeline-strip">
      {stages.map((stage, i) => {
        const state = i < activeIndex ? 'is-done' : i === activeIndex ? 'is-active' : ''
        return (
          <div key={stage.label} className={`pipeline-stage ${state}`}>
            <span className="stage-index">{String(i + 1).padStart(2, '0')}</span>
            <span className="stage-label">{stage.label}</span>
          </div>
        )
      })}
    </div>
  )
}
