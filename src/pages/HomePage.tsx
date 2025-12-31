import React, { useState } from 'react';
import { TerminalInterface } from '@/components/terminal/TerminalInterface';
import { Button } from '@/components/ui/button';
import { Plus, Terminal as TermIcon, Layers, Settings, LogOut, ChevronRight, Code, Shield, UserCheck, Cpu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Toaster, toast } from 'sonner';
import { AgentType } from '@shared/types';
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
export function HomePage() {
  const [terminals, setTerminals] = useState<TerminalSession[]>([
    { id: 'default', name: 'Primary Terminal', type: 'system' }
  ]);
  const [activeId, setActiveId] = useState('default');
  const addTerminal = (type: AgentType = 'system') => {
    const id = Math.random().toString(36).substring(7);
    const prefixes = {
      coder: 'DevNode',
      reviewer: 'AuditNode',
      security: 'GuardNode',
      system: 'CoreNode'
    };
    const name = `${prefixes[type]}-${id.toUpperCase()}`;
    setTerminals(prev => [...prev, { id, name, type }]);
    setActiveId(id);
    toast.success(`${type.toUpperCase()} Agent session initialized`, {
      description: `Node: ${name}`
    });
  };
  const activeTerminal = terminals.find(t => t.id === activeId);
  return (
    <div className="flex h-screen w-full bg-[#09090b] text-foreground overflow-hidden font-sans">
      <aside className="w-64 border-r border-border bg-black/20 flex flex-col">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-8 h-8 rounded bg-primary flex items-center justify-center shadow-primary">
              <Layers className="w-5 h-5 text-primary-foreground" />
            </div>
            <h1 className="font-display font-bold text-xl tracking-tight">SYNAPSE</h1>
          </div>
          <div className="space-y-1">
            <div className="text-2xs font-bold text-muted-foreground uppercase tracking-wider px-2 mb-2">Active Mesh</div>
            {terminals.map(t => (
              <button
                key={t.id}
                onClick={() => setActiveId(t.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-md transition-all group border",
                  activeId === t.id
                    ? "bg-primary/10 text-primary border-primary/20"
                    : "text-muted-foreground hover:bg-muted/30 border-transparent"
                )}
              >
                <RoleIcon type={t.type} className={cn("w-4 h-4", activeId === t.id ? "text-primary" : "text-muted-foreground")} />
                <span className="text-sm font-medium truncate flex-1 text-left">{t.name}</span>
                {activeId === t.id && <ChevronRight className="w-3 h-3" />}
              </button>
            ))}
            <div className="pt-4 grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" className="h-8 text-2xs gap-1 border-dashed" onClick={() => addTerminal('coder')}>
                <Code className="w-3 h-3" /> +Coder
              </Button>
              <Button variant="outline" size="sm" className="h-8 text-2xs gap-1 border-dashed" onClick={() => addTerminal('security')}>
                <Shield className="w-3 h-3" /> +Sec
              </Button>
            </div>
          </div>
        </div>
        <div className="mt-auto p-6 space-y-1 border-t border-border">
          <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground" size="sm">
            <Settings className="w-4 h-4" /> <span>Global Settings</span>
          </Button>
          <Button variant="ghost" className="w-full justify-start gap-3 text-destructive/80 hover:text-destructive" size="sm">
            <LogOut className="w-4 h-4" /> <span>Terminate App</span>
          </Button>
        </div>
      </aside>
      <main className="flex-1 flex flex-col min-w-0 bg-[#020617]">
        <header className="h-14 border-b border-border flex items-center px-8 bg-black/10 backdrop-blur-sm justify-between">
          <div className="flex items-center gap-4 text-sm">
            <span className="text-muted-foreground">Path:</span>
            <code className="text-primary bg-primary/5 px-2 py-0.5 rounded flex items-center gap-2">
              <RoleIcon type={activeTerminal?.type || 'system'} className="w-3 h-3" />
              /mesh/{activeTerminal?.type}/{activeTerminal?.name.toLowerCase()}
            </code>
          </div>
          <div className="text-[10px] text-muted-foreground font-mono">
            NODE_ID: {activeTerminal?.id.toUpperCase()}
          </div>
        </header>
        <div className="flex-1 p-6 overflow-hidden">
          {activeTerminal ? (
            <TerminalInterface
              key={activeTerminal.id}
              terminalId={activeTerminal.id}
              name={activeTerminal.name}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground italic border border-dashed border-border rounded-lg">
              Initialize a mesh node to begin communication.
            </div>
          )}
        </div>
        <footer className="h-10 border-t border-border bg-black/20 flex items-center justify-between px-8 text-2xs text-muted-foreground font-mono">
          <div className="flex gap-6">
            <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> GRID_STABLE</span>
            <span>LATENCY: 14ms</span>
          </div>
          <div className="flex gap-6">
            <span>MESH_PROTOCOL: Syn-V3</span>
            <span>CELL: Earth-Primary-01</span>
          </div>
        </footer>
      </main>
      <Toaster position="bottom-right" theme="dark" richColors />
    </div>
  );
}