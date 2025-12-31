import React, { useEffect, useRef, useState, useCallback } from 'react';
import { XtermView, XtermRef } from './XtermView';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Terminal as TerminalIcon, Settings as SettingsIcon, Shield, Code, UserCheck, Cpu, Copy, Folder, Share2, Loader2 } from 'lucide-react';
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
  const [routing, setRouting] = useState(false);
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
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/api/terminal/${terminalId}/connect`;
    const connect = () => {
      if (!isMountedRef.current || wsRef.current) return;
      setStatus('connecting');
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      ws.onopen = () => {
        if (!isMountedRef.current) return;
        setStatus('connected');
        xtermRef.current?.focus();
      };
      ws.onmessage = (event) => {
        if (!isMountedRef.current) return;
        const data = event.data as string;
        if (data.includes('[ROUTING]')) setRouting(true);
        if (data.includes('[REMOTE]')) setRouting(false);
        xtermRef.current?.write(data);
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
  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(terminalId);
      toast.success("Node ID copied to matrix");
    } catch (err) {
      toast.error("Clipboard blocked");
    }
  };
  return (
    <div className={cn(
      "flex flex-col h-full bg-[#09090b]/40 backdrop-blur-md border border-border rounded-xl overflow-hidden transition-all duration-500",
      status === 'connected' ? "terminal-glow" : "opacity-60 grayscale-[0.5]"
    )}>
      <div className={cn(
        "flex items-center justify-between bg-muted/30 border-b border-border transition-colors",
        compact ? "px-2.5 py-1.5" : "px-4 py-2.5",
        routing && "bg-primary/5"
      )}>
        <div className="flex items-center gap-3">
          <div className="relative">
            <AgentIcon type={config?.agentType || 'system'} className={cn("text-primary", compact ? "w-3.5 h-3.5" : "w-4 h-4")} />
            {routing && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full animate-ping" />
            )}
          </div>
          <div className="flex flex-col">
            <span className={cn("font-mono font-bold leading-none tracking-tight", compact ? "text-[10px]" : "text-sm text-primary/90")}>
              {config?.name || name}
            </span>
            {!compact && <span className="text-[10px] text-muted-foreground/60 font-mono mt-1">{config?.id.slice(0, 8)}</span>}
          </div>
          {!compact && config?.cwd && (
            <div className="hidden lg:flex items-center gap-2 ml-4 bg-black/40 px-2 py-1 rounded border border-white/5 group transition-colors hover:border-primary/20">
              <Folder className="w-3 h-3 text-yellow-500/80" />
              <span className="text-[10px] font-mono text-muted-foreground/80">{config.cwd}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          {routing && !compact && (
            <Badge variant="outline" className="h-6 gap-1.5 border-primary/30 text-primary animate-pulse mr-2">
              <Share2 className="w-3 h-3" /> Routing
            </Badge>
          )}
          {!compact && (
            <>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary transition-colors" onClick={copyId}>
                <Copy className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary transition-colors" onClick={() => setIsSettingsOpen(true)}>
                <SettingsIcon className="w-3.5 h-3.5" />
              </Button>
            </>
          )}
          <div className="flex items-center gap-2 ml-2 pl-2 border-l border-border/50">
            {status === 'connecting' && <Loader2 className="w-3 h-3 text-yellow-500 animate-spin" />}
            <div className={cn(
              "w-2 h-2 rounded-full",
              status === 'connected' ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : 
              status === 'connecting' ? "bg-yellow-500 animate-pulse" : 
              "bg-rose-500"
            )} />
          </div>
        </div>
      </div>
      <div className="flex-1 min-h-0 bg-[#09090b]/80 relative group">
        <XtermView ref={xtermRef} onData={handleData} className="h-full" />
        {status !== 'connected' && (
          <div className="absolute inset-0 z-10 bg-black/40 flex items-center justify-center backdrop-blur-[1px]">
             <span className="text-xs font-mono text-muted-foreground animate-pulse">Establishing Secure Uplink...</span>
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