import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/use-auth'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login, isAuthenticated, isLoading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('Use seu usuario do QA Orbit para acessar o workspace com seguranca.')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!isLoading && isAuthenticated) {
    const redirectTo = (location.state as { from?: string } | null)?.from || '/'
    return <Navigate to={redirectTo} replace />
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    try {
      await login({ email, password })
      const redirectTo = (location.state as { from?: string } | null)?.from || '/'
      navigate(redirectTo, { replace: true })
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nao foi possivel autenticar.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background bg-glow px-4 py-10 text-foreground">
      <div className="mx-auto flex min-h-[80vh] max-w-6xl items-center justify-center">
        <div className="grid w-full gap-8 lg:grid-cols-[1.05fr,0.95fr]">
          <div className="rounded-[32px] border border-accent/20 bg-gradient-to-br from-accent/10 to-black/20 p-8 shadow-glow">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-accent">QA Orbit</p>
            <h1 className="mt-4 max-w-xl font-display text-4xl font-bold leading-tight text-foreground">
              Workspace seguro para validacao, historico e diagnostico de QA.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
              Centralize o contexto do chamado, evidencias, bugs vinculados, documentos funcionais e historico de regressao
              em um fluxo protegido por login.
            </p>
          </div>

          <Card className="mx-auto w-full max-w-xl space-y-6 p-8">
            <div>
              <p className="text-sm text-muted">Acesso protegido</p>
              <h2 className="font-display text-3xl font-bold text-foreground">Entrar no QA Orbit</h2>
              <p className="mt-3 text-sm leading-6 text-muted">{message}</p>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-foreground">Email</span>
                <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="voce@empresa.com" />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-foreground">Senha</span>
                <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Sua senha" />
              </label>
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Entrando...' : 'Entrar'}
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  )
}
