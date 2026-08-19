// Client-side port of the BakeryMind Python pipeline (config.py, forecaster.py,
// expert_rules.py, search.py, planner.py). Behavior is a line-for-line port with one
// substitution: forecaster.py trained a scikit-learn RandomForestRegressor server-side.
// Since the model has only three low-cardinality categorical features (day of week x
// item x weather), a RandomForest trained on this data converges almost exactly to the
// per-bucket mean of units_sold — so this port "trains" by computing that same mean,
// live in the browser, from the real 1,830-row sales_history.csv fetched on page load.

import bakeryConfig from '../data/bakery_config.json'

export interface ItemConfig {
  price: number
  cost: number
  flour_kg: number
  butter_kg: number
  tray_units: number
  bake_minutes: number
}

export const CONFIG = bakeryConfig as unknown as {
  bakery_name: string
  oven: { tray_capacity: number }
  items: Record<string, ItemConfig>
  day_multipliers: Record<string, number>
  search: { step_size: number; max_iterations: number; missed_sales_penalty_rate: number }
}

export const ITEM_NAMES = Object.keys(CONFIG.items)
export const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export type Plan = Record<string, number>

// ---------------------------------------------------------------------------
// Forecaster
// ---------------------------------------------------------------------------

export interface ForecastModel {
  lookup: Record<string, Record<number, Record<string, number>>> // item -> dow -> weather -> avg units_sold
  itemFallback: Record<string, number>
  rowsTrainedOn: number
}

interface SalesRow {
  dow_index: number
  weather: string
  item: string
  units_sold: number
}

function parseSalesCSV(csvText: string): SalesRow[] {
  const lines = csvText.trim().split('\n')
  const header = lines[0].split(',').map((h) => h.trim())
  const idx = (name: string) => header.indexOf(name)
  const dowI = idx('dow_index')
  const weatherI = idx('weather')
  const itemI = idx('item')
  const soldI = idx('units_sold')

  return lines.slice(1).map((line) => {
    const cols = line.split(',')
    return {
      dow_index: parseInt(cols[dowI], 10),
      weather: cols[weatherI].trim(),
      item: cols[itemI].trim(),
      units_sold: parseInt(cols[soldI], 10),
    }
  })
}

export async function trainForecaster(csvUrl = '/assets/sales_history.csv'): Promise<ForecastModel> {
  const res = await fetch(csvUrl)
  const text = await res.text()
  const rows = parseSalesCSV(text)

  const buckets: Record<string, number[]> = {}
  const itemTotals: Record<string, number[]> = {}

  for (const r of rows) {
    const key = `${r.item}|${r.dow_index}|${r.weather}`
    ;(buckets[key] ||= []).push(r.units_sold)
    ;(itemTotals[r.item] ||= []).push(r.units_sold)
  }

  const lookup: ForecastModel['lookup'] = {}
  for (const key in buckets) {
    const [item, dowStr, weather] = key.split('|')
    const dow = parseInt(dowStr, 10)
    const vals = buckets[key]
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length
    lookup[item] ||= {}
    lookup[item][dow] ||= {}
    lookup[item][dow][weather] = avg
  }

  const itemFallback: Record<string, number> = {}
  for (const item in itemTotals) {
    const vals = itemTotals[item]
    itemFallback[item] = vals.reduce((a, b) => a + b, 0) / vals.length
  }

  return { lookup, itemFallback, rowsTrainedOn: rows.length }
}

export function predictAllItems(model: ForecastModel, dow: number, weather: string): Plan {
  const result: Plan = {}
  for (const item of ITEM_NAMES) {
    const val = model.lookup[item]?.[dow]?.[weather]
    result[item] = Math.max(0, Math.round(val ?? model.itemFallback[item] ?? 10))
  }
  return result
}

// ---------------------------------------------------------------------------
// Expert rule engine
// ---------------------------------------------------------------------------

export interface RuleContext {
  dow: number
  weather: 'sunny' | 'rainy'
  month: number
  day: number
  flour_kg: number
  butter_kg: number
  last_week_sold: Record<string, number>
}

interface Rule {
  name: string
  priority: number
  condition: (ctx: RuleContext) => boolean
  action: (plan: Plan, ctx: RuleContext) => void
  reason: string
}

function scaleAll(plan: Plan, factor: number) {
  for (const item in plan) plan[item] = Math.max(0, Math.round(plan[item] * factor))
}
function scaleItems(plan: Plan, items: string[], factor: number) {
  for (const item of items) if (item in plan) plan[item] = Math.max(0, Math.round(plan[item] * factor))
}
function capFlourHeavy(plan: Plan, flourKg: number) {
  const scarcity = flourKg / 10.0
  for (const item of ['sourdough', 'baguette']) if (item in plan) plan[item] = Math.max(0, Math.round(plan[item] * scarcity))
  if ('croissant' in plan) plan['croissant'] = Math.max(0, Math.round(plan['croissant'] * (scarcity + 0.2)))
}
function applyCeiling(plan: Plan, lastWeekSold: Record<string, number>, maxRatio: number) {
  for (const item in plan) {
    const lw = lastWeekSold[item]
    if (lw && lw > 0) {
      const ceiling = Math.round(lw * maxRatio)
      if (plan[item] > ceiling) plan[item] = ceiling
    }
  }
}
function applyFloor(plan: Plan, minimum: number) {
  for (const item in plan) if (plan[item] < minimum) plan[item] = minimum
}

const RULES: Rule[] = [
  {
    name: 'mothers_day_weekend',
    priority: 1,
    condition: (ctx) => ctx.month === 5 && [5, 6].includes(ctx.dow) && ctx.day >= 8 && ctx.day <= 14,
    action: (plan) => scaleAll(plan, 1.25),
    reason: "Mother's Day weekend — historically 25% higher foot traffic.",
  },
  {
    name: 'valentines_day',
    priority: 1,
    condition: (ctx) => ctx.month === 2 && ctx.day === 14,
    action: (plan) => scaleItems(plan, ['cookie', 'croissant'], 1.4),
    reason: "Valentine's Day — cookies and croissants sell ~40% more as gifts.",
  },
  {
    name: 'monday_slowdown',
    priority: 2,
    condition: (ctx) => ctx.dow === 0,
    action: (plan) => scaleAll(plan, 0.9),
    reason: 'Monday adjustment — foot traffic runs ~10% below weekday average.',
  },
  {
    name: 'friday_pickup',
    priority: 2,
    condition: (ctx) => ctx.dow === 4,
    action: (plan) => scaleAll(plan, 1.08),
    reason: 'Friday pickup — end-of-week customers tend to treat themselves.',
  },
  {
    name: 'rainy_day_warm_items',
    priority: 3,
    condition: (ctx) => ctx.weather === 'rainy',
    action: (plan) => scaleItems(plan, ['muffin', 'croissant'], 1.12),
    reason: 'Rainy weather — warm pastry demand rises ~12%.',
  },
  {
    name: 'rainy_day_cold_items',
    priority: 3,
    condition: (ctx) => ctx.weather === 'rainy',
    action: (plan) => scaleItems(plan, ['sourdough', 'baguette'], 0.92),
    reason: 'Rainy weather — cold-grab bread items dip ~8% (fewer walk-ins).',
  },
  {
    name: 'low_flour_cap',
    priority: 5,
    condition: (ctx) => (ctx.flour_kg ?? 999) < 10,
    action: (plan, ctx) => capFlourHeavy(plan, ctx.flour_kg),
    reason: 'Low flour stock — capping bread and croissant production to conserve supply.',
  },
  {
    name: 'low_butter_cap',
    priority: 5,
    condition: (ctx) => (ctx.butter_kg ?? 999) < 3,
    action: (plan) => scaleItems(plan, ['croissant', 'muffin'], 0.6),
    reason: 'Low butter stock — reducing butter-heavy items by 40%.',
  },
  {
    name: 'never_exceed_120pct_of_last_week',
    priority: 9,
    condition: () => true,
    action: (plan, ctx) => applyCeiling(plan, ctx.last_week_sold || {}, 1.2),
    reason: 'Safety ceiling — never produce more than 120% of same day last week.',
  },
  {
    name: 'minimum_viable_batch',
    priority: 10,
    condition: () => true,
    action: (plan) => applyFloor(plan, 5),
    reason: 'Minimum batch — always make at least 5 of each item to keep shelves stocked.',
  },
]

export interface FiredRule {
  rule: string
  reason: string
  changes: Record<string, number>
}

export class ExpertRuleEngine {
  firedRules: FiredRule[] = []

  apply(plan: Plan, ctx: RuleContext): Plan {
    this.firedRules = []
    const sorted = [...RULES].sort((a, b) => a.priority - b.priority)
    for (const rule of sorted) {
      if (rule.condition(ctx)) {
        const before = { ...plan }
        rule.action(plan, ctx)
        const changes: Record<string, number> = {}
        for (const item in plan) {
          if (plan[item] !== before[item]) changes[item] = plan[item] - before[item]
        }
        this.firedRules.push({ rule: rule.name, reason: rule.reason, changes })
      }
    }
    return plan
  }
}

// ---------------------------------------------------------------------------
// Search optimizer (greedy hill climbing)
// ---------------------------------------------------------------------------

export interface ItemScore {
  produced: number
  sold: number
  waste: number
  missed_sales: number
  revenue: number
  make_cost: number
  missed_penalty: number
  profit: number
}

export interface PlanScore {
  profit: number
  revenue: number
  cost: number
  missed_penalty: number
  total_waste: number
  total_sold: number
  item_breakdown: Record<string, ItemScore>
}

const MISSED_PENALTY_RATE = CONFIG.search.missed_sales_penalty_rate

export function scorePlan(plan: Plan, predictedDemand: Plan): PlanScore {
  let totalRevenue = 0
  let totalCost = 0
  let totalWaste = 0
  let totalSold = 0
  const itemBreakdown: Record<string, ItemScore> = {}

  for (const item in plan) {
    const cfg = CONFIG.items[item] ?? ({ price: 2.0, cost: 0.8 } as ItemConfig)
    const produced = plan[item]
    const demand = predictedDemand[item] ?? produced
    const sold = Math.min(produced, demand)
    const waste = Math.max(0, produced - demand)
    const revenue = sold * cfg.price
    const makeCost = produced * cfg.cost
    const missed = Math.max(0, demand - produced)
    const missedPenalty = missed * cfg.price * 0.8

    totalRevenue += revenue
    totalCost += makeCost
    totalWaste += waste
    totalSold += sold

    itemBreakdown[item] = {
      produced,
      sold,
      waste,
      missed_sales: missed,
      revenue: round2(revenue),
      make_cost: round2(makeCost),
      missed_penalty: round2(missedPenalty),
      profit: round2(revenue - makeCost - missedPenalty),
    }
  }

  let totalMissedPenalty = 0
  for (const item in plan) {
    const demand = predictedDemand[item] ?? 0
    const cfg = CONFIG.items[item] ?? ({ price: 2.0 } as ItemConfig)
    totalMissedPenalty += Math.max(0, demand - plan[item]) * cfg.price * MISSED_PENALTY_RATE
  }
  const profit = totalRevenue - totalCost - totalMissedPenalty

  return {
    profit: round2(profit),
    revenue: round2(totalRevenue),
    cost: round2(totalCost),
    missed_penalty: round2(totalMissedPenalty),
    total_waste: totalWaste,
    total_sold: totalSold,
    item_breakdown: itemBreakdown,
  }
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}

export interface Constraints {
  flour_kg: number
  butter_kg: number
}

const ITEM_TRAY_COST: Record<string, number> = Object.fromEntries(
  Object.entries(CONFIG.items).map(([item, cfg]) => [item, cfg.tray_units])
)

export function isFeasible(plan: Plan, constraints: Constraints): boolean {
  let trayUsage = 0
  let flourNeeded = 0
  let butterNeeded = 0
  for (const item in plan) {
    trayUsage += plan[item] * (ITEM_TRAY_COST[item] ?? 1.0)
    flourNeeded += plan[item] * (CONFIG.items[item]?.flour_kg ?? 0)
    butterNeeded += plan[item] * (CONFIG.items[item]?.butter_kg ?? 0)
  }
  if (trayUsage > CONFIG.oven.tray_capacity) return false
  if (flourNeeded > (constraints.flour_kg ?? 999)) return false
  if (butterNeeded > (constraints.butter_kg ?? 999)) return false
  return true
}

export interface SearchStep {
  iteration: number
  plan: Plan
  profit: number
  move: string
}

export interface OptimizeResult {
  plan: Plan
  score: PlanScore
  searchLog: SearchStep[]
}

export function optimizeProduction(initialPlan: Plan, predictedDemand: Plan, constraints: Constraints): OptimizeResult {
  const params = CONFIG.search
  let currentPlan: Plan = { ...initialPlan }
  let currentScore = scorePlan(currentPlan, predictedDemand).profit
  const searchLog: SearchStep[] = [
    { iteration: 0, plan: { ...currentPlan }, profit: currentScore, move: 'initial state (ML + rules recommendation)' },
  ]

  for (let iteration = 1; iteration <= params.max_iterations; iteration++) {
    let bestNeighbor: Plan | null = null
    let bestNeighborScore = currentScore
    let bestMove = ''

    for (const item in currentPlan) {
      for (const delta of [params.step_size, -params.step_size]) {
        const neighbor = { ...currentPlan }
        neighbor[item] = Math.max(0, neighbor[item] + delta)
        if (!isFeasible(neighbor, constraints)) continue
        const neighborScore = scorePlan(neighbor, predictedDemand).profit
        if (neighborScore > bestNeighborScore) {
          bestNeighbor = neighbor
          bestNeighborScore = neighborScore
          bestMove = `${item} ${delta > 0 ? '↑' : '↓'}${Math.abs(delta)}`
        }
      }
    }

    if (!bestNeighbor) {
      searchLog.push({ iteration, plan: { ...currentPlan }, profit: currentScore, move: 'local optimum reached — search complete' })
      break
    }

    currentPlan = bestNeighbor
    currentScore = bestNeighborScore
    searchLog.push({ iteration, plan: { ...currentPlan }, profit: currentScore, move: bestMove })
  }

  return { plan: currentPlan, score: scorePlan(currentPlan, predictedDemand), searchLog }
}

// ---------------------------------------------------------------------------
// Baking planner (STRIPS-style scheduler)
// ---------------------------------------------------------------------------

export interface BakeTask {
  item: string
  quantity: number
  bakeMinutes: number
  bakeHours: number
  trayUnits: number
  startTime: number
  endTime: number
}

export interface UnscheduledItem {
  item: string
  reason: string
}

export function timeStr(hourFloat: number): string {
  let h = Math.floor(hourFloat)
  let m = Math.round((hourFloat - h) * 60)
  if (m === 60) {
    h += 1
    m = 0
  }
  const period = h < 12 ? 'AM' : 'PM'
  let displayH = h <= 12 ? h : h - 12
  if (displayH === 0) displayH = 12
  return `${displayH}:${String(m).padStart(2, '0')} ${period}`
}

export function durationStr(bakeMinutes: number): string {
  const h = Math.floor(bakeMinutes / 60)
  const m = bakeMinutes % 60
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`
}

class OvenTimeline {
  reservations: [number, number, number][] = []
  capacity: number
  constructor(capacity: number) {
    this.capacity = capacity
  }

  trayUnitsAt(time: number): number {
    return this.reservations.filter(([s, e]) => s <= time && time < e).reduce((sum, [, , u]) => sum + u, 0)
  }

  canFit(start: number, end: number, trayUnits: number): boolean {
    const checkPoints = [start]
    for (const [s] of this.reservations) if (start < s && s < end) checkPoints.push(s)
    return checkPoints.every((t) => this.trayUnitsAt(t) + trayUnits <= this.capacity)
  }

  reserve(start: number, end: number, trayUnits: number) {
    this.reservations.push([start, end, trayUnits])
  }
}

export function planBakingSchedule(
  productionPlan: Plan,
  openingHour = 7.0,
  startHour = 3.0
): { scheduled: BakeTask[]; unscheduled: UnscheduledItem[] } {
  const timeline = new OvenTimeline(CONFIG.oven.tray_capacity)
  const scheduled: BakeTask[] = []
  const unscheduled: UnscheduledItem[] = []
  const scheduledItems = new Set<string>()

  const tasks: BakeTask[] = Object.entries(productionPlan)
    .filter(([item, qty]) => qty > 0 && item in CONFIG.items)
    .map(([item, qty]) => {
      const cfg = CONFIG.items[item]
      return {
        item,
        quantity: qty,
        bakeMinutes: cfg.bake_minutes,
        bakeHours: cfg.bake_minutes / 60,
        trayUnits: cfg.tray_units * qty,
        startTime: -1,
        endTime: -1,
      }
    })
    .sort((a, b) => b.bakeHours - a.bakeHours)

  for (const task of tasks) {
    if (scheduledItems.has(task.item)) {
      unscheduled.push({ item: task.item, reason: 'already scheduled' })
      continue
    }
    let placed = false
    let searchTime = startHour
    const step = 0.25
    while (searchTime + task.bakeHours <= openingHour) {
      const endTime = searchTime + task.bakeHours
      if (timeline.canFit(searchTime, endTime, task.trayUnits)) {
        timeline.reserve(searchTime, endTime, task.trayUnits)
        task.startTime = searchTime
        task.endTime = endTime
        scheduled.push(task)
        scheduledItems.add(task.item)
        placed = true
        break
      }
      searchTime += step
    }
    if (!placed) {
      const finishNeeded = startHour + task.bakeHours
      unscheduled.push({
        item: task.item,
        reason: `needs ${task.bakeMinutes} min — would finish at ${timeStr(finishNeeded)}, after opening at ${timeStr(openingHour)}`,
      })
    }
  }

  scheduled.sort((a, b) => a.startTime - b.startTime)
  return { scheduled, unscheduled }
}
