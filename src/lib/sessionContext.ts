// Port of context.py — tracks user-stated preferences across the chat session.

const AVOIDANCE_ALIASES: Record<string, string[]> = {
  fish: ['fish', 'salmon', 'cod', 'tuna', 'tilapia', 'shrimp', 'seafood', 'shellfish', 'halibut', 'trout', 'sardine', 'anchovy', 'fillet', 'fillets'],
  seafood: ['fish', 'salmon', 'cod', 'tuna', 'tilapia', 'shrimp', 'seafood', 'shellfish', 'halibut', 'trout', 'sardine', 'anchovy', 'fillet', 'fillets'],
  shellfish: ['shrimp', 'shellfish', 'crab', 'lobster', 'clam', 'oyster', 'scallop'],
  chicken: ['chicken', 'poultry'],
  meat: ['chicken', 'beef', 'pork', 'turkey', 'lamb', 'meat', 'poultry', 'steak', 'ground beef', 'ground turkey', 'bacon', 'sausage'],
  beef: ['beef', 'steak', 'ground beef', 'brisket'],
  pork: ['pork', 'bacon', 'ham', 'sausage', 'pancetta'],
  dairy: ['milk', 'cheese', 'butter', 'cream', 'yogurt', 'dairy', 'whey', 'feta', 'mozzarella', 'cheddar', 'parmesan', 'cottage cheese'],
  gluten: ['wheat', 'gluten', 'flour', 'bread', 'pasta', 'tortilla', 'barley', 'rye'],
  nuts: ['nuts', 'almond', 'almonds', 'walnut', 'walnuts', 'cashew', 'cashews', 'peanut', 'peanuts', 'pecan', 'pecans', 'pistachio', 'pistachios'],
  eggs: ['egg', 'eggs'],
  soy: ['soy', 'tofu', 'edamame', 'tempeh', 'miso'],
}

const AVOIDANCE_PATTERNS: RegExp[] = [
  /i(?:'m| am| m)? (?:allergic|alergic|alergick|allergi[ck]|allerg[yi]c?) to (.+)/,
  /i (?:also )?can(?:'t| not|not) eat (.+)/,
  /i (?:also )?don(?:'t| not|not) (?:eat|like|want) (.+)/,
  /i (?:also )?(?:hate|dislike|avoid) (.+)/,
  /i (?:also )?(?:do not|dont) (?:eat|like|want) (.+)/,
  /i have an? (?:allergy|intolerance|alergy|intollerance) to (.+)/,
  /(?:no|without) (.+?) please/,
  /(.+?) (?:allergy|intolerance|makes me sick|upsets my stomach)/,
  /i(?:'m| am)? (?:intolerant|sensitive) to (.+)/,
  /(.+?) (?:makes|make) me (?:sick|ill|nauseous)/,
  /i(?:'m| am)? (?:also )?not (?:a fan of|into|eating) (.+)/,
  /(?:also,? )?i (?:really )?(?:hate|dislike|avoid|detest) (.+)/,
]

const FILLER = /\b(please|thanks|at all|ever|really|very much|too|either|also)\b/g

const DIETARY_STYLES = ['vegan', 'vegetarian', 'gluten free', 'gluten-free', 'dairy free', 'dairy-free', 'keto', 'paleo']

export interface ContextUpdateEvent {
  kind: 'calorie' | 'restriction' | 'avoidance'
  detail: string
}

export class SessionContext {
  calorieGoal: number | null = null
  dietaryRestrictions: string[] = []
  foodAvoidances: string[] = []
  private avoidanceTerms = new Set<string>()

  private expand(food: string) {
    this.avoidanceTerms.add(food)
    const aliases = AVOIDANCE_ALIASES[food]
    if (aliases) aliases.forEach((a) => this.avoidanceTerms.add(a))
  }

  /** Mirrors update_from_input; returns a log of what changed this turn. */
  updateFromInput(text: string): ContextUpdateEvent[] {
    const events: ContextUpdateEvent[] = []
    const textLower = text.toLowerCase().trim()

    const calMatch = textLower.match(/(\d{3,4})\s*cal/)
    if (calMatch) {
      this.calorieGoal = parseInt(calMatch[1], 10)
      events.push({ kind: 'calorie', detail: `calorie goal set to ${this.calorieGoal} cal/day` })
    }

    for (const style of DIETARY_STYLES) {
      if (textLower.includes(style) && !this.dietaryRestrictions.includes(style)) {
        this.dietaryRestrictions.push(style)
        events.push({ kind: 'restriction', detail: `dietary restriction noted — ${style}` })
      }
    }

    for (const pattern of AVOIDANCE_PATTERNS) {
      const match = textLower.match(pattern)
      if (match) {
        let food = match[1].trim().replace(/[.,!]+$/, '')
        food = food.replace(FILLER, '').trim()
        if (food && !this.foodAvoidances.includes(food)) {
          this.foodAvoidances.push(food)
          this.expand(food)
          events.push({ kind: 'avoidance', detail: `food avoidance noted — ${food}` })
        }
        break
      }
    }

    return events
  }

  responseContainsAvoidedFood(response: string): boolean {
    const lower = response.toLowerCase()
    for (const term of this.avoidanceTerms) {
      if (lower.includes(term)) return true
    }
    return false
  }

  summary(): string {
    const parts: string[] = []
    if (this.calorieGoal) parts.push(`Calorie goal: ${this.calorieGoal} cal/day`)
    if (this.dietaryRestrictions.length) parts.push(`Dietary restrictions: ${this.dietaryRestrictions.join(', ')}`)
    if (this.foodAvoidances.length) parts.push(`Food avoidances: ${this.foodAvoidances.join(', ')}`)
    return parts.length ? parts.join(' | ') : 'No preferences set yet.'
  }
}
