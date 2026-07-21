import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { ArrowLeft, RotateCcw, Trash2, Send, Loader2, Sparkles, Server, BookOpen, Sliders, ChevronDown, ChevronRight } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useAdminPlayground } from '../../hooks/useAdminPlayground';

const BASE_SYSTEM_PROMPT = 'You are a model made by TimeMachine Engineering.';

function GlassPanel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-white/10 ${className}`}
      style={{
        background: 'linear-gradient(145deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      {children}
    </div>
  );
}

export default function AdminPlayground() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const pg = useAdminPlayground();
  const [input, setInput] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [skillsOpen, setSkillsOpen] = useState(true);
  const [mcpOpen, setMcpOpen] = useState(true);

  if (pg.loading) {
    return (
      <div className={`min-h-screen ${theme.background} ${theme.text} flex items-center justify-center`}>
        <div className="flex items-center gap-3 text-white/70">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Resolving admin access…</span>
        </div>
      </div>
    );
  }

  if (pg.notAdmin) {
    return (
      <div className={`min-h-screen ${theme.background} ${theme.text} flex items-center justify-center p-6`}>
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold mb-2">Not available</h1>
          <p className="text-white/50 mb-6">
            Your account isn't on the admin allow-list. Ask a dev to add your email to the
            <code className="mx-1 px-1.5 py-0.5 rounded bg-white/10 text-xs">ADMIN_EMAILS</code>
            Vercel env var.
          </p>
          <button
            onClick={() => navigate('/')}
            className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 transition-colors"
          >
            Back to app
          </button>
        </div>
      </div>
    );
  }

  const skillItems = pg.catalog.filter((c) => c.kind === 'skill');
  const mcpItems = pg.catalog.filter((c) => c.kind === 'mcp');

  const toggleSkill = (slug: string) => {
    const next = pg.config.enabledSkillSlugs.includes(slug)
      ? pg.config.enabledSkillSlugs.filter((s) => s !== slug)
      : [...pg.config.enabledSkillSlugs, slug];
    pg.setConfig({ enabledSkillSlugs: next });
  };

  const toggleMcp = (id: string) => {
    const next = pg.config.enabledMcpIds.includes(id)
      ? pg.config.enabledMcpIds.filter((m) => m !== id)
      : [...pg.config.enabledMcpIds, id];
    pg.setConfig({ enabledMcpIds: next });
  };

  const handleSend = () => {
    if (!input.trim() || pg.isStreaming) return;
    pg.sendMessage(input);
    setInput('');
  };

  const effectivePreview = `${BASE_SYSTEM_PROMPT}${pg.config.customSystemPrompt ? '\n\n' + pg.config.customSystemPrompt : ''}\n[+ enabled skill + tool guardrail blocks added server-side]`;

  return (
    <div className={`min-h-screen ${theme.background} ${theme.text} flex flex-col`}>
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-white/5 bg-black/20 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-sm"
            >
              <ArrowLeft className="w-4 h-4" /> App
            </button>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-300" />
              <h1 className="text-lg font-semibold tracking-tight">Admin Playground</h1>
              <span className="text-[10px] uppercase tracking-widest text-white/40 px-2 py-0.5 rounded-full border border-white/10">
                isolated · no other users affected
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={pg.resetToBase}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-sm"
              title="Clear custom system prompt — keeps only the base identity"
            >
              <RotateCcw className="w-4 h-4" /> Reset to base
            </button>
            <button
              onClick={pg.clearChat}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-sm"
            >
              <Trash2 className="w-4 h-4" /> Clear chat
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-7xl mx-auto w-full px-4 py-4 grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4">
        {/* Sidebar */}
        <aside className="space-y-4 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto pr-1 custom-scrollbar">
          {/* Persona preset */}
          <GlassPanel className="p-4">
            <label className="text-xs uppercase tracking-widest text-white/40">Persona preset</label>
            <select
              value=""
              onChange={(e) => e.target.value && pg.applyPreset(e.target.value)}
              className="mt-2 w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-400/50"
            >
              <option value="">Load a preset…</option>
              {pg.presets.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
            <p className="mt-2 text-xs text-white/40">
              Preset prompt is loaded into the editable system prompt below. Model and provider stay hidden.
            </p>
          </GlassPanel>

          {/* System prompt */}
          <GlassPanel className="p-4">
            <div className="flex items-center justify-between">
              <label className="text-xs uppercase tracking-widest text-white/40">System prompt (custom)</label>
              <button
                onClick={() => setShowPreview((v) => !v)}
                className="text-xs text-white/40 hover:text-white/70 flex items-center gap-1"
              >
                {showPreview ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                effective
              </button>
            </div>
            <div className="mt-2 text-xs text-white/40 border-l-2 border-purple-400/40 pl-2">
              <span className="text-white/50">Base (fixed):</span> {BASE_SYSTEM_PROMPT}
            </div>
            <textarea
              value={pg.config.customSystemPrompt}
              onChange={(e) => pg.setConfig({ customSystemPrompt: e.target.value })}
              placeholder="Optional persona / behaviour instructions appended after the base prompt…"
              rows={8}
              className="mt-2 w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-400/50 resize-y font-mono leading-relaxed"
            />
            {showPreview && (
              <pre className="mt-2 text-[11px] text-white/50 whitespace-pre-wrap bg-black/30 border border-white/5 rounded-lg p-2 max-h-40 overflow-y-auto">
                {effectivePreview}
              </pre>
            )}
          </GlassPanel>

          {/* Sliders */}
          <GlassPanel className="p-4 space-y-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-white/40">
              <Sliders className="w-3.5 h-3.5" /> Sampling
            </div>
            <div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/60">Temperature</span>
                <span className="text-purple-200 tabular-nums">{pg.config.temperature.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={2}
                step={0.05}
                value={pg.config.temperature}
                onChange={(e) => pg.setConfig({ temperature: parseFloat(e.target.value) })}
                className="w-full accent-purple-400 mt-1"
              />
            </div>
            <div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/60">Max tokens</span>
                <span className="text-purple-200 tabular-nums">{pg.config.maxTokens.toLocaleString()}</span>
              </div>
              <input
                type="range"
                min={256}
                max={200000}
                step={256}
                value={pg.config.maxTokens}
                onChange={(e) => pg.setConfig({ maxTokens: parseInt(e.target.value) })}
                className="w-full accent-purple-400 mt-1"
              />
            </div>
          </GlassPanel>

          {/* Skills */}
          <GlassPanel className="p-4">
            <button
              onClick={() => setSkillsOpen((v) => !v)}
              className="w-full flex items-center justify-between text-xs uppercase tracking-widest text-white/40"
            >
              <span className="flex items-center gap-2"><BookOpen className="w-3.5 h-3.5" /> Skills {skillItems.length > 0 && <span className="text-white/30 normal-case tracking-normal">({pg.config.enabledSkillSlugs.length}/{skillItems.length})</span>}</span>
              {skillsOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </button>
            {skillsOpen && (
              <div className="mt-3 space-y-1.5">
                {pg.catalogLoading ? (
                  <p className="text-xs text-white/30">Loading catalog…</p>
                ) : skillItems.length === 0 ? (
                  <p className="text-xs text-white/30">No skills in <code>flight_control_catalog</code>. Seed one in Supabase.</p>
                ) : (
                  skillItems.map((item) => {
                    const on = pg.config.enabledSkillSlugs.includes(item.slug);
                    return (
                      <button
                        key={item.id}
                        onClick={() => toggleSkill(item.slug)}
                        className={`w-full text-left px-2.5 py-2 rounded-lg border text-sm transition-colors ${on ? 'border-purple-400/50 bg-purple-500/10' : 'border-white/10 hover:bg-white/5'}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{item.name}</span>
                          <span className={`w-2.5 h-2.5 rounded-full ${on ? 'bg-purple-400' : 'bg-white/15'}`} />
                        </div>
                        <p className="text-xs text-white/40 mt-0.5">{item.description}</p>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </GlassPanel>

          {/* MCP */}
          <GlassPanel className="p-4">
            <button
              onClick={() => setMcpOpen((v) => !v)}
              className="w-full flex items-center justify-between text-xs uppercase tracking-widest text-white/40"
            >
              <span className="flex items-center gap-2"><Server className="w-3.5 h-3.5" /> MCP servers {mcpItems.length > 0 && <span className="text-white/30 normal-case tracking-normal">({pg.config.enabledMcpIds.length}/{mcpItems.length})</span>}</span>
              {mcpOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </button>
            {mcpOpen && (
              <div className="mt-3 space-y-1.5">
                {pg.catalogLoading ? (
                  <p className="text-xs text-white/30">Loading catalog…</p>
                ) : mcpItems.length === 0 ? (
                  <p className="text-xs text-white/30">No MCP servers published. Add one via the flight_controls migration.</p>
                ) : (
                  mcpItems.map((item) => {
                    const on = pg.config.enabledMcpIds.includes(item.id);
                    return (
                      <button
                        key={item.id}
                        onClick={() => toggleMcp(item.id)}
                        className={`w-full text-left px-2.5 py-2 rounded-lg border text-sm transition-colors ${on ? 'border-cyan-400/50 bg-cyan-500/10' : 'border-white/10 hover:bg-white/5'}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{item.name}</span>
                          <span className={`w-2.5 h-2.5 rounded-full ${on ? 'bg-cyan-400' : 'bg-white/15'}`} />
                        </div>
                        <p className="text-xs text-white/40 mt-0.5">{item.description}</p>
                        {item.mcp_allowed_tools?.length > 0 && (
                          <p className="text-[10px] text-white/30 mt-1">tools: {item.mcp_allowed_tools.join(', ')}</p>
                        )}
                      </button>
                    );
                  })
                )}
                <p className="text-[10px] text-white/30 pt-1">Tools run inline (auto-approved) — admins trust themselves.</p>
              </div>
            )}
          </GlassPanel>
        </aside>

        {/* Chat panel */}
        <main className="flex flex-col min-h-[60vh] lg:min-h-0 lg:max-h-[calc(100vh-7rem)]">
          <GlassPanel className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
              {pg.messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-white/40">
                  <Sparkles className="w-8 h-8 mb-3 text-purple-300/60" />
                  <p className="max-w-sm text-sm">
                    Send a message to test the current config. Base system prompt is the fixed
                    <span className="text-white/60"> TimeMachine Engineering</span> identity; nothing here is saved to
                    other users or memories. Config lives in the URL + your browser.
                  </p>
                </div>
              ) : (
                pg.messages.map((m) => (
                  <div key={m.id} className={`flex ${m.isAI ? 'justify-start' : 'justify-end'}`}>
                    <div
                      className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${m.isAI ? 'bg-white/5 border border-white/10' : 'bg-purple-500/20 border border-purple-400/30'}`}
                    >
                      {m.content ? (
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm, remarkBreaks, remarkMath]}
                          rehypePlugins={[rehypeKatex]}
                          components={{
                            a: ({ node, ...props }) => <a {...props} target="_blank" rel="noreferrer" />,
                            img: ({ node, ...props }) => <img {...props} className="rounded-lg max-w-full my-2" />,
                          }}
                        >
                          {m.content}
                        </ReactMarkdown>
                      ) : pg.isStreaming && m.isAI ? (
                        <span className="inline-flex items-center gap-2 text-white/50">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> {pg.status || 'thinking'}…
                        </span>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
              {pg.status && pg.isStreaming && (
                <div className="text-xs text-white/40 px-1">{pg.status}…</div>
              )}
              {pg.error && (
                <div className="text-xs text-red-400 px-1">⚠️ {pg.error}</div>
              )}
            </div>

            {/* Input */}
            <div className="border-t border-white/5 p-3 flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Message the playground model…"
                rows={1}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-purple-400/50 resize-none max-h-32"
              />
              {pg.isStreaming ? (
                <button
                  onClick={pg.cancel}
                  className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-sm flex items-center gap-2"
                >
                  Stop
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className="px-4 py-2.5 rounded-xl bg-purple-500/30 border border-purple-400/40 hover:bg-purple-500/40 disabled:opacity-40 text-sm flex items-center gap-2"
                >
                  <Send className="w-4 h-4" /> Send
                </button>
              )}
            </div>
          </GlassPanel>
        </main>
      </div>
    </div>
  );
}