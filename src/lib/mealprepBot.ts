// Client-side port of bot.py's MealPrepChatbot.
//
// The original used spaCy + a SentenceTransformer (all-MiniLM-L6-v2) to embed and
// compare questions semantically — that stack only runs server-side in Python.
// This browser port swaps the retrieval step for TF-IDF + cosine similarity over the
// same 514-pair corpus, computed entirely client-side. Everything else — the session
// context tracker, the avoidance filtering, the junk-food redirect, the response
// selection order — is a line-for-line behavioral port of the original.

import corpusData from '../data/mealprep_corpus.json'
import { SessionContext, type ContextUpdateEvent } from './sessionContext'

interface QAPair {
  q: string
  a: string
}

const QA_PAIRS = corpusData as QAPair[]
const SIMILARITY_THRESHOLD = 0.22

const STOP_WORDS = new Set([
  'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', 'your', 'yours',
  'yourself', 'yourselves', 'he', 'him', 'his', 'himself', 'she', 'her', 'hers', 'herself',
  'it', 'its', 'itself', 'they', 'them', 'their', 'theirs', 'themselves', 'what', 'which',
  'who', 'whom', 'this', 'that', 'these', 'those', 'am', 'is', 'are', 'was', 'were', 'be',
  'been', 'being', 'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing', 'a', 'an',
  'the', 'and', 'but', 'if', 'or', 'because', 'as', 'until', 'while', 'of', 'at', 'by', 'for',
  'with', 'about', 'against', 'between', 'into', 'through', 'during', 'before', 'after',
  'above', 'below', 'to', 'from', 'up', 'down', 'in', 'out', 'on', 'off', 'over', 'under',
  'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all',
  'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not',
  'only', 'own', 'same', 'so', 'than', 'too', 'very', 's', 't', 'can', 'will', 'just', 'don',
  'should', 'now',
])

const JUNK_PATTERNS = [
  'cheeseburger', 'cheeseburgers', 'burger', 'burgers', 'fast food', 'mcdonald', 'mcdonalds',
  'kfc', 'taco bell', 'pizza', 'hot dog', 'hot dogs', 'fried chicken', 'french fries', 'fries',
  'donut', 'donuts', 'doughnut', 'candy bar', 'candy bars', 'ice cream', 'soda', 'chips', 'nachos',
]

function tokenize(text: string): string[] {
  const raw = text.toLowerCase().match(/[a-z']+/g) || []
  return raw.filter((t) => !STOP_WORDS.has(t) && t.length > 1)
}

type SparseVec = Record<string, number>

function vecNorm(vec: SparseVec): number {
  let sum = 0
  for (const k in vec) sum += vec[k] * vec[k]
  return Math.sqrt(sum)
}

function cosine(a: SparseVec, b: SparseVec): number {
  const [small, big] = Object.keys(a).length < Object.keys(b).length ? [a, b] : [b, a]
  let dot = 0
  for (const k in small) if (big[k]) dot += small[k] * big[k]
  const na = vecNorm(a)
  const nb = vecNorm(b)
  if (na === 0 || nb === 0) return 0
  return dot / (na * nb)
}

// --- build the corpus index once, at module load ---
const docTokens = QA_PAIRS.map((p) => tokenize(p.q))
const documentFrequency: Record<string, number> = {}
docTokens.forEach((toks) => {
  new Set(toks).forEach((t) => {
    documentFrequency[t] = (documentFrequency[t] || 0) + 1
  })
})
const N = docTokens.length

function idf(term: string): number {
  return Math.log((N + 1) / ((documentFrequency[term] || 0) + 1)) + 1
}

function vectorize(tokens: string[]): SparseVec {
  const tf: Record<string, number> = {}
  tokens.forEach((t) => {
    tf[t] = (tf[t] || 0) + 1
  })
  const vec: SparseVec = {}
  for (const t in tf) vec[t] = tf[t] * idf(t)
  return vec
}

const corpusVectors = docTokens.map(vectorize)

function isJunkFoodQuery(text: string): boolean {
  const lower = text.toLowerCase()
  return JUNK_PATTERNS.some((kw) => lower.includes(kw))
}

export interface BotTrace {
  stage: 'preference' | 'junk-redirect' | 'avoided-clarify' | 'retrieval' | 'fallback'
  topMatches?: { question: string; score: number }[]
  contextEvents?: ContextUpdateEvent[]
}

export interface BotReply {
  text: string
  trace: BotTrace
}

export class MealPrepBot {
  context = new SessionContext()

  getResponse(userInput: string): BotReply {
    const events = this.context.updateFromInput(userInput)

    if (events.length > 0) {
      return {
        text: `Got it, I have noted that! Your current preferences: ${this.context.summary()}. Feel free to ask me about meal ideas, calorie goals, portion sizes, grocery lists, ingredient substitutions, or freezer meals.`,
        trace: { stage: 'preference', contextEvents: events },
      }
    }

    if (isJunkFoodQuery(userInput)) {
      return {
        text: 'That is not something I would recommend for your weight loss goals. High-calorie, low-nutrient foods make it very hard to stay in a calorie deficit. I can suggest healthier alternatives — just ask for meal ideas, recipes, or snack options and I will point you in the right direction.',
        trace: { stage: 'junk-redirect' },
      }
    }

    const queryLower = userInput.toLowerCase()
    if (this.context.responseContainsAvoidedFood(queryLower)) {
      const avoidedStr = this.context.foodAvoidances.join(', ')
      return {
        text: `It looks like you have told me you want to avoid ${avoidedStr}. Would you like me to suggest an alternative? I can recommend chicken, turkey, beef, vegetarian, or vegan options.`,
        trace: { stage: 'avoided-clarify' },
      }
    }

    const queryVec = vectorize(tokenize(userInput))
    const scored = corpusVectors
      .map((dv, i) => ({ i, score: cosine(queryVec, dv) }))
      .sort((a, b) => b.score - a.score)

    const topMatches = scored.slice(0, 3).map((s) => ({ question: QA_PAIRS[s.i].q, score: s.score }))

    for (const { i, score } of scored) {
      if (score < SIMILARITY_THRESHOLD) break
      const response = QA_PAIRS[i].a
      if (this.context.responseContainsAvoidedFood(response)) continue
      return { text: response, trace: { stage: 'retrieval', topMatches } }
    }

    return {
      text: 'I am not sure I understood that. Could you rephrase? I can help with meal ideas, calorie goals, portion sizes, grocery lists, ingredient substitutions, freezer meals, or eating out tips.',
      trace: { stage: 'fallback', topMatches },
    }
  }
}

export const CORPUS_SIZE = QA_PAIRS.length
