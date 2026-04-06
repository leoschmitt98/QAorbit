import { Bell, Sparkles, Search } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/hooks/use-auth'
import { useProjectScope } from '@/hooks/use-project-scope'
import { useWorkspaceScope } from '@/hooks/use-workspace-scope'
import { useCatalogProjectsQuery } from '@/services/catalog-api'

interface TopbarProps {
  collapsed?: boolean
  onToggleSidebar?: () => void
  userName?: string
  userRole?: string
}

export function Topbar({ collapsed = false, onToggleSidebar, userName = 'Usuario', userRole = 'qa' }: TopbarProps) {
  const { logout, user } = useAuth()
  const { selectedProjectId, setSelectedProjectId } = useProjectScope()
  const { visibility, setVisibility, canSwitchVisibility } = useWorkspaceScope()
  const projectsQuery = useCatalogProjectsQuery()
  const selectedProjectName =
    projectsQuery.data?.find((project) => project.id === selectedProjectId)?.nome ?? ''

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/80 px-4 py-4 backdrop-blur-xl lg:px-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex w-full max-w-4xl flex-col gap-3 xl:flex-row xl:items-center">
          <div className="relative w-full max-w-xl">
            <Search className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-muted/70" />
            <Input className="pl-11" placeholder="Buscar por projeto, bug, modulo, documento ou evidencia..." />
          </div>
          <label className="flex min-w-[260px] flex-col gap-2 xl:flex-1">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted/80">
              Projeto ativo
            </span>
            <select
              value={selectedProjectId}
              onChange={(event) => setSelectedProjectId(event.target.value)}
              className="h-11 w-full rounded-2xl border border-border bg-black/20 px-4 text-sm text-foreground outline-none transition focus:border-accent/40"
            >
              <option value="">Todos os projetos</option>
              {(projectsQuery.data ?? []).map((project) => (
                <option key={project.id} value={project.id}>
                  {project.nome}
                </option>
              ))}
            </select>
          </label>
          {canSwitchVisibility ? (
            <label className="flex min-w-[220px] flex-col gap-2 xl:flex-1">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted/80">
                Escopo do workspace
              </span>
              <select
                value={visibility}
                onChange={(event) => setVisibility(event.target.value === 'all' ? 'all' : 'mine')}
                className="h-11 w-full rounded-2xl border border-border bg-black/20 px-4 text-sm text-foreground outline-none transition focus:border-accent/40"
              >
                <option value="mine">Meu workspace</option>
                <option value="all">Visao geral do time</option>
              </select>
            </label>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          {onToggleSidebar ? (
            <Button variant="secondary" onClick={onToggleSidebar} className="hidden lg:inline-flex">
              {collapsed ? 'Expandir menu' : 'Menu compacto'}
            </Button>
          ) : null}
          {selectedProjectName ? (
            <div className="hidden rounded-2xl border border-accent/20 bg-accent/8 px-4 py-2 text-right xl:block">
              <p className="text-xs uppercase tracking-[0.16em] text-muted">Escopo atual</p>
              <p className="text-sm font-semibold text-foreground">{selectedProjectName}</p>
            </div>
          ) : null}
          <button className="relative rounded-2xl border border-border bg-white/[0.03] p-3 text-muted transition hover:border-accent/30 hover:text-foreground">
            <Bell className="h-4 w-4" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-accent" />
          </button>
          <div className="hidden rounded-2xl border border-border bg-white/[0.03] px-4 py-2 text-right lg:block">
            <p className="text-sm font-semibold text-foreground">{userName}</p>
            <p className="text-xs uppercase text-muted">
              {userRole}
              {user?.canViewAll ? ` · ${visibility === 'all' ? 'visao geral' : 'meu workspace'}` : ''}
            </p>
          </div>
          <Button variant="secondary" onClick={() => void logout()}>
            Sair
          </Button>
          <Link to="/analysis/new">
            <Button>
              <Sparkles className="mr-2 h-4 w-4" />
              Nova analise
            </Button>
          </Link>
        </div>
      </div>
    </header>
  )
}
