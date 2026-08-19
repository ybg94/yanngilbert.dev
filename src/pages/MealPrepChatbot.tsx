import { useRef, useState, useEffect } from 'react'
import PipelineStrip from '../components/PipelineStrip'
import { MealPrepBot, CORPUS_SIZE, type BotTrace } from '../lib/mealprepBot'

interface Message {
  role: 'user' | 'bot'
  text: string
  trace?: BotTrace
}

const STAGES = [{ label: 'preprocess' }, { label: 'tf-idf vectorize' }, { label: 'cosine retrieve' }, { label: 'respond' }]

const SUGGESTIONS = [
  'How many calories should I eat to lose weight?',
  "I'm allergic to peanuts",
  'Give me a grocery list for meal prepping',
  "What's a good high protein snack?",
  'Can I get a cheeseburger recipe?',
]

export default function MealPrepChatbot() {
  const botRef = useRef(new MealPrepBot())
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'bot',
      text: 'Hello! I am your meal prep assistant for weight loss. Ask me about recipes, calories, portions, grocery lists, ingredient swaps, freezer meals, and more.',
    },
  ])
  const [input, setInput] = useState('')
  const [stage, setStage] = useState(-1)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed) return
    setMessages((m) => [...m, { role: 'user', text: trimmed }])
    setInput('')

    setStage(0)
    window.setTimeout(() => setStage(1), 150)
    window.setTimeout(() => setStage(2), 320)
    window.setTimeout(() => {
      setStage(3)
      const reply = botRef.current.getResponse(trimmed)
      setMessages((m) => [...m, { role: 'bot', text: reply.text, trace: reply.trace }])
      window.setTimeout(() => setStage(-1), 500)
    }, 500)
  }

  const context = botRef.current.context
  const lastTrace = [...messages].reverse().find((m) => m.trace)?.trace

  return (
    <div className="max-w-6xl mx-auto px-5 md:px-8 py-14 md:py-20">
      <div className="flex items-center gap-2 mb-3" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-faint)', fontSize: 13 }}>
        <span className="status-dot on" />
        <span>nlp-retrieval-service</span>
      </div>
      <h1 className="text-[36px] md:text-[44px] mb-3">MealPrep Chatbot</h1>
      <p className="max-w-2xl mb-8" style={{ color: 'var(--text-dim)' }}>
        A retrieval-based weight-loss meal prep assistant with {CORPUS_SIZE} Q&amp;A pairs, session
        preference tracking, and food-avoidance filtering. The original project ran spaCy +
        a sentence-transformer server-side; this browser port swaps that for TF-IDF + cosine
        similarity computed entirely on your device.
      </p>

      <div className="mb-8">
        <PipelineStrip stages={STAGES} activeIndex={stage} />
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        {/* Chat panel */}
        <div className="rounded-lg border flex flex-col" style={{ borderColor: 'var(--line)', background: 'var(--bg-raised)', height: 560 }}>
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-4">
            {messages.map((m, idx) => (
              <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className="max-w-[85%] px-4 py-3 rounded-lg text-[14px] leading-relaxed"
                  style={{
                    background: m.role === 'user' ? 'var(--amber-dim)' : 'var(--bg-inset)',
                    color: 'var(--text)',
                    border: `1px solid ${m.role === 'user' ? 'var(--amber-dim)' : 'var(--line)'}`,
                  }}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {stage >= 0 && stage < 3 && (
              <div className="flex justify-start">
                <div
                  className="px-4 py-3 rounded-lg text-[13px]"
                  style={{ background: 'var(--bg-inset)', border: '1px solid var(--line)', color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}
                >
                  {STAGES[stage].label}…
                </div>
              </div>
            )}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              send(input)
            }}
            className="border-t p-3 flex gap-2"
            style={{ borderColor: 'var(--line)' }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about meal ideas, calories, groceries…"
              className="flex-1 px-3 py-2.5 rounded-md text-[14px] outline-none"
              style={{ background: 'var(--bg-inset)', border: '1px solid var(--line)', color: 'var(--text)' }}
            />
            <button
              type="submit"
              className="px-4 py-2.5 rounded-md text-[13px] font-semibold"
              style={{ background: 'var(--amber)', color: '#1a1206', fontFamily: 'var(--font-mono)' }}
            >
              send
            </button>
          </form>
          <div className="px-3 pb-3 flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="text-[11.5px] px-2.5 py-1 rounded-full border transition-colors hover:bg-white/5"
                style={{ borderColor: 'var(--line)', color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="p-4 rounded-lg border" style={{ borderColor: 'var(--line)', background: 'var(--bg-raised)' }}>
            <h3 className="text-[12px] tracking-[0.1em] uppercase mb-3" style={{ color: 'var(--text-dim)' }}>
              Session context
            </h3>
            <p className="text-[13px] leading-relaxed" style={{ color: context.calorieGoal || context.dietaryRestrictions.length || context.foodAvoidances.length ? 'var(--teal)' : 'var(--text-faint)' }}>
              {context.summary()}
            </p>
          </div>

          {lastTrace?.topMatches && (
            <div className="p-4 rounded-lg border" style={{ borderColor: 'var(--line)', background: 'var(--bg-raised)' }}>
              <h3 className="text-[12px] tracking-[0.1em] uppercase mb-3" style={{ color: 'var(--text-dim)' }}>
                Top corpus matches
              </h3>
              <div className="space-y-2">
                {lastTrace.topMatches.map((tm) => (
                  <div key={tm.question} className="text-[12px]">
                    <div className="flex justify-between mb-1">
                      <span style={{ color: 'var(--text-dim)' }} className="truncate pr-2">{tm.question}</span>
                      <span style={{ color: 'var(--amber)', fontFamily: 'var(--font-mono)' }}>{tm.score.toFixed(2)}</span>
                    </div>
                    <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--bg-inset)' }}>
                      <div className="h-full rounded-full" style={{ width: `${Math.min(100, tm.score * 100)}%`, background: 'var(--teal)' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="p-4 rounded-lg border text-[12.5px] leading-relaxed" style={{ borderColor: 'var(--line)', background: 'var(--bg-raised)', color: 'var(--text-faint)' }}>
            Try stating a preference ("I'm vegan", "2000 cal"), then asking for a recipe — the bot
            filters retrieval results against anything you've said you avoid.
          </div>
        </div>
      </div>
    </div>
  )
}
