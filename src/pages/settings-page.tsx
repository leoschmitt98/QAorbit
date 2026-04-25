import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/hooks/use-auth'
import { createAdminUser, deleteAdminUser, listAdminUsers, type AdminUserRecord } from '@/services/user-admin-api'
import { SectionHeader } from '@/components/ui/section-header'
import { useEffect, useState } from 'react'

export function SettingsPage() {
  const { user } = useAuth()
  const [users, setUsers] = useState<AdminUserRecord[]>([])
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('qa')
  const [message, setMessage] = useState('Crie acessos individuais para o time sem depender de script manual no banco.')
  const [isLoadingUsers, setIsLoadingUsers] = useState(false)
  const [isCreatingUser, setIsCreatingUser] = useState(false)
  const [userToDelete, setUserToDelete] = useState<AdminUserRecord | null>(null)
  const [deletingUserId, setDeletingUserId] = useState('')

  async function loadUsers() {
    if (!user?.canViewAll) return
    setIsLoadingUsers(true)
    try {
      setUsers(await listAdminUsers())
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nao foi possivel listar os usuarios.')
    } finally {
      setIsLoadingUsers(false)
    }
  }

  useEffect(() => {
    void loadUsers()
  }, [user?.canViewAll])

  async function handleCreateUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsCreatingUser(true)
    try {
      const created = await createAdminUser({ name, email, password, role })
      setMessage(`Usuario ${created.email} criado com sucesso.`)
      setName('')
      setEmail('')
      setPassword('')
      setRole('qa')
      await loadUsers()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nao foi possivel criar o usuario.')
    } finally {
      setIsCreatingUser(false)
    }
  }

  async function handleDeleteUser(item: AdminUserRecord) {
    setDeletingUserId(item.userId)
    try {
      await deleteAdminUser(item.userId)
      setMessage(`Acesso de ${item.email} excluido com sucesso.`)
      setUsers((current) => current.filter((userItem) => userItem.userId !== item.userId))
      setUserToDelete(null)
      await loadUsers()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nao foi possivel excluir o usuario.')
    } finally {
      setDeletingUserId('')
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Configuracoes"
        title="Governanca da plataforma"
        description="Espaco reservado para perfis, integracoes, templates de bug, automacoes e padroes de nomenclatura."
      />
      <section className="grid gap-6 xl:grid-cols-2">
        <Card className="space-y-3">
          <p className="font-semibold text-white">Padrao de evidencias</p>
          <p className="text-sm text-slate-400">Naming convention, tipagem de anexos e politica de retencao ja mapeadas para futura configuracao.</p>
        </Card>
        <Card className="space-y-3">
          <p className="font-semibold text-white">Integracoes futuras</p>
          <p className="text-sm text-slate-400">Espaco preparado para API, storage, notificacoes, Jira, Azure DevOps e autenticacao corporativa.</p>
        </Card>
      </section>

      {user?.canViewAll ? (
        <section className="grid gap-6 xl:grid-cols-[0.95fr,1.05fr]">
          <Card className="space-y-4">
            <div>
              <p className="text-sm text-muted">Administracao de acessos</p>
              <h3 className="font-display text-2xl font-bold text-foreground">Criar novo usuario</h3>
              <p className="mt-2 text-sm text-muted">{message}</p>
            </div>

            <form className="space-y-4" onSubmit={handleCreateUser}>
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-foreground">Nome</span>
                <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nome da QA" />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-foreground">Email</span>
                <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="qa@empresa.com" />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-foreground">Senha inicial</span>
                <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Senha forte" />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-foreground">Perfil</span>
                <select
                  value={role}
                  onChange={(event) => setRole(event.target.value)}
                  className="h-11 w-full rounded-2xl border border-border bg-black/20 px-4 text-sm text-foreground outline-none transition focus:border-accent/40"
                >
                  <option value="qa">QA</option>
                  <option value="lead">Lead</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
              <Button type="submit" disabled={isCreatingUser}>
                {isCreatingUser ? 'Criando usuario...' : 'Criar usuario'}
              </Button>
            </form>
          </Card>

          <Card className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-muted">Usuarios cadastrados</p>
                <h3 className="font-display text-2xl font-bold text-foreground">Acessos do QA Orbit</h3>
              </div>
              <Button variant="secondary" onClick={() => void loadUsers()} disabled={isLoadingUsers}>
                {isLoadingUsers ? 'Atualizando...' : 'Atualizar'}
              </Button>
            </div>

            <div className="space-y-3">
              {users.length > 0 ? (
                users.map((item) => (
                  <div key={item.userId} className="rounded-2xl border border-border bg-white/[0.02] px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-foreground">{item.name}</p>
                        <p className="text-sm text-muted">{item.email}</p>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-3">
                        <div className="text-right text-xs uppercase tracking-[0.16em] text-muted">
                          <p>{item.role}</p>
                          <p>{item.active ? 'ativo' : 'inativo'}</p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          className="text-red-200 hover:bg-red-500/10 hover:text-red-100"
                          onClick={() => setUserToDelete(item)}
                          disabled={!item.active || deletingUserId === item.userId || item.userId === user?.userId}
                        >
                          {item.userId === user?.userId
                            ? 'Seu acesso'
                            : deletingUserId === item.userId
                              ? 'Excluindo...'
                              : 'Excluir'}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-border bg-white/[0.02] px-4 py-3 text-sm text-muted">
                  Nenhum usuario adicional cadastrado ainda.
                </div>
              )}
            </div>
          </Card>
        </section>
      ) : null}

      {userToDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-[#11131a] p-5 shadow-2xl">
            <h2 className="font-display text-xl font-bold text-foreground">Excluir acesso?</h2>
            <p className="mt-3 text-sm text-muted">
              O perfil de acesso de {userToDelete.name} sera excluido. Esse usuario nao conseguira mais entrar no QA Orbit.
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <Button type="button" variant="ghost" onClick={() => setUserToDelete(null)}>
                Cancelar
              </Button>
              <Button type="button" onClick={() => void handleDeleteUser(userToDelete)} disabled={deletingUserId === userToDelete.userId}>
                {deletingUserId === userToDelete.userId ? 'Excluindo...' : 'OK'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
