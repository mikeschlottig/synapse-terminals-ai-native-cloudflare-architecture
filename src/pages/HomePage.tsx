import React, { useState } from 'react';
import { TerminalInterface } from '@/components/terminal/TerminalInterface';
import { Button } from '@/components/ui/button';
import { Plus, Terminal as TermIcon, Layers, Settings, LogOut, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Toaster, toast } from 'sonner';
interface TerminalSession {
  id: string;
  name: string;
  type: 'agent' | 'system';
}
export function HomePage() {
  const [terminals, setTerminals] = useState<TerminalSession[]>([
    { id: 'default', name: 'Primary Terminal', type: 'system' }
  ]);
  const [activeId, setActiveId] = useState('default');
  const addTerminal = () => {
    const id = Math.random().toString(36).substring(7);
    const names = ['Nexus Agent', 'Data Scraper', 'Kernel Watcher', 'Auth Guard'];
    const name = names[Math.floor(Math.random() * names.length)] + `-${id.toUpperCase()}`;
    setTerminals(prev => [...prev, { id, name, type: 'agent' }]);
    setActiveId(id);
    toast.success(`Session ${name} initialized`);
  };
  const activeTerminal = terminals.find(t => t.id === activeId);
  return (
    <div className="flex h-screen w-full bg-[#09090b] text-foreground overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-black/20 flex flex-col">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-8 h-8 rounded bg-primary flex items-center justify-center">
              <Layers className="w-5 h-5 text-primary-foreground" />
            </div>
            <h1 className="font-display font-bold text-xl tracking-tight">SYNAPSE</h1>
          </div>
          <div className="space-y-1">
            <div className="text-2xs font-bold text-muted-foreground uppercase tracking-wider px-2 mb-2">Sessions</div>
            {terminals.map(t => (
              <button
                key={t.id}
                onClick={() => setActiveId(t.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-md transition-all group",
                  activeId === t.id 
                    ? "bg-primary/10 text-primary border border-primary/20" 
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground border border-transparent"
                )}
              >
                <TermIcon className={cn("w-4 h-4", activeId === t.id ? "text-primary" : "text-muted-foreground")} />
                <span className="text-sm font-medium truncate flex-1 text-left">{t.name}</span>
                {activeId === t.id && <ChevronRight className="w-3 h-3" />}
              </button>
            ))}
            <Button 
              variant="ghost" 
              className="w-full justify-start gap-3 mt-4 text-muted-foreground hover:text-primary"
              onClick={addTerminal}
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm">New Session</span>
            </Button>
          </div>
        </div>
        <div className="mt-auto p-6 space-y-1 border-t border-border">
          <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground" size="sm">
            <Settings className="w-4 h-4" /> <span>Settings</span>
          </Button>
          <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground" size="sm">
            <LogOut className="w-4 h-4" /> <span>Exit Node</span>
          </Button>
        </div>
      </aside>
      {/* Main Viewport */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#020617]">
        <header className="h-14 border-b border-border flex items-center px-8 bg-black/10 backdrop-blur-sm">
          <div className="flex items-center gap-4 text-sm">
            <span className="text-muted-foreground">Location:</span>
            <code className="text-primary bg-primary/5 px-2 py-0.5 rounded">/root/synapse/{activeTerminal?.name.toLowerCase().replace(/\s/g, '-')}</code>
          </div>
        </header>
        <div className="flex-1 p-8 overflow-hidden">
          {activeTerminal ? (
            <TerminalInterface 
              key={activeTerminal.id} 
              terminalId={activeTerminal.id} 
              name={activeTerminal.name} 
            />
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground italic">
              Select or create a session to begin.
            </div>
          )}
        </div>
        <footer className="h-10 border-t border-border bg-black/20 flex items-center justify-between px-8 text-2xs text-muted-foreground font-mono">
          <div className="flex gap-6">
            <span>Uptime: 24:02:11</span>
            <span>Latency: 14ms</span>
          </div>
          <div className="flex gap-6">
            <span>Protocol: Syn-V3</span>
            <span>Region: Earth-Primary</span>
          </div>
        </footer>
      </main>
      <Toaster position="bottom-right" theme="dark" richColors />
    </div>
  );
}