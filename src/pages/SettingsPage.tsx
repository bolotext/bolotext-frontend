import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Monitor, Moon, Palette, Sun, UserRound } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { usersApi } from '@/api/endpoints'
import { ROLE_LABEL } from '@/lib/permissions'
import { formatDate } from '@/lib/utils'
import { useTheme, type ThemePref } from '@/lib/theme'
import { Page, PageHeader } from '@/components/layout/Page'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/input'
import { Avatar, Badge, Card, CardBody, CardHeader } from '@/components/ui/primitives'
import { toastError } from './agents/helpers'

export default function SettingsPage() {
  const { user, abilities } = useAuth()
  const qc = useQueryClient()
  const { pref, setPref } = useTheme()
  const [name, setName] = useState(user?.full_name ?? '')

  const updateName = useMutation({
    mutationFn: () => usersApi.updateMe({ full_name: name.trim() }),
    onSuccess: (u) => {
      qc.setQueryData(['me'], u)
      toast.success('Profile updated')
    },
    onError: (e) => toastError(e),
  })

  if (!user) return null

  const themes: { value: ThemePref; label: string; icon: typeof Sun }[] = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ]

  return (
    <Page>
      <PageHeader title="Settings" description="Your profile and preferences." />

      <div className="space-y-6">
        <Card>
          <CardHeader icon={<UserRound />} title="Profile" />
          <CardBody className="space-y-5">
            <div className="flex items-center gap-4">
              <Avatar name={user.full_name} className="size-12 text-base" />
              <div>
                <div className="font-medium">{user.full_name}</div>
                <div className="text-[13px] text-muted">{user.email}</div>
                <div className="mt-1.5 flex gap-1.5">
                  {abilities.role && <Badge tone="accent">{ROLE_LABEL[abilities.role]}</Badge>}
                  <Badge>Member since {formatDate(user.created_at)}</Badge>
                </div>
              </div>
            </div>
            <Field label="Full name">
              <div className="flex gap-2">
                <Input value={name} onChange={(e) => setName(e.target.value)} className="max-w-sm" />
                <Button
                  variant="primary"
                  disabled={!name.trim() || name.trim() === user.full_name}
                  loading={updateName.isPending}
                  onClick={() => updateName.mutate()}
                >
                  Save
                </Button>
              </div>
            </Field>
            <Field label="Email" hint="Contact an admin to change your email.">
              <Input value={user.email} readOnly className="max-w-sm" />
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader icon={<Palette />} title="Appearance" />
          <CardBody>
            <div className="grid max-w-md grid-cols-3 gap-2">
              {themes.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setPref(t.value)}
                  className={`flex flex-col items-center gap-2 rounded-xl border p-4 text-[13px] transition-colors ${pref === t.value ? 'border-accent bg-accent-soft/50 text-fg' : 'border-line text-muted hover:bg-surface-2'}`}
                >
                  <t.icon className="size-5" />
                  {t.label}
                </button>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>
    </Page>
  )
}
