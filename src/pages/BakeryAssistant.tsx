import { useEffect, useMemo, useState } from 'react'
import PipelineStrip from '../components/PipelineStrip'
import {
  CONFIG,
  ITEM_NAMES,
  DAY_NAMES,
  trainForecaster,
  predictAllItems,
  ExpertRuleEngine,
  optimizeProduction,
  planBakingSchedule,
  scorePlan,
  timeStr,
  durationStr,
  type ForecastModel,
  type Plan,
  type FiredRule,
  type OptimizeResult,
} from '../lib/bakery'

const STAGES = [{ label: 'ml demand forecast' }, { label: 'expert rules' }, { label: 'search optimize' }, { label: 'bake schedule' }]

const today = new Date()

export default function BakeryAssistant() {
  const [model, setModel] = useState<ForecastModel | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Step 1 inputs
  const [dow, setDow] = useState(today.getDay() === 0 ? 6 : today.getDay() - 1) // JS Sunday=0 -> our Monday=0 scheme
  const [weather, setWeather] = useState<'sunny' | 'rainy'>('sunny')
  const [flourKg, setFlourKg] = useState(20)
  const [butterKg, setButterKg] = useState(8)
  const [lastWeek, setLastWeek] = useState<Record<string, string>>({})

  // Pipeline results
  const [stage, setStage] = useState(-1)
  const [rawDemand, setRawDemand] = useState<Plan | null>(null)
  const [adjustedPlan, setAdjustedPlan] = useState<Plan | null>(null)
  const [firedRules, setFiredRules] = useState<FiredRule[]>([])
  const [optResult, setOptResult] = useState<OptimizeResult | null>(null)
  const [schedule, setSchedule] = useState<ReturnType<typeof planBakingSchedule> | null>(null)
  const [whyItem, setWhyItem] = useState<string | null>(null)
  const [overrides, setOverrides] = useState<Record<string, string>>({})

  useEffect(() => {
    trainForecaster().then(setModel).catch((e) => setLoadError(e.message))
  }, [])

  const lastWeekParsed = useMemo(() => {
    const out: Record<string, number> = {}
    for (const item of ITEM_NAMES) {
      const v = parseInt(lastWeek[item] ?? '', 10)
      if (!isNaN(v)) out[item] = v
    }
    return out
  }, [lastWeek])

  function runPipeline() {
    if (!model) return
    setStage(0)
    const raw = predictAllItems(model, dow, weather)
    setRawDemand(raw)

    window.setTimeout(() => {
      setStage(1)
      const engine = new ExpertRuleEngine()
      const adjusted = { ...raw }
      engine.apply(adjusted, {
        dow,
        weather,
        month: today.getMonth() + 1,
        day: today.getDate(),
        flour_kg: flourKg,
        butter_kg: butterKg,
        last_week_sold: lastWeekParsed,
      })
      setAdjustedPlan(adjusted)
      setFiredRules(engine.firedRules)

      window.setTimeout(() => {
        setStage(2)
        const result = optimizeProduction(adjusted, raw, { flour_kg: flourKg, butter_kg: butterKg })
        setOptResult(result)

        window.setTimeout(() => {
          setStage(3)
          const sched = planBakingSchedule(result.plan)
          setSchedule(sched)
          window.setTimeout(() => setStage(-1), 400)
        }, 400)
      }, 400)
    }, 400)
  }

  function applyOverride(item: string) {
    if (!optResult || !rawDemand) return
    const qty = parseInt(overrides[item] ?? '', 10)
    if (isNaN(qty) || qty < 0) return
    const newPlan = { ...optResult.plan, [item]: qty }
    const newScore = scorePlan(newPlan, rawDemand)
    setOptResult({ ...optResult, plan: newPlan, score: newScore })
    setSchedule(planBakingSchedule(newPlan))
  }

  const finalPlan = optResult?.plan ?? null
  const finalScore = optResult?.score ?? null

  return (
    <div className="max-w-6xl mx-auto px-5 md:px-8 py-14 md:py-20">
      <div className="flex items-center gap-2 mb-3" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-faint)', fontSize: 13 }}>
        <span className="status-dot on" />
        <span>ml-forecast + expert-system + search + planner</span>
      </div>
      <h1 className="text-[36px] md:text-[44px] mb-3">BakeryAssistant</h1>
      <p className="max-w-2xl mb-8" style={{ color: 'var(--text-dim)' }}>
        {CONFIG.bakery_name} — reduce waste, maximize sales, bake smarter. A demand forecaster
        trains live in your browser on {model?.rowsTrainedOn ?? '1,830'} rows of real sales
        history, then hands off to an expert rule engine, a hill-climbing search optimizer, and a
        STRIPS-style baking scheduler — the full pipeline, ported to TypeScript.
      </p>

      <div className="mb-8">
        <PipelineStrip stages={STAGES} activeIndex={stage} />
      </div>

      {loadError && (
        <div className="p-4 rounded-lg border mb-6 text-[13.5px]" style={{ borderColor: 'var(--rose)', background: 'var(--rose-dim)' }}>
          Couldn't load sales history ({loadError}).
        </div>
      )}

      {/* Step 1: context inputs */}
      <div className="p-6 rounded-lg border mb-8" style={{ borderColor: 'var(--line)', background: 'var(--bg-raised)' }}>
        <h2 className="text-[13px] tracking-[0.1em] uppercase mb-4" style={{ color: 'var(--text-dim)' }}>
          Step 1 — today's context
        </h2>
        <div className="grid md:grid-cols-2 gap-5 mb-5">
          <div>
            <label className="block text-[12.5px] mb-2" style={{ color: 'var(--text-faint)' }}>Day of week</label>
            <select
              value={dow}
              onChange={(e) => setDow(Number(e.target.value))}
              className="w-full px-3 py-2.5 rounded-md text-[14px]"
              style={{ background: 'var(--bg-inset)', border: '1px solid var(--line)', color: 'var(--text)' }}
            >
              {DAY_NAMES.map((d, i) => (
                <option key={d} value={i}>{d}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[12.5px] mb-2" style={{ color: 'var(--text-faint)' }}>Weather forecast</label>
            <div className="flex gap-2">
              {(['sunny', 'rainy'] as const).map((w) => (
                <button
                  key={w}
                  onClick={() => setWeather(w)}
                  className="flex-1 px-3 py-2.5 rounded-md text-[14px] border capitalize"
                  style={{
                    borderColor: weather === w ? 'var(--amber)' : 'var(--line)',
                    background: weather === w ? 'var(--amber-dim)' : 'var(--bg-inset)',
                    color: weather === w ? 'var(--amber)' : 'var(--text-dim)',
                  }}
                >
                  {w}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-[12.5px] mb-2" style={{ color: 'var(--text-faint)' }}>
              Flour available: <span style={{ color: 'var(--text)' }}>{flourKg} kg</span>
            </label>
            <input type="range" min={0} max={40} step={0.5} value={flourKg} onChange={(e) => setFlourKg(Number(e.target.value))} className="w-full accent-amber-500" />
          </div>
          <div>
            <label className="block text-[12.5px] mb-2" style={{ color: 'var(--text-faint)' }}>
              Butter available: <span style={{ color: 'var(--text)' }}>{butterKg} kg</span>
            </label>
            <input type="range" min={0} max={16} step={0.5} value={butterKg} onChange={(e) => setButterKg(Number(e.target.value))} className="w-full accent-amber-500" />
          </div>
        </div>

        <details className="mb-5">
          <summary className="text-[12.5px] cursor-pointer" style={{ color: 'var(--text-faint)' }}>
            Optional — last week's sales for the same day (enables the safety-ceiling rule)
          </summary>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-3">
            {ITEM_NAMES.map((item) => (
              <div key={item}>
                <label className="block text-[11px] mb-1 capitalize" style={{ color: 'var(--text-faint)' }}>{item}</label>
                <input
                  type="number"
                  min={0}
                  placeholder="—"
                  value={lastWeek[item] ?? ''}
                  onChange={(e) => setLastWeek((lw) => ({ ...lw, [item]: e.target.value }))}
                  className="w-full px-2 py-1.5 rounded text-[13px]"
                  style={{ background: 'var(--bg-inset)', border: '1px solid var(--line)', color: 'var(--text)' }}
                />
              </div>
            ))}
          </div>
        </details>

        <button
          onClick={runPipeline}
          disabled={!model}
          className="px-5 py-3 rounded-lg font-semibold text-[14px] disabled:opacity-50"
          style={{ background: 'var(--amber)', color: '#1a1206', fontFamily: 'var(--font-mono)' }}
        >
          {model ? 'run pipeline →' : 'training forecaster…'}
        </button>
      </div>

      {/* Step 2: forecast */}
      {rawDemand && (
        <PlanTable
          title="Step 2 — ML demand forecast"
          subtitle="Random-forest-equivalent prediction, trained on historical day-of-week / item / weather buckets."
          rows={ITEM_NAMES.map((item) => ({ item, value: rawDemand[item] }))}
          valueLabel="predicted demand"
        />
      )}

      {/* Step 3: expert rules */}
      {adjustedPlan && rawDemand && (
        <div className="p-6 rounded-lg border mb-8" style={{ borderColor: 'var(--line)', background: 'var(--bg-raised)' }}>
          <h2 className="text-[13px] tracking-[0.1em] uppercase mb-1" style={{ color: 'var(--text-dim)' }}>
            Step 3 — expert rule adjustments
          </h2>
          <p className="text-[12.5px] mb-4" style={{ color: 'var(--text-faint)' }}>
            Forward-chaining rule engine — domain knowledge layered on top of the statistical forecast.
          </p>

          {firedRules.length === 0 ? (
            <p className="text-[13.5px] mb-4" style={{ color: 'var(--text-faint)' }}>No rules fired. Plan is based solely on the statistical forecast.</p>
          ) : (
            <div className="space-y-2 mb-5">
              {firedRules.map((r) => (
                <div key={r.rule} className="p-3 rounded-md text-[13px]" style={{ background: 'var(--bg-inset)', border: '1px solid var(--line)' }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span style={{ color: 'var(--teal)' }}>✔</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>{r.rule}</span>
                  </div>
                  <p style={{ color: 'var(--text-dim)' }} className="mb-1">{r.reason}</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(r.changes).map(([item, delta]) => (
                      <span key={item} className="text-[11.5px] px-2 py-0.5 rounded" style={{ fontFamily: 'var(--font-mono)', background: 'var(--bg-raised)', color: delta >= 0 ? 'var(--teal)' : 'var(--rose)' }}>
                        {item} {delta >= 0 ? '+' : ''}{delta}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <table className="w-full text-[13px]">
            <thead>
              <tr style={{ color: 'var(--text-faint)' }}>
                <th className="text-left font-normal pb-2">Item</th>
                <th className="text-right font-normal pb-2">Raw</th>
                <th className="text-right font-normal pb-2">Adjusted</th>
                <th className="text-right font-normal pb-2">Δ</th>
              </tr>
            </thead>
            <tbody>
              {ITEM_NAMES.map((item) => {
                const raw = rawDemand[item]
                const adj = adjustedPlan[item]
                const diff = adj - raw
                return (
                  <tr key={item} style={{ borderTop: '1px solid var(--line)' }}>
                    <td className="py-1.5 capitalize">{item}</td>
                    <td className="py-1.5 text-right" style={{ fontFamily: 'var(--font-mono)' }}>{raw}</td>
                    <td className="py-1.5 text-right" style={{ fontFamily: 'var(--font-mono)' }}>{adj}</td>
                    <td className="py-1.5 text-right" style={{ fontFamily: 'var(--font-mono)', color: diff >= 0 ? 'var(--teal)' : 'var(--rose)' }}>{diff >= 0 ? '+' : ''}{diff}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Step 4: search optimization */}
      {optResult && adjustedPlan && (
        <div className="p-6 rounded-lg border mb-8" style={{ borderColor: 'var(--line)', background: 'var(--bg-raised)' }}>
          <h2 className="text-[13px] tracking-[0.1em] uppercase mb-1" style={{ color: 'var(--text-dim)' }}>
            Step 4 — search optimization
          </h2>
          <p className="text-[12.5px] mb-4" style={{ color: 'var(--text-faint)' }}>
            Greedy best-first hill climbing — nudges each item ±5 units, keeps whatever improves profit, stops at a local optimum.
          </p>
          <table className="w-full text-[13px] mb-4">
            <thead>
              <tr style={{ color: 'var(--text-faint)' }}>
                <th className="text-left font-normal pb-2">Item</th>
                <th className="text-right font-normal pb-2">Adjusted</th>
                <th className="text-right font-normal pb-2">Optimized</th>
                <th className="text-right font-normal pb-2">Δ</th>
              </tr>
            </thead>
            <tbody>
              {ITEM_NAMES.map((item) => {
                const adj = adjustedPlan[item]
                const opt = optResult.plan[item]
                const diff = opt - adj
                return (
                  <tr key={item} style={{ borderTop: '1px solid var(--line)' }}>
                    <td className="py-1.5 capitalize">{item}</td>
                    <td className="py-1.5 text-right" style={{ fontFamily: 'var(--font-mono)' }}>{adj}</td>
                    <td className="py-1.5 text-right" style={{ fontFamily: 'var(--font-mono)' }}>{opt}</td>
                    <td className="py-1.5 text-right" style={{ fontFamily: 'var(--font-mono)', color: diff >= 0 ? 'var(--teal)' : 'var(--rose)' }}>{diff >= 0 ? '+' : ''}{diff}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="flex flex-wrap gap-4 text-[13px]" style={{ fontFamily: 'var(--font-mono)' }}>
            <span>search completed in <span style={{ color: 'var(--amber)' }}>{optResult.searchLog.length - 1}</span> moves</span>
            <span>projected profit <span style={{ color: 'var(--teal)' }}>${optResult.score.profit.toFixed(2)}</span></span>
            <span>projected waste <span style={{ color: 'var(--rose)' }}>{optResult.score.total_waste} units</span></span>
          </div>
        </div>
      )}

      {/* Step 5: schedule + final report */}
      {schedule && finalPlan && finalScore && (
        <div className="p-6 rounded-lg border mb-8" style={{ borderColor: 'var(--line)', background: 'var(--bg-raised)' }}>
          <h2 className="text-[13px] tracking-[0.1em] uppercase mb-1" style={{ color: 'var(--text-dim)' }}>
            Step 5 — baking schedule
          </h2>
          <p className="text-[12.5px] mb-4" style={{ color: 'var(--text-faint)' }}>
            STRIPS-style scheduler — 3:00 AM oven start, {CONFIG.oven.tray_capacity}-unit tray capacity, {timeStr(7)} store opening.
          </p>

          <table className="w-full text-[13px] mb-2">
            <thead>
              <tr style={{ color: 'var(--text-faint)' }}>
                <th className="text-left font-normal pb-2">Start</th>
                <th className="text-left font-normal pb-2">End</th>
                <th className="text-left font-normal pb-2">Item</th>
                <th className="text-right font-normal pb-2">Qty</th>
                <th className="text-right font-normal pb-2">Bake time</th>
              </tr>
            </thead>
            <tbody>
              {schedule.scheduled.map((t) => (
                <tr key={t.item} style={{ borderTop: '1px solid var(--line)' }}>
                  <td className="py-1.5" style={{ fontFamily: 'var(--font-mono)' }}>{timeStr(t.startTime)}</td>
                  <td className="py-1.5" style={{ fontFamily: 'var(--font-mono)' }}>{timeStr(t.endTime)}</td>
                  <td className="py-1.5 capitalize">{t.item}</td>
                  <td className="py-1.5 text-right" style={{ fontFamily: 'var(--font-mono)' }}>{t.quantity}</td>
                  <td className="py-1.5 text-right" style={{ fontFamily: 'var(--font-mono)' }}>{durationStr(t.bakeMinutes)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {schedule.unscheduled.length > 0 && (
            <div className="mb-4 text-[13px]" style={{ color: 'var(--rose)' }}>
              ⚠ Could not schedule {schedule.unscheduled.length} item(s):
              <ul className="ml-4 list-disc">
                {schedule.unscheduled.map((u) => (
                  <li key={u.item}>{u.item}: {u.reason}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-4 mt-5">
            <div className="p-4 rounded-md" style={{ background: 'var(--bg-inset)' }}>
              <h3 className="text-[11px] tracking-[0.1em] uppercase mb-3" style={{ color: 'var(--text-faint)' }}>Production &amp; revenue</h3>
              <table className="w-full text-[13px]">
                <tbody>
                  {ITEM_NAMES.map((item) => {
                    const bd = finalScore.item_breakdown[item]
                    const cfg = CONFIG.items[item]
                    return (
                      <tr key={item}>
                        <td className="py-1 capitalize">{item}</td>
                        <td className="py-1 text-right" style={{ fontFamily: 'var(--font-mono)' }}>{finalPlan[item]}</td>
                        <td className="py-1 text-right" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-faint)' }}>${cfg.price.toFixed(2)}</td>
                        <td className="py-1 text-right" style={{ fontFamily: 'var(--font-mono)' }}>${bd.revenue.toFixed(2)}</td>
                      </tr>
                    )
                  })}
                  <tr style={{ borderTop: '1px solid var(--line)' }}>
                    <td className="py-1.5 font-semibold">Total</td>
                    <td />
                    <td />
                    <td className="py-1.5 text-right font-semibold" style={{ fontFamily: 'var(--font-mono)', color: 'var(--teal)' }}>${finalScore.revenue.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="p-4 rounded-md space-y-2" style={{ background: 'var(--bg-inset)' }}>
              <h3 className="text-[11px] tracking-[0.1em] uppercase mb-1" style={{ color: 'var(--text-faint)' }}>Ingredients needed</h3>
              {(() => {
                const totalFlour = schedule.scheduled.reduce((s, t) => s + CONFIG.items[t.item].flour_kg * t.quantity, 0)
                const totalButter = schedule.scheduled.reduce((s, t) => s + CONFIG.items[t.item].butter_kg * t.quantity, 0)
                return (
                  <p className="text-[13.5px]" style={{ fontFamily: 'var(--font-mono)' }}>{totalFlour.toFixed(2)} kg flour, {totalButter.toFixed(2)} kg butter</p>
                )
              })()}
              <h3 className="text-[11px] tracking-[0.1em] uppercase pt-2" style={{ color: 'var(--text-faint)' }}>Projected waste</h3>
              <p className="text-[13.5px]" style={{ fontFamily: 'var(--font-mono)', color: 'var(--rose)' }}>{finalScore.total_waste} units</p>
            </div>
          </div>

          {/* Override / why panel */}
          <div className="mt-6 pt-6" style={{ borderTop: '1px solid var(--line)' }}>
            <h3 className="text-[12px] tracking-[0.1em] uppercase mb-3" style={{ color: 'var(--text-dim)' }}>Review &amp; override</h3>
            <div className="flex flex-wrap gap-2 mb-4">
              {ITEM_NAMES.map((item) => (
                <button
                  key={item}
                  onClick={() => setWhyItem(item)}
                  className="text-[12px] px-2.5 py-1.5 rounded border capitalize"
                  style={{ borderColor: whyItem === item ? 'var(--amber)' : 'var(--line)', color: whyItem === item ? 'var(--amber)' : 'var(--text-dim)' }}
                >
                  why {item}?
                </button>
              ))}
            </div>

            {whyItem && rawDemand && adjustedPlan && (
              <div className="p-4 rounded-md mb-5 text-[13px] leading-relaxed" style={{ background: 'var(--bg-inset)' }}>
                <p className="mb-2">Why {finalPlan[whyItem]} units of {whyItem}?</p>
                <p style={{ color: 'var(--text-dim)' }}>├ ML forecast predicted: {rawDemand[whyItem]} units</p>
                <p style={{ color: 'var(--text-dim)' }}>├ After expert rules: {adjustedPlan[whyItem]} units</p>
                <p style={{ color: 'var(--text-dim)' }}>└ After search optimizer: {finalPlan[whyItem]} units</p>
                {firedRules.filter((r) => whyItem in r.changes).length > 0 ? (
                  <div className="mt-2">
                    <p style={{ color: 'var(--text-faint)' }}>Rules that affected {whyItem}:</p>
                    {firedRules.filter((r) => whyItem in r.changes).map((r) => (
                      <p key={r.rule} style={{ color: 'var(--teal)' }}>✔ {r.rule}: {r.changes[whyItem] >= 0 ? '+' : ''}{r.changes[whyItem]} units — {r.reason}</p>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2" style={{ color: 'var(--text-faint)' }}>No rules changed {whyItem}'s quantity.</p>
                )}
              </div>
            )}

            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
              {ITEM_NAMES.map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <label className="text-[12px] w-20 capitalize" style={{ color: 'var(--text-faint)' }}>{item}</label>
                  <input
                    type="number"
                    min={0}
                    placeholder={String(finalPlan[item])}
                    value={overrides[item] ?? ''}
                    onChange={(e) => setOverrides((o) => ({ ...o, [item]: e.target.value }))}
                    className="w-20 px-2 py-1.5 rounded text-[13px]"
                    style={{ background: 'var(--bg-inset)', border: '1px solid var(--line)', color: 'var(--text)' }}
                  />
                  <button
                    onClick={() => applyOverride(item)}
                    className="text-[12px] px-2.5 py-1.5 rounded"
                    style={{ background: 'var(--amber-dim)', color: 'var(--amber)' }}
                  >
                    set
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function PlanTable({ title, subtitle, rows, valueLabel }: { title: string; subtitle: string; rows: { item: string; value: number }[]; valueLabel: string }) {
  return (
    <div className="p-6 rounded-lg border mb-8" style={{ borderColor: 'var(--line)', background: 'var(--bg-raised)' }}>
      <h2 className="text-[13px] tracking-[0.1em] uppercase mb-1" style={{ color: 'var(--text-dim)' }}>{title}</h2>
      <p className="text-[12.5px] mb-4" style={{ color: 'var(--text-faint)' }}>{subtitle}</p>
      <table className="w-full text-[13px]">
        <thead>
          <tr style={{ color: 'var(--text-faint)' }}>
            <th className="text-left font-normal pb-2">Item</th>
            <th className="text-right font-normal pb-2">{valueLabel}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.item} style={{ borderTop: '1px solid var(--line)' }}>
              <td className="py-1.5 capitalize">{r.item}</td>
              <td className="py-1.5 text-right" style={{ fontFamily: 'var(--font-mono)' }}>{r.value} units</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
