import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { TerminalInterface } from '@/components/terminal/TerminalInterface';
import { CommandPalette } from '@/components/terminal/CommandPalette';
import { Button } from '@/components/ui/button';
import { Plus, Layers, Settings, ChevronRight, Code, Shield, UserCheck, Cpu, LayoutGrid, Square, Activity, Wifi, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Toaster, toast } from 'sonner';
import { AgentType, MeshStats, MeshNode } from '@shared/types';
import { motion, AnimatePresence } from 'framer-motion';
interface TerminalSession {
  id: string;
  name: string;
  type: AgentType;
}
const RoleIcon = ({ type, className }: { type: AgentType; className?: string }) => {
  switch (type) {
    case 'coder': return <Code className={className} />;
    case 'security': return <Shield className={className} />;
    case 'reviewer': return <UserCheck className={className} />;
    default: return <Cpu className={className} />;
  }
};
const MeshTelemetry = ({ stats }: { stats: MeshStats }) => (
  <div className="p-4 bg-primary/5 border border-primary/10 rounded-lg space-y-3 mx-2">
    <div className="flex items-center gap-2 text-primary">
      <Activity className="w-4 h-4" />
      <span className="text-[10px] font-bold uppercase tracking-tighter">Mesh Telemetry</span>
    </div>
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-1">
        <p className="text-[9px] text-muted-foreground uppercase">Integrity</p>
        <p className="text-sm font-mono text-emerald-500">{stats.systemHealth.toFixed(1)}%</p>
      </div>
      <div className="space-y-1">
        <p className="text-[9px] text-muted-foreground uppercase">Avg Latency</p>
        <p className="text-sm font-mono text-primary">{stats.avgLatency}ms</p>
      </div>
    </div>
    <div className="w-full h-1 bg-black/40 rounded-full overflow-hidden">
      <motion.div
        className="h-full bg-primary"
        initial={{ width: '0%' }}
        animate={{ width: `${stats.systemHealth}%` }}
        transition={{ duration: 1 }}
      />
    </div>
  </div>
);
export function HomePage() {
  const [terminals, setTerminals] = useState<TerminalSession[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [viewMode, setViewMode] = useState<'focus' | 'mesh'>('focus');
  const [isLoading, setIsLoading] = useState(true);
  // Persistence: Fetch registry on mount
  useEffect(() => {
    const fetchNodes = async () => {
      try {
        const res = await fetch('/api/mesh/nodes');
        const result = await res.json();
        if (result.success && result.data.length > 0) {
          const sessions: TerminalSession[] = result.data.map((n: MeshNode) => ({
            id: n.id,
            name: n.name,
            type: n.type
          }));
          setTerminals(sessions);
          setActiveId(sessions[0].id);
        } else if (result.success) {
          // Initialize with one default if registry is empty
          const defaultNode = { id: 'primary', name: 'CoreNode-PRIMARY', type: 'system' as const };
          setTerminals([defaultNode]);
          setActiveId('primary');
          registerNode(defaultNode.id, defaultNode.name, defaultNode.type);
        }
      } catch (e) {
        console.error('Failed to sync mesh registry', e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchNodes();
  }, []);
  const registerNode = async (id: string, name: string, type: AgentType) => {
    try {
      await fetch('/api/mesh/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name, type })
      });
    } catch (e) {
      console.error('Registry update failed', e);
    }
  };
  const addTerminal = useCallback((type: AgentType = 'system') => {
    const id = Math.random().toString(36).substring(7);
    const prefixes = { coder: 'DevNode', reviewer: 'AuditNode', security: 'GuardNode', system: 'CoreNode' };
    const name = `${prefixes[type]}-${id.toUpperCase()}`;
    const newSession = { id, name, type };
    setTerminals(prev => [...prev, newSession]);
    setActiveId(id);
    registerNode(id, name, type);
    toast.success(`Node Spawned`, { description: `Agent ${name} is now part of the mesh.` });
  }, []);
  const stats: MeshStats = useMemo(() => {
    const loadFactor = Math.min(terminals.length * 5, 40);
    return {
      totalNodes: terminals.length,
      activeConnections: terminals.length * 2,
      avgLatency: 12 + Math.floor(Math.random() * 8),
      systemHealth: 100 - (loadFactor / 10) - (Math.random() * 0.5)
    };
  }, [terminals.length]);
  const activeTerminal = terminals.find(t => t.id === activeId);
  return (
    <div className="flex h-screen w-full bg-[#09090b] text-foreground overflow-hidden font-sans">
      <aside className="w-64 border-r border-border bg-black/40 flex flex-col z-30">
        <div className="p-6 flex-1 overflow-hidden flex flex-col">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-8 h-8 rounded bg-primary flex items-center justify-center shadow-primary">
              <Zap className="w-5 h-5 text-primary-foreground fill-current" />
            </div>
            <h1 className="font-display font-bold text-xl tracking-tight">SYNAPSE</h1>
          </div>
          <div className="flex items-center justify-between px-2 mb-2">
            <div className="text-2xs font-bold text-muted-foreground uppercase tracking-wider">Mesh Registry</div>
            <Button variant="ghost" size="icon" className="h-5 w-5 hover:text-primary" onClick={() => addTerminal('system')}>
              <Plus className="h-3 w-3" />
            </Button>
          </div>
          <div className="flex-1 space-y-1 overflow-y-auto pr-2 custom-scrollbar">
            {isLoading ? (
              <div className="flex flex-col gap-2 opacity-20">
                {[1, 2, 3].map(i => <div key={i} className="h-9 w-full bg-muted rounded animate-pulse" />)}
              </div>
            ) : terminals.map(t => (
              <button
                key={t.id}
                onClick={() => { setActiveId(t.id); setViewMode('focus'); }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-md transition-all border group",
                  activeId === t.id && viewMode === 'focus'
                    ? "bg-primary/10 text-primary border-primary/20"
                    : "text-muted-foreground hover:bg-muted/30 border-transparent"
                )}
              >
                <RoleIcon type={t.type} className={cn("w-4 h-4", activeId === t.id ? "text-primary" : "text-muted-foreground")} />
                <span className="text-xs font-medium truncate flex-1 text-left">{t.name}</span>
                <Wifi className={cn("w-2.5 h-2.5 transition-opacity", activeId === t.id ? "opacity-100 text-primary" : "opacity-0 group-hover:opacity-40")} />
              </button>
            ))}
          </div>
          <div className="mt-4">
            <MeshTelemetry stats={stats} />
          </div>
        </div>
        <div className="p-6 space-y-1 border-t border-border bg-black/60">
          <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground text-xs" size="sm">
            <Settings className="w-4 h-4" /> <span>Registry Settings</span>
          </Button>
          <div className="text-[9px] text-muted-foreground/40 px-3 pt-2 font-mono uppercase">System 1.4.2 // US-EAST</div>
        </div>
      </aside>
      <main className="flex-1 flex flex-col min-w-0 bg-[#020617] relative">
        <header className="h-14 border-b border-border flex items-center px-8 bg-black/20 backdrop-blur-md justify-between z-20">
          <div className="flex items-center gap-4 text-sm">
            <span className="text-muted-foreground">Path:</span>
            <code className="text-primary bg-primary/5 px-2 py-0.5 rounded flex items-center gap-2 font-mono text-xs">
              <RoleIcon type={viewMode === 'mesh' ? 'system' : (activeTerminal?.type || 'system')} className="w-3 h-3" />
              /synapse/{viewMode === 'mesh' ? 'all' : activeTerminal?.name.toLowerCase()}
            </code>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className={cn("h-8 gap-2 bg-transparent border-border hover:bg-muted/50 transition-all", viewMode === 'mesh' && "bg-primary/10 border-primary/40 text-primary")}
              onClick={() => setViewMode(v => v === 'focus' ? 'mesh' : 'focus')}
            >
              {viewMode === 'focus' ? <LayoutGrid className="w-4 h-4" /> : <Square className="w-4 h-4" />}
              <span className="text-[10px] uppercase font-bold tracking-widest">{viewMode === 'focus' ? 'Switch to Mesh' : 'Back to Focus'}</span>
            </Button>
          </div>
        </header>
        <div className="flex-1 overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full">
            <div className="py-8 md:py-10 lg:py-12 h-full">
              <AnimatePresence mode="wait">
                {viewMode === 'focus' ? (
                  <motion.div
                    key="focus-view"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    className="h-full"
                  >
                    {activeTerminal ? (
                      <TerminalInterface
                        key={activeTerminal.id}
                        terminalId={activeTerminal.id}
                        name={activeTerminal.name}
                      />
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-muted-foreground border border-dashed border-border rounded-lg bg-black/20">
                        <Layers className="w-12 h-12 mb-4 opacity-10" />
                        <p className="text-sm font-medium">Select a node to begin uplink.</p>
                      </div>
                    )}
                  </motion.div>
                ) : (
                  <motion.div
                    key="mesh-grid"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 h-full overflow-y-auto pr-2 pb-4 custom-scrollbar"
                  >
                    {terminals.map((t, idx) => (
                      <motion.div
                        key={t.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.04 }}
                        className="h-[350px]"
                      >
                        <TerminalInterface terminalId={t.id} name={t.name} compact />
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
        <footer className="h-10 border-t border-border bg-black/40 flex items-center justify-between px-8 text-[10px] text-muted-foreground font-mono z-20 uppercase tracking-widest">
          <div className="flex gap-6">
            <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-glow" /> NETWORK_READY</span>
            <span>ACTIVE_NODES: {terminals.length}</span>
            <span className="hidden sm:inline">MESH_INTEGRITY: OPTIMAL</span>
          </div>
          <div className="flex gap-4">
            <span className="text-primary/60">SYSTEM_TIME: {new Date().toLocaleTimeString()}</span>
          </div>
        </footer>
      </main>
      <CommandPalette
        onAddTerminal={addTerminal}
        onSwitchTerminal={(id) => { setActiveId(id); setViewMode('focus'); }}
        onToggleView={setViewMode}
        onClearCurrent={() => toast.info("Active buffer purged")}
        terminals={terminals}
      />
      <Toaster position="bottom-right" theme="dark" richColors closeButton />
    </div>
  );
}