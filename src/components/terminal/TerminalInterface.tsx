import React, { useEffect, useRef, useState, useCallback } from 'react';
import { XtermView, XtermRef } from './XtermView';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Terminal as TerminalIcon, Settings as SettingsIcon, Shield, Code, UserCheck, Cpu, Copy, Folder, Share2, Loader2, Zap } from 'lucide-react';
import { TerminalSettings } from './TerminalSettings';
import { TerminalConfig, AgentType } from '@shared/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
interface TerminalInterfaceProps {
  terminalId: string;
  name: string;
  compact?: boolean;
}
const AgentIcon = ({ type, className }: { type: AgentType; className?: string }) => {
  switch (type) {
    case 'coder': return <Code className={className} />;
    case 'security': return <Shield className={className} />;
    case 'reviewer': return <UserCheck className={className} />;
    default: return <Cpu className={className} />;
  }
};
export function TerminalInterface({ terminalId, name, compact = false }: TerminalInterfaceProps) {
  const [status, setStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [config, setConfig] = useState<TerminalConfig | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [loadLevel, setLoadLevel] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const xtermRef = useRef<XtermRef>(null);
  const reconnectTimeoutRef = useRef<any>(null);
  const isMountedRef = useRef(true);
  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch(`/api/terminal/${terminalId}/config`);
      const result = await res.json();
      if (result.success) setConfig(result.data);
    } catch (e) {
      console.error('Failed to fetch config', e);
    }
  }, [terminalId]);
  useEffect(() => {
    isMountedRef.current = true;
    fetchConfig();
    // Load simulation jitter
    const interval = setInterval(() => {
      setLoadLevel(Math.floor(Math.random() * 100));
    }, 2000);
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/terminal/${terminalId}/connect`;
    const connect = () => {
      if (!isMountedRef.current || wsRef.current) return;
      setStatus('connecting');
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      ws.onopen = () => {
        if (!isMountedRef.current) return;
        setStatus('connected');
        setTimeout(() => xtermRef.current?.focus(), 100);
      };
      ws.onmessage = (event) => {
        if (!isMountedRef.current) return;
        xtermRef.current?.write(event.data);
      };
      ws.onclose = () => {
        if (!isMountedRef.current) return;
        wsRef.current = null;
        setStatus('error');
        reconnectTimeoutRef.current = setTimeout(connect, 3000);
      };
      ws.onerror = () => {
        if (!isMountedRef.current) return;
        wsRef.current = null;
        setStatus('error');
      };
    };
    connect();
    return () => {
      isMountedRef.current = false;
      clearInterval(interval);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [terminalId, fetchConfig]);
  const handleData = useCallback((data: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(data);
    }
  }, []);
  return (
    <div className={cn(
      "flex flex-col h-full bg-[#09090b]/40 backdrop-blur-md border border-border rounded-xl overflow-hidden transition-all duration-300",
      status === 'connected' ? "terminal-glow" : "opacity-60"
    )}>
      <div className={cn(
        "flex items-center justify-between bg-muted/20 border-b border-border transition-colors px-4 py-2"
      )}>
        <div className="flex items-center gap-3">
          <div className="relative">
            <AgentIcon type={config?.agentType || 'system'} className={cn("text-primary", compact ? "w-3.5 h-3.5" : "w-4 h-4")} />
            {status === 'connected' && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full animate-pulse" />
            )}
          </div>
          <div className="flex flex-col">
            <span className={cn("font-mono font-bold leading-none tracking-tight text-xs", status === 'connected' ? "text-primary" : "text-muted-foreground")}>
              {config?.name || name}
            </span>
            {!compact && <span className="text-[10px] text-muted-foreground/40 font-mono mt-1">{terminalId.slice(0, 8)}</span>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {!compact && (
            <div className="flex items-center gap-2 px-2 py-0.5 rounded bg-black/40 border border-white/5 font-mono text-[10px]">
              <span className="text-muted-foreground/40 uppercase">Load:</span>
              <span className={cn(loadLevel > 80 ? "text-amber-500" : "text-emerald-500")}>{loadLevel}%</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 ml-1 border-l border-border/50 pl-3">
            <div className={cn(
              "w-2 h-2 rounded-full",
              status === 'connected' ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-rose-500"
            )} />
            {!compact && (
              <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-primary" onClick={() => setIsSettingsOpen(true)}>
                <SettingsIcon className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>
      <div className="flex-1 min-h-0 bg-black/20 relative group">
        <XtermView ref={xtermRef} onData={handleData} className="h-full" />
        {status !== 'connected' && (
          <div className="absolute inset-0 z-10 bg-black/60 flex items-center justify-center backdrop-blur-[2px]">
             <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-5 h-5 text-primary animate-spin" />
                <span className="text-[10px] font-mono text-primary/80 uppercase tracking-widest">Awaiting Uplink...</span>
             </div>
          </div>
        )}
      </div>
      {config && (
        <TerminalSettings
          config={config}
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          onUpdate={(newConfig) => {
            setConfig(newConfig);
            xtermRef.current?.clear();
          }}
        />
      )}
    </div>
  );
}