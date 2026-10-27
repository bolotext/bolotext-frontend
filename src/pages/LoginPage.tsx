import { useEffect, useRef, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, AudioLines, Building2, GitBranch, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import type { OrganizationChoice } from '@/api/types'
import { ROLE_LABEL } from '@/lib/permissions'
import { errorMessage } from '@/lib/utils'
import { Logo } from '@/components/layout/AppShell'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined
const GSI_SRC = 'https://accounts.google.com/gsi/client'

interface GoogleId {
  initialize: (cfg: { client_id: string; callback: (r: { credential: string }) => void }) => void
  renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void
}
const googleId = () => (window as unknown as { google?: { accounts: { id: GoogleId } } }).google?.accounts.id

export default function LoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'

  const [credential, setCredential] = useState<string | null>(null)
  const buttonRef = useRef<HTMLDivElement>(null)
  const [orgChoices, setOrgChoices] = useState<OrganizationChoice[] | null>(null)
  const [pendingOrg, setPendingOrg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const attempt = async (cred: string, orgId?: string) => {
    setBusy(true)
    setPendingOrg(orgId ?? null)
    setError(null)
    try {
      const res = await login(cred, orgId)
      if (res.ok) navigate(from, { replace: true })
      else setOrgChoices(res.organizations)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
      setPendingOrg(null)
    }
  }

  const attemptRef = useRef(attempt)
  useEffect(() => {
    attemptRef.current = attempt
  })

  useEffect(() => {
    if (user || orgChoices) return
    if (!GOOGLE_CLIENT_ID) return
    const render = () => {
      const gid = googleId()
      if (!gid || !buttonRef.current) return
      gid.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (r) => {
          setCredential(r.credential)
          void attemptRef.current(r.credential)
        },
      })
      gid.renderButton(buttonRef.current, { theme: 'outline', size: 'large', text: 'signin_with', width: 320 })
    }
    if (googleId()) return render()
    let script = document.querySelector<HTMLScriptElement>(`script[src="${GSI_SRC}"]`)
    if (!script) {
      script = document.createElement('script')
      script.src = GSI_SRC
      script.async = true
      document.head.appendChild(script)
    }
    script.addEventListener('load', render)
    return () => script.removeEventListener('load', render)
  }, [user, orgChoices])

  if (user) return <Navigate to={from} replace />

  return (
    <div className="grid min-h-full lg:grid-cols-[1fr_1.05fr]">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Logo />
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          {!orgChoices ? (
            <>
              <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
              <p className="mt-1.5 text-[13px] text-muted">Sign in to build and manage your voice agents.</p>
              <div className="mt-8 space-y-4">
                <div ref={buttonRef} className="flex justify-center" />
                {busy && <div className="text-center text-[13px] text-muted">Signing in…</div>}
                {(error || !GOOGLE_CLIENT_ID) && (
                  <div className="rounded-lg border border-danger/20 bg-danger-soft px-3 py-2 text-[13px] text-danger">
                    {error ?? 'Google sign-in is not configured (missing VITE_GOOGLE_CLIENT_ID).'}
                  </div>
                )}
              </div>
              <p className="mt-6 text-xs text-muted">
                Sign in with the Google account your organization admin added. Contact them if you need access.
              </p>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setOrgChoices(null)}
                className="mb-6 inline-flex items-center gap-1.5 self-start text-xs text-muted hover:text-fg"
              >
                <ArrowLeft className="size-3.5" /> Back
              </button>
              <h1 className="text-2xl font-semibold tracking-tight">Choose an organization</h1>
              <p className="mt-1.5 text-[13px] text-muted">
                Your account belongs to more than one organization. You can switch later from the sidebar.
              </p>
              <div className="mt-6 space-y-2">
                {orgChoices.map((o) => (
                  <button
                    key={o.organization_id}
                    type="button"
                    disabled={busy}
                    onClick={() => credential && attempt(credential, o.organization_id)}
                    className="flex w-full items-center gap-3 rounded-xl border border-line bg-surface p-3.5 text-left shadow-card transition-all hover:border-accent/50 hover:bg-surface-2 disabled:opacity-60"
                  >
                    <div className="flex size-9 items-center justify-center rounded-lg bg-accent-soft text-accent">
                      <Building2 className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium">{o.name}</div>
                      <div className="text-xs text-muted">{ROLE_LABEL[o.role]}</div>
                    </div>
                    {pendingOrg === o.organization_id ? (
                      <span className="size-4 animate-spin rounded-full border-2 border-line border-t-accent" />
                    ) : (
                      <ArrowRight className="size-4 text-subtle" />
                    )}
                  </button>
                ))}
              </div>
              {error && <div className="mt-4 rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-danger">{error}</div>}
            </>
          )}
        </div>
      </div>

      <div className="relative hidden overflow-hidden border-l border-line bg-surface-2 lg:block">
        <div
          className="absolute inset-0 opacity-[0.5] dark:opacity-30"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, var(--line-strong) 1px, transparent 0)',
            backgroundSize: '22px 22px',
          }}
        />
        <div className="absolute -top-40 -right-40 size-[520px] rounded-full bg-accent/15 blur-3xl" />
        <div className="relative flex h-full flex-col justify-center px-14">
          <div className="max-w-md">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs text-muted shadow-card">
              <span className="size-1.5 rounded-full bg-success" /> Agent Studio
            </div>
            <h2 className="text-3xl leading-tight font-semibold tracking-tight">
              Design, test and ship voice agents with confidence.
            </h2>
            <div className="mt-10 space-y-5">
              {[
                {
                  icon: <AudioLines />,
                  title: 'One builder for every layer',
                  body: 'Prompt, LLM, speech recognition, voice and tools — configured side by side.',
                },
                {
                  icon: <GitBranch />,
                  title: 'Development → Stage → Production',
                  body: 'Edit freely in development, then promote tested snapshots.',
                },
                {
                  icon: <ShieldCheck />,
                  title: 'Role-based access',
                  body: 'Admins, developers and QA see exactly what their role allows.',
                },
              ].map((f) => (
                <div key={f.title} className="flex gap-3.5">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-line bg-surface text-accent shadow-card [&_svg]:size-4">
                    {f.icon}
                  </div>
                  <div>
                    <div className="text-[13px] font-semibold">{f.title}</div>
                    <div className="mt-0.5 text-[13px] text-muted">{f.body}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
