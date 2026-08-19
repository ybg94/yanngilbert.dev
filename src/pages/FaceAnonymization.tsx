import { useRef, useState } from 'react'
import PipelineStrip from '../components/PipelineStrip'
import { loadModels, detectFaces, blurRegion, type DetectedFace } from '../lib/faceAnonymization'

const STAGES = [{ label: 'load models' }, { label: 'detect faces' }, { label: 'landmark eyes' }, { label: 'gaussian blur' }]

type Status = 'idle' | 'loading-models' | 'detecting' | 'no-faces' | 'done' | 'error'

export default function FaceAnonymization() {
  const [status, setStatus] = useState<Status>('idle')
  const [stage, setStage] = useState(-1)
  const [faces, setFaces] = useState<DetectedFace[]>([])
  const [boxedUrl, setBoxedUrl] = useState<string | null>(null)
  const [blurredUrl, setBlurredUrl] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setStatus('loading-models')
    setStage(0)
    setBoxedUrl(null)
    setBlurredUrl(null)
    setFaces([])
    setErrorMsg('')

    try {
      await loadModels()

      const img = new Image()
      const url = URL.createObjectURL(file)
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('Could not load that image file.'))
        img.src = url
      })

      setStage(1)
      setStatus('detecting')
      const detected = await detectFaces(img)
      setStage(2)

      if (detected.length === 0) {
        setStatus('no-faces')
        setStage(-1)
        URL.revokeObjectURL(url)
        return
      }

      setFaces(detected)

      // boxed preview canvas
      const boxCanvas = document.createElement('canvas')
      boxCanvas.width = img.naturalWidth
      boxCanvas.height = img.naturalHeight
      const bctx = boxCanvas.getContext('2d')!
      bctx.drawImage(img, 0, 0)
      bctx.strokeStyle = '#f2a65a'
      bctx.lineWidth = Math.max(2, img.naturalWidth / 300)
      detected.forEach((f) => {
        bctx.strokeRect(f.box.x, f.box.y, f.box.width, f.box.height)
      })
      setBoxedUrl(boxCanvas.toDataURL('image/jpeg', 0.92))

      setStage(3)
      const blurCanvas = document.createElement('canvas')
      blurCanvas.width = img.naturalWidth
      blurCanvas.height = img.naturalHeight
      const ctx = blurCanvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      detected.forEach((f) => {
        const radius = Math.max(6, f.box.width * 0.08)
        blurRegion(ctx, img, img.naturalWidth, img.naturalHeight, f.leftEye, radius)
        blurRegion(ctx, img, img.naturalWidth, img.naturalHeight, f.rightEye, radius)
      })
      setBlurredUrl(blurCanvas.toDataURL('image/jpeg', 0.92))

      setStatus('done')
      window.setTimeout(() => setStage(-1), 400)
      URL.revokeObjectURL(url)
    } catch (e) {
      setStatus('error')
      setStage(-1)
      setErrorMsg(e instanceof Error ? e.message : 'Something went wrong.')
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-5 md:px-8 py-14 md:py-20">
      <div className="flex items-center gap-2 mb-3" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-faint)', fontSize: 13 }}>
        <span className="status-dot on" />
        <span>cv-pipeline-service</span>
      </div>
      <h1 className="text-[36px] md:text-[44px] mb-3">Face Anonymization</h1>
      <p className="max-w-2xl mb-2" style={{ color: 'var(--text-dim)' }}>
        Detects faces, locates the eyes, and Gaussian-blurs them to anonymize a photo. The
        original project used OpenCV Haar cascades server-side; this browser port swaps
        detection for a lightweight on-device model (face-api.js) so the whole pipeline — model,
        image, and output — runs locally.
      </p>
      <p className="max-w-2xl mb-8 text-[13px]" style={{ color: 'var(--teal)' }}>
        Your photo is never uploaded anywhere — everything runs in this tab.
      </p>

      <div className="mb-8">
        <PipelineStrip stages={STAGES} activeIndex={stage} />
      </div>

      <div className="p-6 rounded-lg border mb-8" style={{ borderColor: 'var(--line)', background: 'var(--bg-raised)' }}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) handleFile(f)
          }}
        />
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            const f = e.dataTransfer.files?.[0]
            if (f) handleFile(f)
          }}
          className="rounded-lg border-2 border-dashed flex flex-col items-center justify-center py-12 cursor-pointer transition-colors hover:bg-white/5"
          style={{ borderColor: 'var(--line)' }}
        >
          <p className="text-[14px] mb-1" style={{ color: 'var(--text)' }}>
            {status === 'loading-models' || status === 'detecting' ? STAGES[Math.max(stage, 0)].label + '…' : 'Click or drop a photo here'}
          </p>
          <p className="text-[12.5px]" style={{ color: 'var(--text-faint)' }}>JPG or PNG, processed entirely on your device</p>
        </div>
      </div>

      {status === 'no-faces' && (
        <div className="p-4 rounded-lg border mb-8 text-[13.5px]" style={{ borderColor: 'var(--line)', background: 'var(--bg-raised)', color: 'var(--text-dim)' }}>
          No faces detected in that image — try a clearer, more front-facing photo.
        </div>
      )}

      {status === 'error' && (
        <div className="p-4 rounded-lg border mb-8 text-[13.5px]" style={{ borderColor: 'var(--rose)', background: 'var(--rose-dim)' }}>
          {errorMsg}
        </div>
      )}

      {boxedUrl && blurredUrl && (
        <div>
          <div className="flex items-center gap-3 mb-4 text-[13px]" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>
            <span>faces detected: <span style={{ color: 'var(--amber)' }}>{faces.length}</span></span>
            <span>·</span>
            <span>method: tiny face detector + 68-pt landmarks</span>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <p className="text-[12px] tracking-[0.1em] uppercase mb-2" style={{ color: 'var(--text-faint)' }}>1 — detected</p>
              <img src={boxedUrl} alt="Detected faces" className="w-full rounded-lg border" style={{ borderColor: 'var(--line)' }} />
            </div>
            <div>
              <p className="text-[12px] tracking-[0.1em] uppercase mb-2" style={{ color: 'var(--text-faint)' }}>2 — eyes blurred</p>
              <img src={blurredUrl} alt="Eyes blurred" className="w-full rounded-lg border" style={{ borderColor: 'var(--line)' }} />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3 items-center">
            <a
              href={blurredUrl}
              download="anonymized.jpg"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-lg font-semibold text-[14px]"
              style={{ background: 'var(--amber)', color: '#1a1206', fontFamily: 'var(--font-mono)' }}
            >
              ↓ download anonymized.jpg
            </a>
            {faces.map((f, i) => (
              <span key={i} className="text-[12px] px-2.5 py-1.5 rounded" style={{ background: 'var(--bg-inset)', color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>
                face {i + 1}: tilt {f.tiltDegrees.toFixed(1)}°
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
