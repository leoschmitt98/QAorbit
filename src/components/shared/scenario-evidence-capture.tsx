import { useEffect, useMemo, useRef, useState } from 'react'
import { decompressFrames, parseGIF } from 'gifuct-js'
import { ChevronLeft, ChevronRight, Download, Pause, Play, Scissors, Trash2, Upload } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/utils/cn'
import { deleteScenarioFrame, saveScenarioFrame, updateScenarioFrameMetadata } from '@/services/scenario-frame-storage-api'
import type { ComplementaryScenario, RetestFrame } from '@/types/domain'

interface ScenarioEvidenceCaptureProps {
  ticketId: string
  scenario: ComplementaryScenario
  onChange: (nextScenario: ComplementaryScenario) => void
}

interface GifPatchFrame {
  delay?: number
  disposalType?: number
  dims: {
    top: number
    left: number
    width: number
    height: number
  }
  patch: Uint8ClampedArray
}

interface PlayerFrame {
  id: string
  dataUrl: string
  timestampMs: number
  delayMs: number
}

interface PreviousFrameState {
  disposalType?: number
  dims: GifPatchFrame['dims']
  restoreSnapshot: ImageData | null
}

function getFrameSource(frame: Pick<RetestFrame, 'downloadUrl' | 'imageUrl'>) {
  if (frame.imageUrl?.startsWith('data:')) {
    return frame.imageUrl
  }

  return frame.downloadUrl || frame.imageUrl || ''
}

function FrameImage({
  frame,
  alt,
  className,
}: {
  frame: Pick<RetestFrame, 'downloadUrl' | 'imageUrl'>
  alt: string
  className: string
}) {
  const primarySource = getFrameSource(frame)
  const fallbackSource =
    frame.imageUrl && frame.imageUrl !== primarySource ? frame.imageUrl : frame.downloadUrl && frame.downloadUrl !== primarySource ? frame.downloadUrl : ''
  const [src, setSrc] = useState(primarySource)

  useEffect(() => {
    setSrc(primarySource)
  }, [primarySource])

  if (!src && !fallbackSource) {
    return <div className={cn(className, 'flex items-center justify-center bg-black/20 text-xs text-muted')}>Imagem indisponivel</div>
  }

  return (
    <img
      src={src || fallbackSource}
      alt={alt}
      className={className}
      onError={() => {
        if (fallbackSource && src !== fallbackSource) {
          setSrc(fallbackSource)
          return
        }

        setSrc('')
      }}
    />
  )
}

export function ScenarioEvidenceCapture({ ticketId, scenario, onChange }: ScenarioEvidenceCaptureProps) {
  const [selectedFrameId, setSelectedFrameId] = useState<string>(scenario.frames?.[0]?.id ?? '')
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentPlayerFrameIndex, setCurrentPlayerFrameIndex] = useState(0)
  const [playerFrames, setPlayerFrames] = useState<PlayerFrame[]>([])
  const [isPersistingFrame, setIsPersistingFrame] = useState(false)
  const [message, setMessage] = useState(
    scenario.gifName
      ? 'GIF auxiliar carregado. Capture os quadros que melhor explicam o cenário complementar.'
      : 'Se este cenário paralelo precisar de narrativa visual, suba um GIF e capture os quadros relevantes.',
  )
  const playTimerRef = useRef<number | null>(null)

  const frames = scenario.frames ?? []
  const selectedFrame = useMemo(
    () => frames.find((frame) => frame.id === selectedFrameId) ?? frames[0] ?? null,
    [frames, selectedFrameId],
  )
  const currentPlayerFrame = playerFrames[currentPlayerFrameIndex] ?? null
  const totalDurationMs =
    playerFrames.length > 0
      ? playerFrames[playerFrames.length - 1].timestampMs + playerFrames[playerFrames.length - 1].delayMs
      : 0

  useEffect(() => {
    if (!isPlaying || playerFrames.length === 0) return

    const currentDelay = playerFrames[currentPlayerFrameIndex]?.delayMs ?? 100
    playTimerRef.current = window.setTimeout(() => {
      setCurrentPlayerFrameIndex((previous) => (previous + 1) % playerFrames.length)
    }, currentDelay)

    return () => {
      if (playTimerRef.current) {
        window.clearTimeout(playTimerRef.current)
      }
    }
  }, [currentPlayerFrameIndex, isPlaying, playerFrames])

  useEffect(() => {
    return () => {
      if (scenario.gifPreviewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(scenario.gifPreviewUrl)
      }
    }
  }, [scenario.gifPreviewUrl])

  async function buildPlayerFrames(file: File) {
    const arrayBuffer = await file.arrayBuffer()
    const gif = parseGIF(arrayBuffer)
    const patchFrames = decompressFrames(gif, true) as GifPatchFrame[]
    const width = Number((gif as { lsd?: { width?: number } }).lsd?.width ?? patchFrames[0]?.dims.width ?? 1)
    const height = Number((gif as { lsd?: { height?: number } }).lsd?.height ?? patchFrames[0]?.dims.height ?? 1)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    const patchCanvas = document.createElement('canvas')
    const patchCtx = patchCanvas.getContext('2d')

    if (!ctx || !patchCtx) {
      throw new Error('Nao foi possivel iniciar o player de GIF do cenário auxiliar.')
    }

    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)

    let previousFrameState: PreviousFrameState | null = null
    let elapsedMs = 0

    return patchFrames.map((frame, index) => {
      if (previousFrameState?.disposalType === 2) {
        ctx.clearRect(
          previousFrameState.dims.left,
          previousFrameState.dims.top,
          previousFrameState.dims.width,
          previousFrameState.dims.height,
        )
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(
          previousFrameState.dims.left,
          previousFrameState.dims.top,
          previousFrameState.dims.width,
          previousFrameState.dims.height,
        )
      }

      if (previousFrameState?.disposalType === 3 && previousFrameState.restoreSnapshot) {
        ctx.putImageData(previousFrameState.restoreSnapshot, 0, 0)
      }

      const restoreSnapshot = frame.disposalType === 3 ? ctx.getImageData(0, 0, width, height) : null
      const imageData = new ImageData(new Uint8ClampedArray(frame.patch), frame.dims.width, frame.dims.height)
      patchCanvas.width = frame.dims.width
      patchCanvas.height = frame.dims.height
      patchCtx.clearRect(0, 0, frame.dims.width, frame.dims.height)
      patchCtx.putImageData(imageData, 0, 0)
      ctx.drawImage(patchCanvas, frame.dims.left, frame.dims.top)

      const delayMs = normalizeGifDelay(frame.delay)
      const renderedFrame = {
        id: `scenario-player-frame-${Date.now()}-${index + 1}`,
        dataUrl: canvas.toDataURL('image/png'),
        timestampMs: elapsedMs,
        delayMs,
      }

      elapsedMs += delayMs
      previousFrameState = { disposalType: frame.disposalType, dims: frame.dims, restoreSnapshot }

      return renderedFrame
    })
  }

  async function handleGifUpload(file?: File) {
    if (!file) return

    const previewUrl = URL.createObjectURL(file)
    if (scenario.gifPreviewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(scenario.gifPreviewUrl)
    }

    const nextPlayerFrames = await buildPlayerFrames(file)
    setPlayerFrames(nextPlayerFrames)
    setCurrentPlayerFrameIndex(0)
    setIsPlaying(false)
    setMessage(`${nextPlayerFrames.length} quadros do cenário auxiliar carregados. Capture os momentos importantes.`)

    onChange({
      ...scenario,
      gifName: file.name,
      gifPreviewUrl: previewUrl,
    })
  }

  async function extractCurrentFrame() {
    if (!currentPlayerFrame) return
    if (!ticketId.trim()) {
      setMessage('Defina o ticket antes de capturar quadros do cenário auxiliar.')
      return
    }

    setIsPersistingFrame(true)
    try {
      const timestampLabel = formatTimestamp(currentPlayerFrame.timestampMs)
      const storedFrame = await saveScenarioFrame({
        ticketId,
        scenarioId: scenario.id,
        imageDataUrl: currentPlayerFrame.dataUrl,
        timestampLabel,
      })

      const nextFrame: RetestFrame = {
        id: storedFrame.id,
        name: `Quadro ${frames.length + 1}`,
        imageUrl: currentPlayerFrame.dataUrl,
        downloadUrl: storedFrame.downloadUrl,
        fileName: storedFrame.fileName,
        persistedAt: storedFrame.persistedAt,
        timestampLabel,
        description: '',
        annotations: [],
        editHistory: [
          'Quadro capturado manualmente para cenário auxiliar',
          `Capturado no timestamp ${timestampLabel}`,
          `Persistido em disco como ${storedFrame.fileName}`,
        ],
      }

      const nextFrames = [...frames, nextFrame]
      onChange({
        ...scenario,
        frames: nextFrames,
      })
      setSelectedFrameId(nextFrame.id)
      setMessage(`Quadro ${nextFrames.length} adicionado ao cenário auxiliar.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nao foi possivel salvar o quadro do cenário auxiliar.')
    } finally {
      setIsPersistingFrame(false)
    }
  }

  async function deleteCapturedFrame(frameId: string) {
    const frameToDelete = frames.find((frame) => frame.id === frameId)
    if (!frameToDelete?.fileName) return

    try {
      await deleteScenarioFrame(ticketId, scenario.id, frameToDelete.fileName)
      const nextFrames = frames.filter((frame) => frame.id !== frameId)
      onChange({
        ...scenario,
        frames: nextFrames,
      })
      if (selectedFrameId === frameId) {
        setSelectedFrameId(nextFrames[0]?.id ?? '')
      }
      setMessage('Quadro removido do cenário auxiliar.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nao foi possivel remover o quadro do cenário auxiliar.')
    }
  }

  async function persistFrameMetadata(frame: RetestFrame, description: string) {
    if (!frame.fileName) return

    try {
      await updateScenarioFrameMetadata(ticketId, scenario.id, frame.fileName, {
        description,
        timestampLabel: frame.timestampLabel,
      })
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nao foi possivel atualizar a descrição do quadro.')
    }
  }

  function updateFrame(frameId: string, updater: (frame: RetestFrame) => RetestFrame) {
    onChange({
      ...scenario,
      frames: frames.map((frame) => (frame.id === frameId ? updater(frame) : frame)),
    })
  }

  function seekByMs(offsetMs: number) {
    if (playerFrames.length === 0) return
    const currentTimestamp = currentPlayerFrame?.timestampMs ?? 0
    const targetTimestamp = Math.min(Math.max(currentTimestamp + offsetMs, 0), totalDurationMs)

    const closestFrameIndex = playerFrames.findIndex((frame, index) => {
      const nextTimestamp = playerFrames[index + 1]?.timestampMs ?? Number.POSITIVE_INFINITY
      return frame.timestampMs <= targetTimestamp && nextTimestamp > targetTimestamp
    })

    setIsPlaying(false)
    setCurrentPlayerFrameIndex(closestFrameIndex === -1 ? playerFrames.length - 1 : closestFrameIndex)
  }

  return (
    <Card className="space-y-4 border border-accent/15 bg-accent/5">
      <div>
        <p className="text-sm text-muted">Evidência auxiliar do cenário</p>
        <h5 className="font-display text-lg font-bold text-foreground">GIF e quadros do cenário paralelo</h5>
        <p className="mt-2 text-sm text-muted">{message}</p>
      </div>

      <label className="rounded-3xl border border-dashed border-accent/25 bg-black/10 p-4">
        <input type="file" accept="image/gif" className="hidden" onChange={(event) => void handleGifUpload(event.target.files?.[0])} />
        <div className="flex cursor-pointer items-center gap-3 text-foreground">
          <div className="rounded-2xl border border-accent/25 bg-accent/12 p-3">
            <Upload className="h-5 w-5 text-accent" />
          </div>
          <div>
            <p className="font-semibold">{scenario.gifName || 'Selecionar GIF do cenário auxiliar'}</p>
            <p className="text-sm text-muted">Suba um GIF se quiser documentar o passo a passo desse cenário adicional.</p>
          </div>
        </div>
      </label>

      <div className="overflow-hidden rounded-[28px] border border-border bg-[radial-gradient(circle_at_top,rgba(163,255,18,0.08),transparent_55%),rgba(0,0,0,0.45)]">
        {currentPlayerFrame ? (
          <img src={currentPlayerFrame.dataUrl} alt="Quadro atual do cenário" className="h-[20rem] w-full object-contain" />
        ) : scenario.gifPreviewUrl ? (
          <img src={scenario.gifPreviewUrl} alt="Preview do GIF do cenário" className="h-[20rem] w-full object-contain" />
        ) : (
          <div className="flex h-[20rem] items-center justify-center px-6 text-center text-sm text-muted">
            O player do cenário auxiliar aparecerá aqui após o upload do GIF.
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-white/[0.03] px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsPlaying((current) => !current)}
            disabled={playerFrames.length === 0}
            className="inline-flex h-11 items-center justify-center rounded-2xl border border-accent/35 bg-accent/12 px-4 text-sm font-semibold text-foreground shadow-glow disabled:opacity-40"
          >
            {isPlaying ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
            {isPlaying ? 'Pause' : 'Play'}
          </button>
          <button
            type="button"
            onClick={() => seekByMs(-1000)}
            disabled={playerFrames.length === 0}
            className="inline-flex h-11 items-center justify-center rounded-2xl border border-border bg-white/[0.03] px-4 text-sm font-semibold text-foreground transition hover:border-accent/25 disabled:opacity-40"
          >
            <ChevronLeft className="mr-1 h-4 w-4" /> 1s
          </button>
          <button
            type="button"
            onClick={() => seekByMs(1000)}
            disabled={playerFrames.length === 0}
            className="inline-flex h-11 items-center justify-center rounded-2xl border border-border bg-white/[0.03] px-4 text-sm font-semibold text-foreground transition hover:border-accent/25 disabled:opacity-40"
          >
            1s <ChevronRight className="ml-1 h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => void extractCurrentFrame()}
            disabled={playerFrames.length === 0 || isPersistingFrame}
            className="inline-flex h-11 items-center justify-center rounded-2xl border border-accent/35 bg-accent/12 px-4 text-sm font-semibold text-foreground shadow-glow disabled:opacity-40"
          >
            <Scissors className="mr-2 h-4 w-4" />
            {isPersistingFrame ? 'Salvando quadro...' : 'Extrair quadro atual'}
          </button>
        </div>
        <div className="rounded-2xl border border-border bg-black/20 px-4 py-2 text-sm font-medium text-muted">
          {formatTimestamp(currentPlayerFrame?.timestampMs ?? 0)} / {formatTimestamp(totalDurationMs)}
        </div>
      </div>

      {frames.length > 0 ? (
        <div className="grid gap-4 xl:grid-cols-[0.8fr,1.2fr]">
          <div className="space-y-3">
            {frames.map((frame, index) => (
              <div
                key={frame.id}
                className={cn(
                  'overflow-hidden rounded-2xl border bg-white/[0.03] transition',
                  selectedFrame?.id === frame.id ? 'border-accent/40 shadow-glow' : 'border-border hover:border-accent/25',
                )}
              >
                <button type="button" onClick={() => setSelectedFrameId(frame.id)} className="block w-full text-left">
                  <FrameImage frame={frame} alt={frame.name} className="h-28 w-full object-cover" />
                  <div className="space-y-1 px-4 py-3">
                    <p className="font-semibold text-foreground">
                      Quadro {index + 1} - {frame.timestampLabel}
                    </p>
                    {frame.description?.trim() ? <p className="line-clamp-2 text-sm text-muted">{frame.description}</p> : null}
                  </div>
                </button>
                <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm">
                  <a
                    href={frame.downloadUrl ?? frame.imageUrl}
                    download={frame.fileName ?? `${frame.name.toLowerCase().replace(/\s+/g, '-')}.png`}
                    className="inline-flex items-center gap-2 text-muted hover:text-foreground"
                  >
                    <Download className="h-4 w-4" />
                    Baixar
                  </a>
                  <button type="button" onClick={() => void deleteCapturedFrame(frame.id)} className="inline-flex items-center gap-2 text-muted hover:text-foreground">
                    <Trash2 className="h-4 w-4" />
                    Excluir
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <div className="relative min-h-[320px] overflow-hidden rounded-3xl border border-border bg-black/30">
              {selectedFrame ? (
                <FrameImage frame={selectedFrame} alt={selectedFrame.name} className="h-[320px] w-full object-contain" />
              ) : (
                <div className="flex h-[320px] items-center justify-center text-sm text-muted">
                  Selecione um quadro do cenário auxiliar para revisar.
                </div>
              )}
            </div>
            <label className="space-y-2">
              <span className="text-sm font-semibold text-foreground">Descrição do quadro auxiliar</span>
              <textarea
                value={selectedFrame?.description ?? ''}
                onChange={(event) => {
                  if (!selectedFrame) return
                  updateFrame(selectedFrame.id, (frame) => ({ ...frame, description: event.target.value }))
                }}
                onBlur={(event) => {
                  if (!selectedFrame) return
                  void persistFrameMetadata(selectedFrame, event.target.value)
                }}
                className="min-h-[96px] w-full rounded-2xl border border-border bg-black/20 p-4 text-sm text-foreground outline-none focus:border-accent/40"
                placeholder="Explique rapidamente o que este quadro prova no cenário complementar."
              />
            </label>
          </div>
        </div>
      ) : null}
    </Card>
  )
}

function normalizeGifDelay(delay?: number) {
  if (!delay || delay <= 0) return 100
  return delay <= 10 ? delay * 10 : delay
}

function formatTimestamp(totalMs: number) {
  const seconds = Math.floor(totalMs / 1000)
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
}
