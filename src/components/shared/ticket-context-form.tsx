import { useState, type ReactNode } from 'react'
import { FileText, Paperclip, Trash2, Upload } from 'lucide-react'
import type { PortalArea, ProductType, TicketContext, TicketOrigin } from '@/types/domain'
import type { CatalogModulo, CatalogOption } from '@/services/catalog-api'
import { Card } from '@/components/ui/card'

interface TicketContextFormProps {
  value: TicketContext
  projects: CatalogOption[]
  modules: CatalogModulo[]
  areas: CatalogOption[]
  projectsLoading: boolean
  modulesLoading: boolean
  areasLoading: boolean
  errorMessage?: string | null
  importMessage?: string | null
  importTextMessage?: string | null
  onImportDocument?: (file: File) => void | Promise<void>
  onImportText?: (text: string) => void | Promise<void>
  onChange: (value: TicketContext) => void
}

const productTypes: ProductType[] = ['Portal', 'Sistema interno', 'API']
const origins: TicketOrigin[] = ['Suporte', 'Cliente', 'Interno']

function normalizeScopeLabel(value: string) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function moduleMatchesPortalArea(module: CatalogModulo, portalArea: string) {
  const area = normalizeScopeLabel(portalArea)
  if (!area) return true

  const portalName = normalizeScopeLabel(module.portalNome || '')
  if (!portalName) return true

  return portalName.includes(area)
}

export function TicketContextForm({
  value,
  projects,
  modules,
  areas,
  projectsLoading,
  modulesLoading,
  areasLoading,
  errorMessage,
  importMessage,
  importTextMessage,
  onImportDocument,
  onImportText,
  onChange,
}: TicketContextFormProps) {
  const [clipboardText, setClipboardText] = useState('')
  const availableModules = modules.filter(
    (item) => item.projetoId === value.projectId && moduleMatchesPortalArea(item, value.portalArea),
  )

  function update<K extends keyof TicketContext>(key: K, nextValue: TicketContext[K]) {
    const next = { ...value, [key]: nextValue }
    if (key === 'projectId') {
      next.moduleId = ''
    }
    if (key === 'portalArea') {
      next.moduleId = ''
    }
    onChange(next)
  }

  function updateAttachment(index: number, nextValue: string) {
    const supportAttachments = [...value.supportAttachments]
    supportAttachments[index] = nextValue
    onChange({ ...value, supportAttachments })
  }

  function addAttachment() {
    onChange({ ...value, supportAttachments: [...value.supportAttachments, 'novo-anexo.txt'] })
  }

  function removeAttachment(index: number) {
    onChange({
      ...value,
      supportAttachments: value.supportAttachments.filter((_, attachmentIndex) => attachmentIndex !== index),
    })
  }

  return (
    <Card className="space-y-8">
      <div>
        <p className="text-sm text-muted">Etapa 1</p>
        <h3 className="font-display text-2xl font-bold text-foreground">Contexto do chamado</h3>
        {errorMessage ? <p className="mt-2 text-sm text-muted">{errorMessage}</p> : null}
      </div>

      <SectionBlock
        title="Importacao rapida do chamado"
        description="Cole aqui o texto do card ou work item vindo do Azure para o sistema tentar preencher automaticamente os campos principais."
      >
        <TextAreaField
          label="Conteudo copiado do chamado"
          value={clipboardText}
          onChange={setClipboardText}
        />
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (onImportText) {
                void onImportText(clipboardText)
              }
            }}
            className="inline-flex h-11 items-center justify-center rounded-2xl border border-accent/35 bg-accent/12 px-4 text-sm font-semibold text-foreground shadow-glow"
          >
            Preencher automaticamente
          </button>
          <button
            type="button"
            onClick={() => setClipboardText('')}
            className="inline-flex h-11 items-center justify-center rounded-2xl border border-border bg-black/20 px-4 text-sm font-semibold text-muted transition hover:border-accent/25 hover:text-foreground"
          >
            Limpar texto
          </button>
        </div>
        {importTextMessage ? <p className="text-sm text-muted">{importTextMessage}</p> : null}
      </SectionBlock>

      <SectionBlock
        title="Identificacao"
        description="Registre o chamado exatamente como ele chega do suporte ou do cliente."
      >
        <div className="grid gap-4 xl:grid-cols-2">
          <InputField label="ID do chamado" value={value.ticketId} onChange={(nextValue) => update('ticketId', nextValue)} />
          <InputField label="Titulo" value={value.title} onChange={(nextValue) => update('title', nextValue)} />
        </div>
        <TextAreaField
          label="Descricao do problema (relato do cliente)"
          value={value.customerProblemDescription}
          onChange={(nextValue) => update('customerProblemDescription', nextValue)}
        />
      </SectionBlock>

      <SectionBlock
        title="Contexto do sistema"
        description="Enquadre o ticket dentro do produto para facilitar rastreabilidade e reuso."
      >
        <div className="grid gap-4 xl:grid-cols-2">
          <SelectField
            label="Projeto"
            value={value.projectId}
            onChange={(nextValue) => update('projectId', nextValue)}
            options={projects.map((item) => ({ value: item.id, label: item.nome }))}
            loading={projectsLoading}
          />
          <SelectField
            label="Tipo de produto"
            value={value.productType}
            onChange={(nextValue) => update('productType', nextValue as ProductType)}
            options={productTypes.map((item) => ({ value: item, label: item }))}
          />
          <SelectField
            label="Portal / Area"
            value={value.portalArea}
            onChange={(nextValue) => update('portalArea', nextValue as PortalArea)}
            options={areas.map((item) => ({ value: item.nome, label: item.nome }))}
            loading={areasLoading}
          />
          <SelectField
            label="Modulo principal"
            value={value.moduleId}
            onChange={(nextValue) => update('moduleId', nextValue)}
            options={availableModules.map((item) => ({ value: item.id, label: item.nome }))}
            loading={modulesLoading}
          />
        </div>
      </SectionBlock>

      <SectionBlock
        title="Execucao"
        description="Defina o recorte tecnico da validacao antes de partir para a analise detalhada."
      >
        <div className="grid gap-4 xl:grid-cols-3">
          <InputField label="Ambiente" value={value.environment} onChange={(nextValue) => update('environment', nextValue)} />
          <InputField label="Versao / hotfix" value={value.version} onChange={(nextValue) => update('version', nextValue)} />
          <SelectField
            label="Origem do chamado"
            value={value.origin}
            onChange={(nextValue) => update('origin', nextValue as TicketOrigin)}
            options={origins.map((item) => ({ value: item, label: item }))}
          />
        </div>
      </SectionBlock>

      <SectionBlock
        title="Cabecalho operacional"
        description="Esses dados entram no cabecalho dos arquivos Word para orientar ambiente, acesso e branch da validacao."
      >
        <div className="grid gap-4 xl:grid-cols-2">
          <InputField label="Base" value={value.baseReference} onChange={(nextValue) => update('baseReference', nextValue)} />
          <InputField label="DLL / URL" value={value.accessUrl} onChange={(nextValue) => update('accessUrl', nextValue)} />
          <InputField label="Usuario" value={value.username} onChange={(nextValue) => update('username', nextValue)} />
          <InputField label="Senha" value={value.password} onChange={(nextValue) => update('password', nextValue)} />
          <InputField label="Empresa" value={value.companyCode} onChange={(nextValue) => update('companyCode', nextValue)} />
          <InputField label="Unidade" value={value.unitCode} onChange={(nextValue) => update('unitCode', nextValue)} />
          <div className="xl:col-span-2">
            <InputField label="Branch" value={value.branchName} onChange={(nextValue) => update('branchName', nextValue)} />
          </div>
        </div>
      </SectionBlock>

      <SectionBlock
        title="Changelog do dev"
        description="Cole aqui o resumo tecnico do hotfix vindo do Azure para reaproveitar na analise com Codex. Esse bloco nao entra no Word."
      >
        <TextAreaField
          label="Changelog do dev"
          value={value.developerChangelog}
          onChange={(nextValue) => update('developerChangelog', nextValue)}
        />
      </SectionBlock>

      <SectionBlock
        title="Documentos"
        description="Reuna a base documental e os anexos recebidos para alimentar as proximas etapas."
      >
        <div className="grid gap-6 xl:grid-cols-[0.95fr,1.05fr]">
          <FileUploadField
            label="Documento base (ex: PSR)"
            value={value.documentoBaseName}
            onChange={(nextValue) => update('documentoBaseName', nextValue)}
            onImportDocument={onImportDocument}
            helperMessage={importMessage}
          />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">Anexos do suporte</p>
                <p className="text-sm text-muted">Lista dinamica de arquivos recebidos na abertura do chamado.</p>
              </div>
              <button className="text-sm font-semibold text-accent" onClick={addAttachment} type="button">
                + adicionar anexo
              </button>
            </div>

            <div className="space-y-3">
              {value.supportAttachments.map((attachment, index) => (
                <div
                  key={`${attachment}-${index}`}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-white/[0.03] px-4 py-3"
                >
                  <Paperclip className="h-4 w-4 text-accent" />
                  <input
                    value={attachment}
                    onChange={(event) => updateAttachment(index, event.target.value)}
                    className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted/70"
                  />
                  <button
                    type="button"
                    onClick={() => removeAttachment(index)}
                    className="rounded-xl border border-border bg-black/20 p-2 text-muted transition hover:border-accent/30 hover:text-foreground"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </SectionBlock>
    </Card>
  )
}

interface SectionBlockProps {
  title: string
  description: string
  children: ReactNode
}

function SectionBlock({ title, description, children }: SectionBlockProps) {
  return (
    <section className="space-y-4 rounded-3xl border border-border bg-black/10 p-5">
      <div className="space-y-1">
        <h4 className="font-display text-lg font-bold text-foreground">{title}</h4>
        <p className="text-sm text-muted">{description}</p>
      </div>
      {children}
    </section>
  )
}

interface InputFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
}

function InputField({ label, value, onChange }: InputFieldProps) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-semibold text-foreground">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded-2xl border border-border bg-black/20 px-4 text-sm text-foreground outline-none focus:border-accent/40"
      />
    </label>
  )
}

interface TextAreaFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
}

function TextAreaField({ label, value, onChange }: TextAreaFieldProps) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-semibold text-foreground">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-[140px] w-full rounded-2xl border border-border bg-black/20 p-4 text-sm text-foreground outline-none focus:border-accent/40"
      />
    </label>
  )
}

interface SelectFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
  loading?: boolean
}

function SelectField({ label, value, onChange, options, loading }: SelectFieldProps) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-semibold text-foreground">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={loading}
        className="h-12 w-full rounded-2xl border border-border bg-black/20 px-4 text-sm text-foreground outline-none focus:border-accent/40 disabled:opacity-60"
      >
        <option value="" style={{ backgroundColor: '#09130c', color: '#d8e0d4' }}>
          {loading ? 'Carregando...' : 'Selecione'}
        </option>
        {options.map((option) => (
          <option key={option.value} value={option.value} style={{ backgroundColor: '#09130c', color: '#f5f7f1' }}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

interface FileUploadFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  onImportDocument?: (file: File) => void | Promise<void>
  helperMessage?: string | null
}

function FileUploadField({ label, value, onChange, onImportDocument, helperMessage }: FileUploadFieldProps) {
  return (
    <label className="space-y-3">
      <span className="text-sm font-semibold text-foreground">{label}</span>
      <div className="rounded-3xl border border-dashed border-accent/25 bg-accent/6 p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl border border-accent/20 bg-accent/10 p-3">
              <FileText className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="font-semibold text-foreground">{value || 'Nenhum documento selecionado'}</p>
              <p className="mt-1 text-sm text-muted">Upload mockado para documento principal do chamado.</p>
            </div>
          </div>
          <div className="relative">
            <input
              type="file"
              className="absolute inset-0 cursor-pointer opacity-0"
              onChange={(event) => {
                const file = event.target.files?.[0]
                onChange(file?.name ?? value)
                if (file && onImportDocument) {
                  void onImportDocument(file)
                }
              }}
            />
            <div className="inline-flex h-11 items-center justify-center rounded-2xl border border-accent/35 bg-accent/12 px-4 text-sm font-semibold text-foreground shadow-glow">
              <Upload className="mr-2 h-4 w-4" />
              Selecionar arquivo
            </div>
          </div>
        </div>
        {helperMessage ? <p className="mt-4 text-sm text-muted">{helperMessage}</p> : null}
      </div>
    </label>
  )
}
