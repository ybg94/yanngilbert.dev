// Client-side face detection + eye-blur pipeline.
//
// The original CSC515 project used OpenCV Haar cascades to detect faces and eyes,
// then rotated each face crop so the eyes were level before blurring and rotating
// back. OpenCV's Haar cascades don't run in-browser without a heavy WASM build, so
// this port swaps detection for face-api.js (a TensorFlow.js face detector + 68-point
// landmark model, ~270KB total, running entirely on-device). The landmark model gives
// exact eye coordinates directly — no re-detection or rotate/unrotate round trip is
// needed — but the tilt angle is still computed and reported, mirroring the alignment
// step conceptually.

import * as faceapi from 'face-api.js'

let modelsLoaded = false

export async function loadModels() {
  if (modelsLoaded) return
  const MODEL_URL = '/models'
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
  ])
  modelsLoaded = true
}

export interface EyeRegion {
  x: number
  y: number
  w: number
  h: number
}

export interface DetectedFace {
  box: { x: number; y: number; width: number; height: number }
  leftEye: EyeRegion
  rightEye: EyeRegion
  tiltDegrees: number
}

function boxFromPoints(points: faceapi.Point[], padFrac = 0.45): EyeRegion {
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const w = maxX - minX
  const h = maxY - minY
  const padX = w * padFrac
  const padY = h * padFrac + h * 0.3 // extra vertical pad covers brow/lash
  return { x: minX - padX, y: minY - padY, w: w + padX * 2, h: h + padY * 2 }
}

function center(points: faceapi.Point[]) {
  const x = points.reduce((s, p) => s + p.x, 0) / points.length
  const y = points.reduce((s, p) => s + p.y, 0) / points.length
  return { x, y }
}

export async function detectFaces(image: HTMLImageElement): Promise<DetectedFace[]> {
  const detections = await faceapi
    .detectAllFaces(image, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.4 }))
    .withFaceLandmarks(true)

  return detections.map((d) => {
    const leftEyePts = d.landmarks.getLeftEye()
    const rightEyePts = d.landmarks.getRightEye()
    const lc = center(leftEyePts)
    const rc = center(rightEyePts)
    const angle = (Math.atan2(rc.y - lc.y, rc.x - lc.x) * 180) / Math.PI
    return {
      box: { x: d.detection.box.x, y: d.detection.box.y, width: d.detection.box.width, height: d.detection.box.height },
      leftEye: boxFromPoints(leftEyePts),
      rightEye: boxFromPoints(rightEyePts),
      tiltDegrees: angle,
    }
  })
}

/** Blurs a padded rectangular region of `source` and paints it onto `ctx` at the same location. */
export function blurRegion(ctx: CanvasRenderingContext2D, source: CanvasImageSource, imgW: number, imgH: number, region: EyeRegion, radius: number) {
  const x = Math.max(0, region.x)
  const y = Math.max(0, region.y)
  const w = Math.min(imgW - x, region.w)
  const h = Math.min(imgH - y, region.h)
  if (w <= 0 || h <= 0) return

  const pad = radius * 2
  const sx = Math.max(0, x - pad)
  const sy = Math.max(0, y - pad)
  const sw = Math.min(imgW - sx, w + pad * 2)
  const sh = Math.min(imgH - sy, h + pad * 2)

  const temp = document.createElement('canvas')
  temp.width = sw
  temp.height = sh
  const tctx = temp.getContext('2d')!
  tctx.filter = `blur(${radius}px)`
  tctx.drawImage(source, sx, sy, sw, sh, 0, 0, sw, sh)

  ctx.drawImage(temp, x - sx, y - sy, w, h, x, y, w, h)
}
