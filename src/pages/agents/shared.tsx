import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, FileText, Sparkles } from "lucide-react";
import { agentsApi, templatesApi } from "@/api/endpoints";
import { qk, useAgentTemplates, useLanguageOptions } from "@/api/queries";
import type { AgentOut, AgentStatus } from "@/api/types";
import { cn } from "@/lib/utils";
import { languageLabel } from "@/lib/languages";
import { Badge, Segmented } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import {
  Field,
  Input,
  SearchableSelect,
  Select,
  Textarea,
} from "@/components/ui/input";
import { Modal } from "@/components/ui/overlay";
import { CHANNELS, REGIONS, timezones, toastError } from "./helpers";

export function StatusBadge({ status }: { status: AgentStatus }) {
  return (
    <Badge tone={status === "active" ? "success" : "neutral"} dot>
      {status === "active" ? "Active" : "Inactive"}
    </Badge>
  );
}

const gradients = [
  "from-indigo-500 to-violet-500",
  "from-sky-500 to-indigo-500",
  "from-emerald-500 to-teal-500",
  "from-amber-500 to-orange-500",
  "from-rose-500 to-pink-500",
  "from-fuchsia-500 to-purple-500",
];

export function AgentAvatar({
  id,
  name,
  className,
}: {
  id: string;
  name: string;
  className?: string;
}) {
  let h = 0;
  for (const ch of id) h = (h * 33 + ch.charCodeAt(0)) >>> 0;
  return (
    <div
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-[13px] font-semibold text-white shadow-card",
        gradients[h % gradients.length],
        className,
      )}
    >
      {name.match(/[\p{L}\p{N}]/u)?.[0]?.toUpperCase() ?? "A"}
    </div>
  );
}

export function ChannelPicker({
  value,
  onChange,
  disabled,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {CHANNELS.map((c) => {
        const on = value.includes(c.value);
        return (
          <button
            key={c.value}
            type="button"
            disabled={disabled}
            onClick={() =>
              onChange(
                on ? value.filter((v) => v !== c.value) : [...value, c.value],
              )
            }
            className={cn(
              "flex items-start gap-2.5 rounded-lg border p-3 text-left transition-colors disabled:cursor-not-allowed",
              on
                ? "border-accent bg-accent-soft/60"
                : "border-line hover:bg-surface-2",
            )}
          >
            <c.icon
              className={cn("mt-0.5 size-4", on ? "text-accent" : "text-muted")}
            />
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium">{c.label}</div>
              <div className="text-xs text-muted">{c.hint}</div>
            </div>
            <span
              className={cn(
                "flex size-4 items-center justify-center rounded border",
                on
                  ? "border-accent bg-accent text-accent-fg"
                  : "border-line-strong",
              )}
            >
              {on && <Check className="size-3" />}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function LanguagePicker({
  value,
  onChange,
  disabled,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  disabled?: boolean;
}) {
  const { data: options = [] } = useLanguageOptions();
  const names = useMemo(
    () => new Map(options.map((l) => [l.code, l.name])),
    [options],
  );
  // Keep already-configured codes visible even if they're not in the offered list.
  const all = useMemo(
    () => [...new Set([...value, ...options.map((l) => l.code)])],
    [value, options],
  );
  return (
    <div className="flex flex-wrap gap-1.5">
      {all.map((code) => {
        const on = value.includes(code);
        return (
          <button
            key={code}
            type="button"
            disabled={disabled || (on && value.length === 1)}
            title={
              on && value.length === 1
                ? "An agent needs at least one language"
                : undefined
            }
            onClick={() =>
              onChange(on ? value.filter((v) => v !== code) : [...value, code])
            }
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs transition-colors disabled:cursor-not-allowed",
              on
                ? "border-accent bg-accent-soft text-accent"
                : "border-line text-muted hover:bg-surface-2 hover:text-fg",
              disabled && !on && "opacity-50",
            )}
          >
            {on && <Check className="size-3" />}
            {names.get(code) ?? languageLabel(code)}
            <span className="font-mono text-[10px] opacity-70">{code}</span>
          </button>
        );
      })}
    </div>
  );
}

export function CreateAgentModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const tzs = useMemo(() => timezones(), []);
  const [mode, setMode] = useState<"scratch" | "template">("scratch");
  const [templateKey, setTemplateKey] = useState<string | null>(null);
  const templates = useAgentTemplates(open && mode === "template");
  const selectedTemplate =
    templates.data?.find((t) => t.key === templateKey) ?? null;
  const [form, setForm] = useState({
    name: "",
    description: "",
    region: "asia",
    timezone: "Asia/Kolkata",
    bot_type: ["voice"] as string[],
    languages: ["en-IN"] as string[],
  });

  const create = useMutation({
    mutationFn: async () => {
      if (mode === "template" && templateKey) {
        return templatesApi.createAgent(templateKey, {
          name: form.name.trim() || null,
          description: form.description.trim() || null,
        });
      }
      const agent = await agentsApi.create({
        name: form.name.trim(),
        description: form.description.trim() || null,
        region: form.region.trim() || "asia",
        timezone: form.timezone,
        bot_type: form.bot_type,
      });
      // POST /agents always creates English-only; apply the chosen set after.
      const langs = [...form.languages].sort();
      if (
        JSON.stringify(langs) !== JSON.stringify([...agent.languages].sort())
      ) {
        try {
          return await agentsApi.setLanguages(agent.id, form.languages);
        } catch (e) {
          toastError(e, "Agent created, but languages could not be saved");
        }
      }
      return agent as AgentOut;
    },
    onSuccess: (agent) => {
      void qc.invalidateQueries({ queryKey: qk.agents });
      toast.success("Agent created", { description: agent.agent_details.name });
      onOpenChange(false);
      setForm((f) => ({ ...f, name: "", description: "" }));
      setMode("scratch");
      setTemplateKey(null);
      navigate(`/agents/${agent.id}`);
    },
    onError: (e) => toastError(e, "Could not create agent"),
  });

  const valid =
    mode === "template"
      ? Boolean(templateKey)
      : form.name.trim().length > 0 &&
        form.bot_type.length > 0 &&
        form.languages.length > 0;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title="Create agent"
      description={
        mode === "template"
          ? "Start from a ready-made use case with the prompt, FAQ and variables already filled in."
          : "Start with the basics. Prompt, model, voice and tools are configured in the builder next."
      }
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!valid}
            loading={create.isPending}
            onClick={() => create.mutate()}
          >
            Create agent
          </Button>
        </>
      }
    >
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) create.mutate();
        }}
      >
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            {
              value: "scratch",
              label: (
                <>
                  <FileText /> Start from scratch
                </>
              ),
            },
            {
              value: "template",
              label: (
                <>
                  <Sparkles /> Use a template
                </>
              ),
            },
          ]}
        />
        {mode === "template" && (
          <div className="space-y-2">
            {templates.isPending && (
              <p className="text-xs text-muted">Loading templates…</p>
            )}
            {templates.isError && (
              <p className="text-xs text-danger">Could not load templates.</p>
            )}
            <div className="grid gap-2 sm:grid-cols-2">
              {templates.data?.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTemplateKey(t.key)}
                  aria-pressed={templateKey === t.key}
                  className={cn(
                    "rounded-xl border p-3 text-left transition-colors",
                    templateKey === t.key
                      ? "border-accent bg-accent-soft/50"
                      : "border-line hover:bg-surface-2",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-medium">{t.name}</span>
                    {templateKey === t.key && (
                      <Check className="size-4 text-accent" />
                    )}
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted">
                    {t.category} · {t.direction}
                  </div>
                  <p className="mt-1.5 text-xs text-muted">{t.description}</p>
                </button>
              ))}
            </div>
            {selectedTemplate && (
              <p className="rounded-lg border border-line bg-surface-2/60 px-3 py-2 text-xs text-muted">
                Templates are starter drafts. Review the prompt and get
                Legal/Compliance sign-off before using it in production.
              </p>
            )}
          </div>
        )}
        <Field
          label="Name"
          htmlFor="agent-name"
          hint={
            mode === "template"
              ? "Optional — defaults to the template name."
              : undefined
          }
        >
          <Input
            id="agent-name"
            autoFocus
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder={
              selectedTemplate?.name ?? "e.g. Loan collections — Hindi"
            }
          />
        </Field>
        <Field
          label="Description"
          hint="Optional. Helps teammates understand what this agent is for."
        >
          <Textarea
            rows={2}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="What does this agent do?"
          />
        </Field>
        {mode === "scratch" && (
          <>
            <Field label="Channels">
              <ChannelPicker
                value={form.bot_type}
                onChange={(bot_type) => setForm({ ...form, bot_type })}
              />
            </Field>
            <Field
              label="Languages"
              hint="Codes offered by the configured speech and LLM providers."
            >
              <LanguagePicker
                value={form.languages}
                onChange={(languages) => setForm({ ...form, languages })}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Region" hint="Deployment region the agent runs in.">
                <Select
                  value={form.region}
                  onChange={(e) => setForm({ ...form, region: e.target.value })}
                >
                  {!REGIONS.some((r) => r.value === form.region) && (
                    <option value={form.region}>{form.region}</option>
                  )}
                  {REGIONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Timezone">
                <SearchableSelect
                  value={form.timezone}
                  onChange={(timezone) => setForm({ ...form, timezone })}
                  options={tzs}
                />
              </Field>
            </div>
          </>
        )}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
