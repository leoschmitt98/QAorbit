import { type MouseEvent, useEffect, useMemo, useRef, useState } from 'react'
import { decompressFrames, parseGIF } from 'gifuct-js'
import {
  ArrowDown,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Circle,
  Download,
  Expand,
  Minimize2,
  MousePointerClick,
  Pause,
  Play,
  Scissors,
  Trash2,
  Type,
  Upload,
} from 'lucide-react'
import { deleteBugFrame, saveBugFrame, updateBugFrameMetadata } from '@/services/bug-frame-storage-api'
import type { BugEvidenceDraft, FrameAnnotationType, RetestFrame } from '@/types/domain'
import { Card } from '@/components/ui/card'
import { cn } from '@/utils/cn'

interface BugEvidenceCaptureProps {
  ticketId: string
  bugId: string
  value: BugEvidenceDraft
  onChange: (value: BugEvidenceDraft) => void
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

const annotationTools: Array<{ type: FrameAnnotationType; label: string; icon: typeof Circle }> = [
  { type: 'circle', label: 'Circulo', icon: Circle },
  { type: 'arrow', label: 'Seta', icon: ArrowRight },
  { type: 'text', label: 'Texto', icon: Type },
  { type: 'click', label: 'Clique', icon: MousePointerClick },
]

function getFrameSource(frame: Pick<RetestFrame, 'downloadUrl' | 'imageUrl'>) {
  return frame.downloadUrl || frame.imageUrl || ''
}

export function BugEvidenceCapture({ ticketId, bugId, value, onChange }: BugEvidenceCaptureProps) {
  const [selectedFrameId, setSelectedFrameId] = useState<string>(value.frames[0]?.id ?? '')
  const [activeTool, setActiveTool] = useState<FrameAnnotationType>('circle')
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentPlayerFrameIndex, setCurrentPlayerFrameIndex] = useState(0)
  const [playerFrames, setPlayerFrames] = useState<PlayerFrame[]>([])
  const [isExpanded, setIsExpanded] = useState(false)
  const [isPersistingFrame, setIsPersistingFrame] = useState(false)
  const [playerMessage, setPlayerMessage] = useState<string>(
    value.gifName
      ? 'GIF do bug carregado. Reproduza, pause e capture os quadros que melhor demonstram o problema.'
      : 'Suba um GIF do bug para montar a evidência visual específica deste relato.',
  )
  const playTimerRef = useRef<number | null>(null)

  const selectedFrame = useMemo(
    () => value.frames.find((frame) => frame.id === selectedFrameId) ?? value.frames[0] ?? null,
    [selectedFrameId, value.frames],
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
    if (!isExpanded) return

    function handleKeydown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsExpanded(false)
      }
    }

    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [isExpanded])

  useEffect(() => {
    return () => {
      if (value.gifPreviewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(value.gifPreviewUrl)
      }
    }
  }, [value.gifPreviewUrl])

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
      throw new Error('Nao foi possivel iniciar o player de GIF.')
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
        id: `bug-player-frame-${Date.now()}-${index + 1}`,
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
    if (value.gifPreviewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(value.gifPreviewUrl)
    }
    const nextPlayerFrames = await buildPlayerFrames(file)
    setPlayerFrames(nextPlayerFrames)
    setCurrentPlayerFrameIndex(0)
    setIsPlaying(false)
    setPlayerMessage(
      `${nextPlayerFrames.length} quadros do GIF do bug carregados. Pause nos momentos relevantes e capture os quadros do problema.`,
    )

    onChange({
      ...value,
      gifName: file.name,
      gifPreviewUrl: previewUrl,
    })
  }

  async function extractCurrentFrame() {
    if (!currentPlayerFrame) return

    if (!ticketId.trim() || !bugId.trim()) {
      setPlayerMessage('Defina o ticket e o ID do bug antes de capturar quadros para a evidência do bug.')
      return
    }

    setIsPersistingFrame(true)
    try {
      const timestampLabel = formatTimestamp(currentPlayerFrame.timestampMs)
      const storedFrame = await saveBugFrame({
        ticketId,
        bugId,
        imageDataUrl: currentPlayerFrame.dataUrl,
        timestampLabel,
      })

      const nextFrame: RetestFrame = {
        id: storedFrame.id,
        name: `Quadro ${value.frames.length + 1}`,
        imageUrl: currentPlayerFrame.dataUrl,
        downloadUrl: storedFrame.downloadUrl,
        fileName: storedFrame.fileName,
        persistedAt: storedFrame.persistedAt,
        timestampLabel,
        description: '',
        annotations: [],
        editHistory: [
          'Quadro capturado manualmente no workspace de bug',
          `Capturado no timestamp ${timestampLabel}`,
          `Persistido em disco como ${storedFrame.fileName}`,
        ],
      }

      onChange({
        ...value,
        frames: [...value.frames, nextFrame],
      })
      setSelectedFrameId(nextFrame.id)
      setPlayerMessage(`Quadro ${value.frames.length + 1} salvo para o bug ${bugId}.`)
    } catch (error) {
      setPlayerMessage(error instanceof Error ? error.message : 'Nao foi possivel salvar o quadro do bug agora.')
    } finally {
      setIsPersistingFrame(false)
    }
  }

  async function deleteCapturedFrame(frameId: string) {
    const frameToDelete = value.frames.find((frame) => frame.id === frameId)
    if (!frameToDelete?.fileName) return

    try {
      await deleteBugFrame(ticketId, bugId, frameToDelete.fileName)
      const nextFrames = value.frames.filter((frame) => frame.id !== frameId)
      onChange({ ...value, frames: nextFrames })
      if (selectedFrameId === frameId) {
        setSelectedFrameId(nextFrames[0]?.id ?? '')
      }
      setPlayerMessage(`Quadro removido da galeria do bug ${bugId}.`)
    } catch (error) {
      setPlayerMessage(error instanceof Error ? error.message : 'Nao foi possivel remover o quadro do bug.')
    }
  }

  function updateFrame(frameId: string, updater: (frame: RetestFrame) => RetestFrame) {
    onChange({
      ...value,
      frames: value.frames.map((frame) => (frame.id === frameId ? updater(frame) : frame)),
    })
  }

  async function persistFrameMetadata(frame: RetestFrame, description: string) {
    if (!frame.fileName) return
    try {
      await updateBugFrameMetadata(ticketId, bugId, frame.fileName, {
        description,
        timestampLabel: frame.timestampLabel,
      })
    } catch (error) {
      setPlayerMessage(error instanceof Error ? error.message : 'Nao foi possivel atualizar a descricao do quadro do bug.')
    }
  }

  function handleFrameCanvasClick(event: MouseEvent<HTMLDivElement>) {
    if (!selectedFrame) return
    const bounds = event.currentTarget.getBoundingClientRect()
    const x = ((event.clientX - bounds.left) / bounds.width) * 100
    const y = ((event.clientY - bounds.top) / bounds.height) * 100
    updateFrame(selectedFrame.id, (frame) => ({
      ...frame,
      annotations: [
        ...frame.annotations,
        {
          id: `bug-annotation-${Date.now()}`,
          type: activeTool,
          x,
          y,
          text: activeTool === 'text' ? 'Texto' : undefined,
        },
      ],
      editHistory: [...frame.editHistory, `${labelForTool(activeTool)} adicionado em ${Math.round(x)}%, ${Math.round(y)}%`],
    }))
  }

  function seekToFrameIndex(nextIndex: number) {
    if (playerFrames.length === 0) return
    setIsPlaying(false)
    setCurrentPlayerFrameIndex(Math.min(Math.max(nextIndex, 0), playerFrames.length - 1))
  }

  function seekByMs(offsetMs: number) {
    if (playerFrames.length === 0) return
    const currentTimestamp = currentPlayerFrame?.timestampMs ?? 0
    const targetTimestamp = Math.min(Math.max(currentTimestamp + offsetMs, 0), totalDurationMs)
    const closestFrameIndex = playerFrames.findIndex((frame, index) => {
      const nextTimestamp = playerFrames[index + 1]?.timestampMs ?? Number.POSITIVE_INFINITY
      return frame.timestampMs <= targetTimestamp && nextTimestamp > targetTimestamp
    })
    seekToFrameIndex(closestFrameIndex === -1 ? playerFrames.length - 1 : closestFrameIndex)
  }

  function renderAnnotation(annotation: RetestFrame['annotations'][number]) {
    const style = { left: `${annotation.x}%`, top: `${annotation.y}%` }
    if (annotation.type === 'circle') {
      return <div className="absolute h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-accent shadow-glow" style={style} />
    }
    if (annotation.type === 'arrow') {
      return <ArrowDown className="absolute h-7 w-7 -translate-x-1/2 -translate-y-1/2 text-accent drop-shadow-[0_0_10px_rgba(163,255,18,0.35)]" style={style} />
    }
    if (annotation.type === 'click') {
      return (
        <div className="absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent shadow-glow" style={style}>
          <div className="absolute inset-[-6px] rounded-full border border-accent/70" />
        </div>
      )
    }
    return (
      <div className="absolute -translate-x-1/2 -translate-y-1/2 rounded-xl border border-accent/35 bg-background/90 px-3 py-1 text-xs font-semibold text-foreground shadow-glow" style={style}>
        {annotation.text}
      </div>
    )
  }

  function renderPlayerViewer(mode: 'default' | 'expanded') {
    const isModal = mode === 'expanded'
    const mediaKey = currentPlayerFrame
      ? `frame-${currentPlayerFrame.id}`
      : value.gifPreviewUrl
        ? `preview-${value.gifName || 'gif'}`
        : 'empty-player'

    return (
      <div className={cn('space-y-4 rounded-[28px] border border-border bg-black/20', isModal ? 'w-full max-w-6xl p-6 shadow-[0_0_60px_rgba(0,0,0,0.45)]' : 'p-5')}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm text-muted">{isModal ? 'Modo de inspecao expandido' : 'Player do bug'}</p>
            <h5 className={cn('font-display font-bold text-foreground', isModal ? 'text-2xl' : 'text-lg')}>
              {isModal ? 'Inspecao visual do bug' : 'GIF para reproducao do bug'}
            </h5>
            <p className="text-sm text-muted">
              {isModal
                ? 'Inspecione o fluxo com mais clareza e capture os quadros que melhor demonstram o bug.'
                : 'Suba o GIF, pause no ponto certo e extraia os quadros mais relevantes do problema.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsExpanded((current) => !current)}
            disabled={playerFrames.length === 0}
            className="inline-flex h-11 items-center justify-center rounded-2xl border border-accent/35 bg-accent/12 px-4 text-sm font-semibold text-foreground shadow-glow disabled:opacity-40"
          >
            {isModal ? <Minimize2 className="mr-2 h-4 w-4" /> : <Expand className="mr-2 h-4 w-4" />}
            {isModal ? 'Fechar expansao' : 'Expandir'}
          </button>
        </div>

        <div className={cn('overflow-hidden rounded-[28px] border border-border bg-[radial-gradient(circle_at_top,rgba(163,255,18,0.08),transparent_55%),rgba(0,0,0,0.45)]', isModal ? 'min-h-[70vh]' : 'min-h-[24rem]')}>
          <div key={mediaKey}>
            {currentPlayerFrame ? (
              <img src={currentPlayerFrame.dataUrl} alt="Quadro atual do GIF do bug" className={cn('w-full object-contain', isModal ? 'h-[70vh]' : 'h-[26rem] xl:h-[32rem]')} />
            ) : value.gifPreviewUrl ? (
              <img src={value.gifPreviewUrl} alt="Preview do GIF do bug" className={cn('w-full object-contain', isModal ? 'h-[70vh]' : 'h-[26rem] xl:h-[32rem]')} />
            ) : (
              <div className={cn('flex items-center justify-center px-6 text-center text-sm text-muted', isModal ? 'h-[70vh]' : 'h-[26rem] xl:h-[32rem]')}>
                O player do bug aparecera aqui apos o upload do GIF.
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-white/[0.03] px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setIsPlaying((current) => !current)} disabled={playerFrames.length === 0} className="inline-flex h-11 items-center justify-center rounded-2xl border border-accent/35 bg-accent/12 px-4 text-sm font-semibold text-foreground shadow-glow disabled:opacity-40">
              {isPlaying ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
              {isPlaying ? 'Pause' : 'Play'}
            </button>
            <button type="button" onClick={() => seekByMs(-5000)} disabled={playerFrames.length === 0} className="inline-flex h-11 items-center justify-center rounded-2xl border border-border bg-white/[0.03] px-4 text-sm font-semibold text-foreground transition hover:border-accent/25 disabled:opacity-40">
              <ChevronLeft className="mr-1 h-4 w-4" /> 5s
            </button>
            <button type="button" onClick={() => seekByMs(-1000)} disabled={playerFrames.length === 0} className="inline-flex h-11 items-center justify-center rounded-2xl border border-border bg-white/[0.03] px-4 text-sm font-semibold text-foreground transition hover:border-accent/25 disabled:opacity-40">
              <ChevronLeft className="mr-1 h-4 w-4" /> 1s
            </button>
            <button type="button" onClick={() => seekByMs(1000)} disabled={playerFrames.length === 0} className="inline-flex h-11 items-center justify-center rounded-2xl border border-border bg-white/[0.03] px-4 text-sm font-semibold text-foreground transition hover:border-accent/25 disabled:opacity-40">
              1s <ChevronRight className="ml-1 h-4 w-4" />
            </button>
            <button type="button" onClick={() => seekByMs(5000)} disabled={playerFrames.length === 0} className="inline-flex h-11 items-center justify-center rounded-2xl border border-border bg-white/[0.03] px-4 text-sm font-semibold text-foreground transition hover:border-accent/25 disabled:opacity-40">
              5s <ChevronRight className="ml-1 h-4 w-4" />
            </button>
            <button type="button" onClick={() => void extractCurrentFrame()} disabled={playerFrames.length === 0 || isPersistingFrame} className="inline-flex h-11 items-center justify-center rounded-2xl border border-accent/35 bg-accent/12 px-4 text-sm font-semibold text-foreground shadow-glow disabled:opacity-40">
              <Scissors className="mr-2 h-4 w-4" />
              {isPersistingFrame ? 'Salvando quadro...' : 'Extrair quadro atual'}
            </button>
          </div>
          <div className="rounded-2xl border border-border bg-black/20 px-4 py-2 text-sm font-medium text-muted">
            {formatTimestamp(currentPlayerFrame?.timestampMs ?? 0)} / {formatTimestamp(totalDurationMs)}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-muted/70">
            <span>Timeline de inspecao</span>
            <span>{playerFrames.length > 0 ? `${currentPlayerFrameIndex + 1}/${playerFrames.length} quadros` : 'Aguardando GIF'}</span>
          </div>
          <input
            type="range"
            min={0}
            max={Math.max(playerFrames.length - 1, 0)}
            step={1}
            value={currentPlayerFrameIndex}
            onChange={(event) => seekToFrameIndex(Number(event.target.value))}
            className="h-3 w-full cursor-pointer appearance-none rounded-full bg-border accent-[#a3ff12]"
            disabled={playerFrames.length === 0}
          />
        </div>
      </div>
    )
  }

  return (
    <>
      <Card className="space-y-6">
        <div>
          <p className="text-sm text-muted">Evidência visual do bug</p>
          <h3 className="font-display text-xl font-bold text-foreground">GIF e quadros do problema</h3>
          <p className="mt-2 text-sm text-muted">{playerMessage}</p>
        </div>

        <label className="rounded-3xl border border-dashed border-accent/25 bg-accent/6 p-5">
          <input type="file" accept="image/gif" className="hidden" onChange={(event) => void handleGifUpload(event.target.files?.[0])} />
          <div className="flex cursor-pointer items-center gap-3 text-foreground">
            <div className="rounded-2xl border border-accent/25 bg-accent/12 p-3">
              <Upload className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="font-semibold">{value.gifName || 'Selecionar GIF do bug'}</p>
              <p className="text-sm text-muted">Suba o GIF do problema, pause no ponto correto e capture os quadros da evidência do bug.</p>
            </div>
          </div>
        </label>

        {renderPlayerViewer('default')}

        <section className="grid gap-6 xl:grid-cols-[0.9fr,1.1fr]">
          <div className="space-y-4 rounded-3xl border border-border bg-black/10 p-5">
            <div className="space-y-2">
              <p className="text-sm text-muted">Galeria do bug</p>
              <h4 className="font-display text-xl font-bold text-foreground">Quadros capturados do problema</h4>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
              {value.frames.map((frame, index) => (
                <div
                  key={frame.id}
                  className={cn(
                    'overflow-hidden rounded-2xl border bg-white/[0.03] transition',
                    selectedFrame?.id === frame.id ? 'border-accent/40 shadow-glow' : 'border-border hover:border-accent/25',
                  )}
                >
                  <button type="button" onClick={() => setSelectedFrameId(frame.id)} className="block w-full text-left">
                    <img src={getFrameSource(frame)} alt={frame.name} className="h-32 w-full object-cover" />
                    <div className="space-y-1 px-4 py-3">
                      <p className="font-semibold text-foreground">Quadro {index + 1}</p>
                      {frame.description?.trim() ? <p className="line-clamp-2 text-sm leading-6 text-muted">{frame.description}</p> : null}
                    </div>
                  </button>
                  <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm">
                    <div className="flex items-center gap-3">
                      <button type="button" onClick={() => setSelectedFrameId(frame.id)} className="font-semibold text-accent">
                        Editar
                      </button>
                      <a href={frame.downloadUrl ?? frame.imageUrl} download={frame.fileName ?? `${frame.name.toLowerCase().replace(/\s+/g, '-')}.png`} className="inline-flex items-center gap-2 text-muted hover:text-foreground">
                        <Download className="h-4 w-4" />
                        Baixar
                      </a>
                    </div>
                    <button type="button" onClick={() => void deleteCapturedFrame(frame.id)} className="inline-flex items-center gap-2 text-muted hover:text-foreground">
                      <Trash2 className="h-4 w-4" />
                      Excluir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4 rounded-3xl border border-border bg-black/10 p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-muted">Editor de quadro</p>
                <h4 className="font-display text-xl font-bold text-foreground">Anotacao visual do bug</h4>
              </div>
              <div className="flex flex-wrap gap-2">
                {annotationTools.map(({ type, label, icon: Icon }) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setActiveTool(type)}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm transition',
                      activeTool === type ? 'border-accent/35 bg-accent/12 text-foreground shadow-glow' : 'border-border bg-white/[0.02] text-muted hover:border-accent/20',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative min-h-[340px] overflow-hidden rounded-3xl border border-border bg-black/30" onClick={handleFrameCanvasClick}>
              {selectedFrame ? (
                <>
                  <img src={getFrameSource(selectedFrame)} alt={selectedFrame.name} className="h-[340px] w-full object-contain" />
                  {selectedFrame.annotations.map((annotation) => (
                    <div key={annotation.id}>{renderAnnotation(annotation)}</div>
                  ))}
                </>
              ) : (
                <div className="flex h-[340px] items-center justify-center text-sm text-muted">Selecione um quadro do bug para editar.</div>
              )}
            </div>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-foreground">Descricao do quadro (opcional)</span>
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
                className="min-h-[96px] w-full rounded-2xl border border-border bg-black/20 p-4 text-sm text-foreground outline-none placeholder:text-muted/55 focus:border-accent/40"
                placeholder="Adicione um contexto curto para este quadro do bug quando isso ajudar a explicar o problema."
              />
            </label>
          </div>
        </section>
      </Card>

      {isExpanded ? (
        <div className="fixed inset-0 z-50 bg-black/80 px-4 py-6 backdrop-blur-md">
          <div className="flex h-full items-center justify-center" onClick={() => setIsExpanded(false)}>
            <div onClick={(event) => event.stopPropagation()}>{renderPlayerViewer('expanded')}</div>
          </div>
        </div>
      ) : null}
    </>
  )
}

function labelForTool(tool: FrameAnnotationType) {
  switch (tool) {
    case 'circle':
      return 'Circulo'
    case 'arrow':
      return 'Seta'
    case 'text':
      return 'Texto'
    case 'click':
      return 'Marcador de clique'
  }
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
