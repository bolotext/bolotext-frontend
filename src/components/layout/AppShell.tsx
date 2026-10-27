import { Suspense, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Bot,
  Building2,
  Check,
  ChevronsUpDown,
  LayoutDashboard,
  LogOut,
  Menu as MenuIcon,
  Monitor,
  Moon,
  Search,
  Settings,
  Sun,
  Users,
  KeyRound,
  X,
} from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { ROLE_LABEL } from '@/lib/permissions'
import { cn, errorMessage } from '@/lib/utils'
import { useTheme, type ThemePref } from '@/lib/theme'
import { Avatar, Badge } from '@/components/ui/primitives'
import {
  DropdownContent,
  DropdownItem,
  DropdownLabel,
  DropdownMenu,
  DropdownSeparator,
  DropdownTrigger,
} from '@/components/ui/overlay'

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <div className="flex size-7 items-center justify-center rounded-lg bg-accent text-accent-fg shadow-card">
        <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden>
          <rect x="3" y="9" width="2.6" height="6" rx="1.3" />
          <rect x="8" y="6" width="2.6" height="12" rx="1.3" />
          <rect x="13" y="3" width="2.6" height="18" rx="1.3" />
          <rect x="18" y="8" width="2.6" height="8" rx="1.3" />
        </svg>
      </div>
      <div className="leading-tight">
        <div className="text-[13px] font-semibold tracking-tight text-fg">Bolotext</div>
        <div className="text-[11px] text-muted">Agent Studio</div>
      </div>
    </div>
  )
}

function NavItem({ to, icon, children, end }: { to: string; icon: ReactNode; children: ReactNode; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'group flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium transition-colors [&_svg]:size-4',
          isActive ? 'bg-surface text-fg shadow-card ring-1 ring-line' : 'text-muted hover:bg-surface-3/60 hover:text-fg',
        )
      }
    >
      {icon}
      {children}
    </NavLink>
  )
}

function OrgSwitcher() {
  const { user, organizations, currentOrg, switchOrganization } = useAuth()
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  const label = currentOrg?.name ?? (user?.is_super_admin ? 'Platform' : 'No organization')
  const sub = currentOrg ? ROLE_LABEL[currentOrg.role] : user?.is_super_admin ? 'Super Admin · all orgs' : ''

  const q = query.trim().toLowerCase()
  const filtered = q ? organizations.filter((o) => o.name.toLowerCase().includes(q)) : organizations

  const onOpenChange = (next: boolean) => {
    setOpen(next)
    setQuery('')
    // Radix moves focus to the menu itself on open; put it in the search box afterwards.
    if (next) setTimeout(() => searchRef.current?.focus(), 0)
  }

  const onSwitch = async (id: string) => {
    if (id === currentOrg?.organization_id) return
    setBusy(true)
    try {
      // Reloads the app on success (see AuthContext.switchOrganization).
      await switchOrganization(id)
    } catch (e) {
      toast.error(errorMessage(e))
      setBusy(false)
    }
  }

  const trigger = (
    <button
      type="button"
      disabled={busy || organizations.length < 2}
      className="flex w-full items-center gap-2.5 rounded-lg border border-line bg-surface px-2.5 py-2 text-left shadow-card transition-colors enabled:hover:bg-surface-2 disabled:cursor-default"
    >
      <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-accent-soft text-[12px] font-semibold text-accent">
        {label[0]?.toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-medium text-fg">{label}</div>
        {sub && <div className="truncate text-[11px] text-muted">{sub}</div>}
      </div>
      {organizations.length > 1 && <ChevronsUpDown className="size-3.5 shrink-0 text-subtle" />}
    </button>
  )

  if (organizations.length < 2) return trigger
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownTrigger asChild>{trigger}</DropdownTrigger>
      <DropdownContent align="start" className="w-64 p-0">
        <div className="border-b border-line p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-subtle" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              // Keep the menu's own keyboard handling (typeahead, arrows, Enter) out of the text box.
              onKeyDown={(e) => {
                if (e.key === 'Enter' && filtered.length === 1) void onSwitch(filtered[0].organization_id)
                if (e.key !== 'Escape') e.stopPropagation()
              }}
              placeholder="Search organizations…"
              aria-label="Search organizations"
              className="h-8 w-full rounded-md border border-line bg-surface-2/60 pr-2 pl-8 text-[13px] text-fg outline-none placeholder:text-subtle focus:border-accent"
            />
          </div>
        </div>
        <div className="max-h-64 overflow-y-auto p-1">
          <DropdownLabel>Your organizations ({organizations.length})</DropdownLabel>
          {filtered.length === 0 && <div className="px-2 py-4 text-center text-xs text-muted">No organizations match “{query}”.</div>}
          {filtered.map((o) => {
            const current = o.organization_id === currentOrg?.organization_id
            return (
              <DropdownItem key={o.organization_id} onSelect={() => onSwitch(o.organization_id)}>
                <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-surface-3 text-[11px] font-semibold text-fg">
                  {o.name[0]?.toUpperCase()}
                </div>
                <div className="min-w-0 flex-1 py-1">
                  <div className="truncate leading-tight">{o.name}</div>
                  <div className="text-[11px] leading-tight text-muted">{ROLE_LABEL[o.role]}</div>
                </div>
                {current && <Check className="!text-accent" />}
              </DropdownItem>
            )
          })}
        </div>
      </DropdownContent>
    </DropdownMenu>
  )
}

function UserMenu() {
  const { user, abilities, logout } = useAuth()
  const { pref, setPref } = useTheme()
  const navigate = useNavigate()
  if (!user) return null

  const themes: { value: ThemePref; label: string; icon: ReactNode }[] = [
    { value: 'light', label: 'Light', icon: <Sun /> },
    { value: 'dark', label: 'Dark', icon: <Moon /> },
    { value: 'system', label: 'System', icon: <Monitor /> },
  ]

  return (
    <DropdownMenu>
      <DropdownTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-surface-3/60"
        >
          <Avatar name={user.full_name} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-medium text-fg">{user.full_name}</div>
            <div className="truncate text-[11px] text-muted">{user.email}</div>
          </div>
          <ChevronsUpDown className="size-3.5 shrink-0 text-subtle" />
        </button>
      </DropdownTrigger>
      <DropdownContent align="start" className="w-60">
        <div className="px-2 py-1.5">
          <div className="text-[13px] font-medium">{user.full_name}</div>
          <div className="mb-1.5 truncate text-xs text-muted">{user.email}</div>
          {abilities.role && <Badge tone="accent">{ROLE_LABEL[abilities.role]}</Badge>}
        </div>
        <DropdownSeparator />
        <DropdownItem onSelect={() => navigate('/settings')}>
          <Settings /> Account settings
        </DropdownItem>
        <DropdownSeparator />
        <DropdownLabel>Theme</DropdownLabel>
        {themes.map((t) => (
          <DropdownItem key={t.value} onSelect={() => setPref(t.value)}>
            {t.icon} <span className="flex-1">{t.label}</span>
            {pref === t.value && <Check className="!text-accent" />}
          </DropdownItem>
        ))}
        <DropdownSeparator />
        <DropdownItem
          onSelect={async () => {
            await logout()
            navigate('/login')
          }}
        >
          <LogOut /> Sign out
        </DropdownItem>
      </DropdownContent>
    </DropdownMenu>
  )
}

function SidebarContent() {
  const { abilities } = useAuth()
  return (
    <div className="flex h-full flex-col gap-4 p-3">
      <Link to="/" className="px-1.5 pt-1">
        <Logo />
      </Link>
      <OrgSwitcher />
      <nav className="flex flex-1 flex-col gap-0.5">
        <div className="px-2.5 pt-2 pb-1.5 text-[11px] font-medium tracking-wide text-subtle uppercase">Build</div>
        <NavItem to="/" end icon={<LayoutDashboard />}>
          Dashboard
        </NavItem>
        <NavItem to="/agents" icon={<Bot />}>
          Agents
        </NavItem>
        {(abilities.viewUsers || abilities.viewOrganizations || abilities.manageApiTokens) && (
          <div className="px-2.5 pt-5 pb-1.5 text-[11px] font-medium tracking-wide text-subtle uppercase">Manage</div>
        )}
        {abilities.viewUsers && (
          <NavItem to="/users" icon={<Users />}>
            Users
          </NavItem>
        )}
        {abilities.viewOrganizations && (
          <NavItem to="/organizations" icon={<Building2 />}>
            Organizations
          </NavItem>
        )}
        {abilities.manageApiTokens && (
          <NavItem to="/api-tokens" icon={<KeyRound />}>
            API tokens
          </NavItem>
        )}
        <div className="mt-auto" />
      </nav>
      <div className="border-t border-line pt-3">
        <UserMenu />
      </div>
    </div>
  )
}

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { pathname } = useLocation()
  // Close the mobile drawer on navigation.
  const [lastPath, setLastPath] = useState(pathname)
  if (pathname !== lastPath) {
    setLastPath(pathname)
    setMobileOpen(false)
  }

  return (
    <div className="flex h-full">
      <aside className="hidden w-60 shrink-0 border-r border-line bg-surface-2/60 lg:block">
        <SidebarContent />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 animate-fade-in bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 border-r border-line bg-surface-2 shadow-pop">
            <button
              type="button"
              className="absolute top-3 right-3 rounded-md p-1 text-muted hover:text-fg"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
            >
              <X className="size-4" />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 items-center gap-3 border-b border-line bg-surface px-4 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-md p-1 text-muted hover:text-fg"
            aria-label="Open menu"
          >
            <MenuIcon className="size-5" />
          </button>
          <Logo />
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center">
                <span className="size-5 animate-spin rounded-full border-2 border-line border-t-accent" />
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  )
}
