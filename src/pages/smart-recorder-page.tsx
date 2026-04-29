import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Clipboard, Copy, Download, Pause, Play, Plus, RefreshCw, Square, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { SectionHeader } from '@/components/ui/section-header'
import { useCatalogProjectsQuery } from '@/services/catalog-api'
import {
  createSmartRecorderSession,
  createSmartRecorderStep,
  deleteSmartRecorderStep,
  exportSmartRecorderJson,
  finalizeSmartRecorderSession,
  getSmartRecorderSession,
  pauseSmartRecorderSession,
  resumeSmartRecorderSession,
  updateSmartRecorderStep,
  type SmartRecorderExport,
  type SmartRecorderSession,
  type SmartRecorderStep,
} from '@/services/smart-recorder-api'

const actions = ['click', 'type', 'select', 'check', 'uncheck', 'submit', 'assertVisible', 'assertText'] as const

function normalizeText(value: unknown, limit = 120) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, limit)
}

function cssQuote(value: unknown) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

function cssAttr(name: string, value: string) {
  return `[${name}='${cssQuote(value)}']`
}

function parseContainsSelector(selector: string) {
  const match = normalizeText(selector, 1000).match(/^([a-z0-9_-]+):contains\((['"])(.*?)\2\)$/i)
  return match ? { tagName: match[1].toLowerCase(), text: normalizeText(match[3]) } : null
}

function isDynamicText(value: string) {
  return /carregando|entrando|salvando|aguarde|processando|enviando|loading|saving/i.test(value)
}

function isStableId(value: string) {
  if (!value || /^[0-9]+$/.test(value) || value.length > 80) return false
  return !/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}/i.test(value)
}

function isWeakCssSelector(selector: string) {
  const normalized = normalizeText(selector, 1000)
  if (!normalized) return true
  if (normalized.includes(':contains(')) return true
  if (/^\/\//.test(normalized) || normalized.startsWith('/html')) return true
  if (/:nth-child|:nth-of-type/i.test(normalized)) return true
  if ((normalized.match(/>/g) || []).length >= 3) return true
  if (/\.(btn|button|primary|active|disabled)\b/i.test(normalized)) return true
  return false
}

function variableNameFromValue(value: string) {
  const match = normalizeText(value, 200).match(/^\{\{([^{}]+)\}\}$/)
  return match ? match[1] : null
}

function suggestionSlug(step: Partial<SmartRecorderStep>) {
  return normalizeText(step.elementText || step.title || step.elementName || step.ariaLabel || step.action || 'elemento', 80)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'elemento'
}

function buildStepTarget(step: Partial<SmartRecorderStep>) {
  const tagName = normalizeText(step.tagName, 80).toLowerCase()
  const elementType = normalizeText(step.elementType, 80).toLowerCase()
  const selector = normalizeText(step.selectorRecommended, 1000)
  const fallbackSelector = normalizeText(step.selectorFallback, 1000) || (tagName === 'input' && elementType ? `input[type='${cssQuote(elementType)}']` : tagName || '*')
  const containsSelector = parseContainsSelector(selector)
  const elementText = normalizeText(step.elementText || containsSelector?.text)
  const improvementSuggestion = `Adicionar data-testid='${suggestionSlug(step)}'`

  if (step.dataTestId) return { strategy: 'css', selector: cssAttr('data-testid', step.dataTestId), text: null, recommendedCommand: 'get', fallbackSelector, selectorQuality: 'strong', warning: '', improvementSuggestion: '' }
  if (step.dataCy) return { strategy: 'css', selector: cssAttr('data-cy', step.dataCy), text: null, recommendedCommand: 'get', fallbackSelector, selectorQuality: 'strong', warning: '', improvementSuggestion: '' }
  if (step.dataTest) return { strategy: 'css', selector: cssAttr('data-test', step.dataTest), text: null, recommendedCommand: 'get', fallbackSelector, selectorQuality: 'strong', warning: '', improvementSuggestion: '' }
  if (isStableId(normalizeText(step.elementId, 250))) return { strategy: 'css', selector: `#${step.elementId}`, text: null, recommendedCommand: 'get', fallbackSelector, selectorQuality: 'strong', warning: '', improvementSuggestion: '' }
  if (step.elementName) return { strategy: 'css', selector: `${tagName || 'input'}[name='${cssQuote(step.elementName)}']`, text: null, recommendedCommand: 'get', fallbackSelector, selectorQuality: 'medium', warning: '', improvementSuggestion }
  if (step.ariaLabel && !isDynamicText(step.ariaLabel)) return { strategy: 'css', selector: cssAttr('aria-label', step.ariaLabel), text: null, recommendedCommand: 'get', fallbackSelector, selectorQuality: 'medium', warning: '', improvementSuggestion }
  if (['button', 'a'].includes(containsSelector?.tagName || tagName) && elementText && !isDynamicText(elementText)) {
    const selectorTag = containsSelector?.tagName || tagName
    return { strategy: 'text', selector: selectorTag, text: elementText, recommendedCommand: 'contains', fallbackSelector: selectorTag, selectorQuality: 'medium', warning: '', improvementSuggestion }
  }
  if (tagName === 'input' && ['password', 'email', 'text'].includes(elementType)) {
    return { strategy: 'css', selector: `input[type='${cssQuote(elementType)}']`, text: null, recommendedCommand: 'get', fallbackSelector, selectorQuality: 'medium', warning: '', improvementSuggestion }
  }

  const quality = isWeakCssSelector(selector || fallbackSelector) ? 'weak' : 'medium'
  return {
    strategy: 'css',
    selector: selector && !isWeakCssSelector(selector) ? selector : fallbackSelector,
    text: null,
    recommendedCommand: 'get',
    fallbackSelector,
    selectorQuality: quality,
    warning: quality === 'weak' ? 'Este seletor pode quebrar facilmente. Recomenda-se adicionar data-testid no sistema.' : '',
    improvementSuggestion,
  }
}

function emptyManualStep(): Partial<SmartRecorderStep> {
  return {
    action: 'click',
    title: '',
    currentUrl: '',
    selectorRecommended: '',
    selectorFallback: '',
    selectorReason: '',
    elementText: '',
    tagName: '',
    elementType: '',
    elementId: '',
    elementName: '',
    dataTestId: '',
    dataCy: '',
    dataTest: '',
    ariaLabel: '',
    roleName: '',
    classes: '',
    inputValue: '',
    valueMode: 'literal',
    htmlSnippet: '',
    expectedResult: '',
    notes: '',
  }
}

function buildSnippet(session: SmartRecorderSession | null) {
  if (!session?.id || !session.captureToken) return ''
  return `(function () {
  const sessionId = ${JSON.stringify(session.id)};
  const token = ${JSON.stringify(session.captureToken)};
  const endpoint = 'http://localhost:3001/api/smart-recorder/capture/' + encodeURIComponent(sessionId) + '/steps';
  const state = { paused: false, lastSubmitClickAt: 0, queue: Promise.resolve() };

  function shortText(value, limit) {
    return String(value || '').replace(/\\s+/g, ' ').trim().slice(0, limit || 160);
  }

  function safeUrl() {
    return window.location.origin + window.location.pathname;
  }

  function escapeCss(value) {
    if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(String(value || ''));
    return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '\\\\$&');
  }

  function cssPath(element) {
    if (!element || !element.tagName) return '';
    if (element.id) return '#' + escapeCss(element.id);
    const parts = [];
    let current = element;
    while (current && current.nodeType === 1 && parts.length < 3) {
      let part = current.tagName.toLowerCase();
      const type = current.getAttribute('type');
      if (part === 'input' && type) part += '[type="' + String(type).replace(/"/g, '') + '"]';
      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter((item) => item.tagName === current.tagName);
        if (siblings.length > 1) part += ':nth-of-type(' + (siblings.indexOf(current) + 1) + ')';
      }
      parts.unshift(part);
      current = parent;
    }
    return parts.join(' > ');
  }

  function selectorFor(element) {
    const tag = String(element.tagName || '').toLowerCase();
    const dataTestId = element.getAttribute('data-testid');
    if (dataTestId) return { selector: '[data-testid="' + dataTestId.replace(/"/g, '\\\\"') + '"]', reason: 'data-testid' };
    const dataCy = element.getAttribute('data-cy');
    if (dataCy) return { selector: '[data-cy="' + dataCy.replace(/"/g, '\\\\"') + '"]', reason: 'data-cy' };
    const dataTest = element.getAttribute('data-test');
    if (dataTest) return { selector: '[data-test="' + dataTest.replace(/"/g, '\\\\"') + '"]', reason: 'data-test' };
    if (element.id) return { selector: '#' + escapeCss(element.id), reason: 'id' };
    if (element.name) return { selector: tag + '[name="' + String(element.name).replace(/"/g, '\\\\"') + '"]', reason: 'name' };
    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel) return { selector: '[aria-label="' + ariaLabel.replace(/"/g, '\\\\"') + '"]', reason: 'aria-label' };
    const visibleText = shortText(element.innerText || element.textContent, 80);
    if ((tag === 'button' || tag === 'a') && visibleText) return { selector: tag + ':contains("' + visibleText.replace(/"/g, '\\\\"') + '")', reason: 'texto visivel' };
    return { selector: cssPath(element), reason: 'css curto' };
  }

  function actionFromEvent(event, element) {
    const tag = String(element.tagName || '').toLowerCase();
    const type = String(element.type || '').toLowerCase();
    if (event.type === 'submit') return 'submit';
    if (event.type === 'change' && tag === 'select') return 'select';
    if (event.type === 'change' && type === 'checkbox') return element.checked ? 'check' : 'uncheck';
    if (event.type === 'change' && type === 'radio') return 'check';
    if (event.type === 'input' || event.type === 'change') return 'type';
    return 'click';
  }

  function shouldIgnore(event, element) {
    const tag = String(element.tagName || '').toLowerCase();
    const type = String(element.type || '').toLowerCase();
    if (event.type === 'click' && ['input', 'textarea', 'select', 'option'].includes(tag)) return true;
    if (event.type === 'click' && tag === 'button' && type === 'submit') state.lastSubmitClickAt = Date.now();
    if (event.type === 'submit' && Date.now() - state.lastSubmitClickAt < 1200) return true;
    return false;
  }

  function variableForSensitiveField(element) {
    const meta = [
      element.type,
      element.id,
      element.name,
      element.getAttribute('aria-label'),
      element.getAttribute('autocomplete'),
      element.getAttribute('placeholder')
    ].join(' ').toLowerCase();
    if (/password|senha/.test(meta)) return '{{password}}';
    if (/token|secret|authorization|cookie|session/.test(meta)) return '{{secret}}';
    if (/cpf/.test(meta)) return '{{cpf}}';
    if (/cnpj/.test(meta)) return '{{cnpj}}';
    if (/email|e-mail|mail/.test(meta)) return '{{email}}';
    if (/phone|telefone|celular/.test(meta)) return '{{phone}}';
    return '';
  }

  function safeValue(action, element) {
    if (!['type', 'select'].includes(action)) return { value: '', valueMode: '' };
    const variable = variableForSensitiveField(element);
    if (variable) return { value: variable, valueMode: 'variable' };
    return { value: String(element.value || '').slice(0, 300), valueMode: 'literal' };
  }

  function miniTag(element) {
    const tag = String(element.tagName || 'element').toLowerCase().replace(/[^a-z0-9-]/g, '') || 'element';
    const attrs = [];
    const dataTestId = element.getAttribute('data-testid');
    const dataCy = element.getAttribute('data-cy');
    const dataTest = element.getAttribute('data-test');
    const ariaLabel = element.getAttribute('aria-label');
    if (dataTestId) attrs.push('data-testid="' + dataTestId.replace(/"/g, '') + '"');
    if (dataCy) attrs.push('data-cy="' + dataCy.replace(/"/g, '') + '"');
    if (dataTest) attrs.push('data-test="' + dataTest.replace(/"/g, '') + '"');
    if (element.id) attrs.push('id="' + String(element.id).replace(/"/g, '') + '"');
    if (element.name) attrs.push('name="' + String(element.name).replace(/"/g, '') + '"');
    if (ariaLabel) attrs.push('aria-label="' + ariaLabel.replace(/"/g, '') + '"');
    if (element.type) attrs.push('type="' + String(element.type).replace(/"/g, '') + '"');
    return '<' + tag + (attrs.length ? ' ' + attrs.join(' ') : '') + '>';
  }

  function payload(event, element) {
    const tag = String(element.tagName || '').toLowerCase();
    const type = String(element.type || '').toLowerCase();
    const action = actionFromEvent(event, element);
    const selected = selectorFor(element);
    const capturedValue = safeValue(action, element);
    return {
      action,
      title: action + ' ' + (shortText(element.innerText || element.getAttribute('aria-label') || element.name || element.id || tag, 80) || tag),
      currentUrl: safeUrl(),
      selectorRecommended: selected.selector,
      selectorReason: selected.reason,
      selectorFallback: selected.reason === 'css curto' ? selected.selector : cssPath(element),
      elementText: tag === 'button' || tag === 'a' ? shortText(element.innerText || element.textContent, 120) : '',
      tagName: tag,
      elementType: type,
      elementId: element.id || '',
      elementName: element.name || '',
      dataTestId: element.getAttribute('data-testid') || '',
      dataCy: element.getAttribute('data-cy') || '',
      dataTest: element.getAttribute('data-test') || '',
      ariaLabel: element.getAttribute('aria-label') || '',
      inputValue: capturedValue.value,
      valueMode: capturedValue.valueMode,
      htmlSnippet: miniTag(element),
      notes: 'Capturado com dados minimos pelo QA Orbit Recorder Snippet'
    };
  }

  async function send(event) {
    if (state.paused) return;
    const element = event.target;
    if (!element || !element.tagName) return;
    if (shouldIgnore(event, element)) return;
    state.queue = state.queue.then(async function () {
      await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-QA-Orbit-Recorder-Token': token
        },
        body: JSON.stringify(payload(event, element))
      });
    }).catch(function (error) {
      console.warn('[QA Orbit Recorder] Falha ao enviar passo', error);
    });
  }

  ['click', 'change', 'submit'].forEach((eventName) => document.addEventListener(eventName, send, true));
  window.qaOrbitRecorder = {
    pause: function () { state.paused = true; console.log('[QA Orbit Recorder] pausado'); },
    resume: function () { state.paused = false; console.log('[QA Orbit Recorder] gravando'); },
    stop: function () { state.paused = true; console.log('[QA Orbit Recorder] finalizado nesta pagina'); }
  };
  console.log('[QA Orbit Recorder] gravando. Use window.qaOrbitRecorder.pause(), resume() ou stop().');
})();`
}

function buildLocalBlueprint(session: SmartRecorderSession | null) {
  if (!session) return {}
  return {
    id: session.id,
    name: session.name,
    project: {
      id: Number(session.projectId || 0),
      name: session.projectName,
    },
    startUrl: session.startUrl,
    environment: session.environment,
    steps: session.steps.map((step) => {
      const target = buildStepTarget(step)
      return {
        order: step.order,
        action: step.action === 'assertion' ? 'assertVisible' : step.action,
        target: {
          strategy: target.strategy,
          selector: target.selector,
          text: target.text,
          recommendedCommand: target.recommendedCommand,
          fallbackSelector: target.fallbackSelector,
        },
        value: step.inputValue || null,
        variableName: variableNameFromValue(step.inputValue),
        expectedResult: step.expectedResult || '',
        selectorQuality: target.selectorQuality,
        warning: target.warning,
        improvementSuggestion: target.improvementSuggestion,
      }
    }),
  }
}

export function SmartRecorderPage() {
  const projectsQuery = useCatalogProjectsQuery()
  const projects = projectsQuery.data ?? []
  const [projectId, setProjectId] = useState('')
  const [flowName, setFlowName] = useState('')
  const [startUrl, setStartUrl] = useState('')
  const [environment, setEnvironment] = useState('')
  const [notes, setNotes] = useState('')
  const [session, setSession] = useState<SmartRecorderSession | null>(null)
  const [manualStep, setManualStep] = useState<Partial<SmartRecorderStep>>(() => emptyManualStep())
  const [editingStepId, setEditingStepId] = useState('')
  const [exportData, setExportData] = useState<SmartRecorderExport | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  const [message, setMessage] = useState('Crie uma sessao e copie o snippet para capturar interacoes no sistema alvo.')

  const snippet = useMemo(() => buildSnippet(session), [session])
  const localBlueprint = useMemo(() => buildLocalBlueprint(session), [session])
  const jsonPreview = useMemo(() => JSON.stringify(exportData?.blueprint ?? localBlueprint, null, 2), [exportData, localBlueprint])
  const promptPreview = exportData?.prompt || 'Finalize ou exporte a sessao para gerar o prompt completo.'

  async function refreshSession() {
    if (!session?.id) return
    const next = await getSmartRecorderSession(session.id)
    setSession((current) => ({ ...next, captureToken: current?.captureToken }))
  }

  async function handleCreateSession() {
    if (!projectId || !flowName.trim() || !startUrl.trim()) {
      setMessage('Projeto, nome do fluxo e URL inicial sao obrigatorios.')
      return
    }

    setIsBusy(true)
    try {
      const created = await createSmartRecorderSession({
        projectId,
        name: flowName.trim(),
        startUrl: startUrl.trim(),
        environment,
        notes,
      })
      setSession(created)
      setExportData(null)
      setMessage('Sessao criada. Copie o snippet e cole no console do sistema alvo.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nao foi possivel criar a sessao.')
    } finally {
      setIsBusy(false)
    }
  }

  async function handleManualStep() {
    if (!session?.id) {
      setMessage('Crie uma sessao antes de adicionar passos.')
      return
    }

    setIsBusy(true)
    try {
      if (editingStepId) {
        const updated = await updateSmartRecorderStep(session.id, editingStepId, manualStep)
        setSession((current) => ({ ...updated, captureToken: current?.captureToken }))
        setEditingStepId('')
        setMessage('Passo atualizado.')
      } else {
        await createSmartRecorderStep(session.id, manualStep)
        await refreshSession()
        setMessage('Passo adicionado.')
      }
      setManualStep(emptyManualStep())
      setExportData(null)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nao foi possivel salvar o passo.')
    } finally {
      setIsBusy(false)
    }
  }

  async function handleDeleteStep(stepId: string) {
    if (!session?.id) return
    const updated = await deleteSmartRecorderStep(session.id, stepId)
    setSession((current) => ({ ...updated, captureToken: current?.captureToken }))
    setExportData(null)
    setMessage('Passo excluido.')
  }

  async function moveStep(step: SmartRecorderStep, direction: -1 | 1) {
    if (!session?.id) return
    const ordered = [...session.steps].sort((left, right) => left.order - right.order)
    const index = ordered.findIndex((item) => item.id === step.id)
    const target = ordered[index + direction]
    if (!target) return

    await updateSmartRecorderStep(session.id, step.id, { ...step, order: target.order })
    const updated = await updateSmartRecorderStep(session.id, target.id, { ...target, order: step.order })
    setSession((current) => ({ ...updated, captureToken: current?.captureToken }))
    setExportData(null)
  }

  async function handleFinalize() {
    if (!session?.id) return
    const updated = await finalizeSmartRecorderSession(session.id)
    setSession((current) => ({ ...updated, captureToken: current?.captureToken }))
    setMessage('Gravacao finalizada.')
  }

  async function handleTogglePause() {
    if (!session?.id) return
    const updated = session.status === 'paused' ? await resumeSmartRecorderSession(session.id) : await pauseSmartRecorderSession(session.id)
    setSession((current) => ({ ...updated, captureToken: current?.captureToken }))
    setMessage(updated.status === 'paused' ? 'Gravacao pausada. O endpoint de captura nao aceitara novos passos.' : 'Gravacao retomada.')
  }

  async function handleExport() {
    if (!session?.id) return
    const exported = await exportSmartRecorderJson(session.id)
    setExportData(exported)
    setMessage('JSON tecnico e prompt atualizados.')
  }

  async function copyText(text: string, nextMessage: string) {
    await navigator.clipboard.writeText(text)
    setMessage(nextMessage)
  }

  function downloadJson() {
    const blob = new Blob([jsonPreview], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${session?.name || 'smart-recorder-blueprint'}.json`.replace(/[<>:"/\\|?*\x00-\x1F]/g, '-')
    anchor.click()
    URL.revokeObjectURL(url)
  }

  function startEdit(step: SmartRecorderStep) {
    setEditingStepId(step.id)
    setManualStep(step)
    setMessage(`Editando passo ${step.order}.`)
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Automacao"
        title="Smart Recorder"
        description="Grave interacoes manuais e transforme o fluxo em um blueprint tecnico para automacao Cypress futura."
      />

      <section className="space-y-6">
        <div className="space-y-6">
          <Card className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-muted">Configuracao da gravacao</p>
                <h2 className="font-display text-xl font-bold text-foreground">Nova sessao</h2>
              </div>
              {session ? <Badge tone={session.status === 'finalized' ? 'success' : 'info'}>{session.status}</Badge> : null}
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-semibold text-foreground">Projeto</span>
                <select
                  value={projectId}
                  onChange={(event) => setProjectId(event.target.value)}
                  className="h-11 w-full rounded-2xl border border-border bg-black/20 px-4 text-sm text-foreground outline-none transition focus:border-accent/40"
                >
                  <option value="">{projectsQuery.isLoading ? 'Carregando...' : 'Selecione um projeto'}</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.nome}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold text-foreground">Nome do fluxo</span>
                <Input value={flowName} onChange={(event) => setFlowName(event.target.value)} placeholder="Ex.: Login admin" />
              </label>
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.3fr,0.7fr]">
              <label className="space-y-2">
                <span className="text-sm font-semibold text-foreground">URL inicial</span>
                <Input value={startUrl} onChange={(event) => setStartUrl(event.target.value)} placeholder="https://app.exemplo.com/login" />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold text-foreground">Ambiente</span>
                <Input value={environment} onChange={(event) => setEnvironment(event.target.value)} placeholder="HML, QA, Local" />
              </label>
            </div>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-foreground">Observacoes</span>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className="min-h-24 w-full rounded-2xl border border-border bg-black/20 px-4 py-3 text-sm text-foreground outline-none transition focus:border-accent/40"
                placeholder="Contexto do fluxo, pre-condicoes e cuidados."
              />
            </label>

            <div className="flex flex-wrap gap-3">
              <Button type="button" onClick={() => void handleCreateSession()} disabled={isBusy}>
                <Play className="mr-2 h-4 w-4" />
                Iniciar gravacao
              </Button>
              <Button type="button" variant="secondary" onClick={() => void handleTogglePause()} disabled={!session || session.status === 'finalized'}>
                <Pause className="mr-2 h-4 w-4" />
                {session?.status === 'paused' ? 'Retomar' : 'Pausar'}
              </Button>
              <Button type="button" variant="secondary" onClick={() => void handleFinalize()} disabled={!session}>
                <Square className="mr-2 h-4 w-4" />
                Finalizar gravacao
              </Button>
              <Button type="button" variant="ghost" onClick={() => { setSession(null); setExportData(null); setManualStep(emptyManualStep()) }}>
                Limpar gravacao
              </Button>
              <Button type="button" variant="secondary" onClick={() => void handleExport()} disabled={!session}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Exportar JSON
              </Button>
              <Button type="button" variant="secondary" onClick={() => void copyText(promptPreview, 'Prompt copiado.')} disabled={!exportData}>
                <Clipboard className="mr-2 h-4 w-4" />
                Copiar prompt para Cypress
              </Button>
            </div>

            <div className="rounded-2xl border border-border bg-white/[0.02] p-4 text-sm text-muted">{message}</div>
          </Card>

          <Card className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-muted">Snippet de captura assistida</p>
                <h2 className="font-display text-xl font-bold text-foreground">QA Orbit Recorder Snippet</h2>
              </div>
              <Button type="button" variant="secondary" onClick={() => void copyText(snippet, 'Snippet copiado. Cole no console do sistema alvo.')} disabled={!snippet}>
                <Copy className="mr-2 h-4 w-4" />
                Copiar snippet
              </Button>
            </div>
            <pre className="max-h-64 max-w-full whitespace-pre-wrap break-words overflow-auto rounded-2xl border border-border bg-black/30 p-4 text-xs leading-5 text-foreground">
              {snippet || 'Crie uma sessao para gerar o snippet.'}
            </pre>
          </Card>

          <Card className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-muted">Passo manual ou edicao</p>
                <h2 className="font-display text-xl font-bold text-foreground">{editingStepId ? 'Editar passo' : 'Adicionar passo'}</h2>
              </div>
              <Button type="button" variant="ghost" onClick={() => { setEditingStepId(''); setManualStep(emptyManualStep()) }}>
                Novo
              </Button>
            </div>

            <div className="grid gap-4 xl:grid-cols-[0.7fr,1.3fr]">
              <label className="space-y-2">
                <span className="text-sm font-semibold text-foreground">Acao</span>
                <select
                  value={manualStep.action || 'click'}
                  onChange={(event) => setManualStep((current) => ({ ...current, action: event.target.value as SmartRecorderStep['action'] }))}
                  className="h-11 w-full rounded-2xl border border-border bg-black/20 px-4 text-sm text-foreground outline-none transition focus:border-accent/40"
                >
                  {actions.map((action) => (
                    <option key={action} value={action}>
                      {action}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold text-foreground">Titulo amigavel</span>
                <Input value={manualStep.title || ''} onChange={(event) => setManualStep((current) => ({ ...current, title: event.target.value }))} />
              </label>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <Input value={manualStep.selectorRecommended || ''} onChange={(event) => setManualStep((current) => ({ ...current, selectorRecommended: event.target.value }))} placeholder="Seletor recomendado" />
              <Input value={manualStep.selectorFallback || ''} onChange={(event) => setManualStep((current) => ({ ...current, selectorFallback: event.target.value }))} placeholder="Seletor alternativo" />
              <Input value={manualStep.elementText || ''} onChange={(event) => setManualStep((current) => ({ ...current, elementText: event.target.value }))} placeholder="Texto visivel" />
              <Input value={manualStep.inputValue || ''} onChange={(event) => setManualStep((current) => ({ ...current, inputValue: event.target.value }))} placeholder="Valor ou {{variavel}}" />
              <Input value={manualStep.tagName || ''} onChange={(event) => setManualStep((current) => ({ ...current, tagName: event.target.value }))} placeholder="Tag HTML" />
              <Input value={manualStep.elementType || ''} onChange={(event) => setManualStep((current) => ({ ...current, elementType: event.target.value }))} placeholder="Tipo" />
              <Input value={manualStep.dataTestId || ''} onChange={(event) => setManualStep((current) => ({ ...current, dataTestId: event.target.value }))} placeholder="data-testid" />
              <Input value={manualStep.ariaLabel || ''} onChange={(event) => setManualStep((current) => ({ ...current, ariaLabel: event.target.value }))} placeholder="aria-label" />
            </div>

            <textarea
              value={manualStep.htmlSnippet || ''}
              onChange={(event) => setManualStep((current) => ({ ...current, htmlSnippet: event.target.value }))}
              className="min-h-20 w-full rounded-2xl border border-border bg-black/20 px-4 py-3 text-sm text-foreground outline-none transition focus:border-accent/40"
              placeholder="HTML resumido do elemento"
            />
            <textarea
              value={manualStep.expectedResult || ''}
              onChange={(event) => setManualStep((current) => ({ ...current, expectedResult: event.target.value }))}
              className="min-h-20 w-full rounded-2xl border border-border bg-black/20 px-4 py-3 text-sm text-foreground outline-none transition focus:border-accent/40"
              placeholder="Resultado esperado manual"
            />
            <Button type="button" onClick={() => void handleManualStep()} disabled={isBusy || !session}>
              <Plus className="mr-2 h-4 w-4" />
              {editingStepId ? 'Salvar edicao' : 'Adicionar passo'}
            </Button>
          </Card>
          <Card className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-muted">Passos gravados</p>
                <h2 className="font-display text-xl font-bold text-foreground">{session?.steps.length || 0} passo(s)</h2>
              </div>
              <Button type="button" variant="secondary" onClick={() => void refreshSession()} disabled={!session}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Atualizar
              </Button>
            </div>

            <div className="space-y-3">
              {session?.steps.length ? (
                [...session.steps].sort((left, right) => left.order - right.order).map((step) => {
                  const target = buildStepTarget(step)
                  return (
                  <div key={step.id} className="rounded-2xl border border-border bg-white/[0.02] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone="info">#{step.order}</Badge>
                          <Badge tone="neutral">{step.action}</Badge>
                          <Badge tone={target.selectorQuality === 'strong' ? 'success' : target.selectorQuality === 'medium' ? 'info' : 'warning'}>{target.selectorQuality}</Badge>
                          <p className="font-semibold text-foreground">{step.title || 'Passo sem titulo'}</p>
                        </div>
                        <p className="mt-2 truncate text-sm text-muted">{step.currentUrl}</p>
                        <p className="mt-2 break-all text-sm text-foreground">{target.selector}</p>
                        <p className="mt-1 text-xs text-muted">
                          Estrategia: {target.strategy} | Comando: {target.recommendedCommand}
                          {target.text ? ` | Texto: ${target.text}` : ''} | Fallback: {target.fallbackSelector || '-'}
                        </p>
                        <p className="mt-1 text-xs text-muted">Motivo: {step.selectorReason || '-'} | Tag: {step.tagName || '-'} | Tipo: {step.elementType || '-'}</p>
                        {step.inputValue ? <p className="mt-1 text-xs text-muted">Valor: {step.inputValue}</p> : null}
                        {target.warning ? <p className="mt-2 text-xs text-amber-200">{target.warning}</p> : null}
                        {target.improvementSuggestion ? <p className="mt-1 text-xs text-muted">Sugestao: {target.improvementSuggestion}</p> : null}
                        {step.expectedResult ? <p className="mt-2 text-sm text-muted">Esperado: {step.expectedResult}</p> : null}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="ghost" className="h-9 px-3" onClick={() => void moveStep(step, -1)}>
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button type="button" variant="ghost" className="h-9 px-3" onClick={() => void moveStep(step, 1)}>
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                        <Button type="button" variant="secondary" className="h-9 px-3" onClick={() => startEdit(step)}>
                          Editar
                        </Button>
                        <Button type="button" variant="ghost" className="h-9 px-3 text-red-200 hover:bg-red-500/10 hover:text-red-100" onClick={() => void handleDeleteStep(step.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )})
              ) : (
                <div className="rounded-2xl border border-border bg-white/[0.02] p-4 text-sm text-muted">
                  Nenhum passo gravado ainda.
                </div>
              )}
            </div>
          </Card>

          <Card className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-muted">Preview tecnico</p>
                <h2 className="font-display text-xl font-bold text-foreground">Blueprint JSON</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" className="h-9 px-3" onClick={() => void copyText(jsonPreview, 'JSON copiado.')}>
                  <Copy className="h-4 w-4" />
                </Button>
                <Button type="button" variant="secondary" className="h-9 px-3" onClick={downloadJson} disabled={!session}>
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <pre className="max-h-[420px] max-w-full whitespace-pre-wrap break-words overflow-auto rounded-2xl border border-border bg-black/30 p-4 text-xs leading-5 text-foreground">
              {jsonPreview}
            </pre>
          </Card>

          <Card className="space-y-4">
            <div>
              <p className="text-sm text-muted">Sugestoes para geracao futura</p>
              <h2 className="font-display text-xl font-bold text-foreground">Page Object e steps</h2>
            </div>
            <pre className="max-h-56 max-w-full whitespace-pre-wrap break-words overflow-auto rounded-2xl border border-border bg-black/30 p-4 text-xs leading-5 text-foreground">
              {exportData?.pageObjectSuggestion || 'Exporte a sessao para gerar a sugestao de Page Object.'}
            </pre>
            <pre className="max-h-56 max-w-full whitespace-pre-wrap break-words overflow-auto rounded-2xl border border-border bg-black/30 p-4 text-xs leading-5 text-foreground">
              {exportData?.cypressStepsSuggestion || 'Exporte a sessao para gerar a sugestao de steps Cypress.'}
            </pre>
          </Card>

          <Card className="space-y-4">
            <div>
              <p className="text-sm text-muted">Prompt pronto</p>
              <h2 className="font-display text-xl font-bold text-foreground">Codex / IA</h2>
            </div>
            <pre className="max-h-72 max-w-full whitespace-pre-wrap break-words overflow-auto rounded-2xl border border-border bg-black/30 p-4 text-xs leading-5 text-foreground">
              {promptPreview}
            </pre>
          </Card>
        </div>
      </section>
    </div>
  )
}
