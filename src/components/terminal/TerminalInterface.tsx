import React, { useEffect, useRef, useState, useCallback } from 'react';
import { XtermView, XtermRef } from './XtermView';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Terminal as TerminalIcon, Settings as SettingsIcon, Shield, Code, UserCheck, Cpu, Copy, Folder } from 'lucide-react';
import { TerminalSettings } from './TerminalSettings';
import { TerminalConfig, AgentType } from '@shared/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
interface TerminalInterfaceProps {
  terminalId: string;
  name: string;
  compact?: boolean;
}
const AgentIcon = ({ type }: { type: AgentType }) => {
  switch (type) {
    case 'coder': return <Code className="w-3 h-3" />;
    case 'security': return <Shield className="w-3 h-3" />;
    case 'reviewer': return <UserCheck className="w-3 h-3" />;
    default: return <Cpu className="w-3 h-3" />;
  }
};
export function TerminalInterface({ terminalId, name, compact = false }: TerminalInterfaceProps) {
  const [status, setStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [config, setConfig] = useState<TerminalConfig | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
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
      toast.success("Node ID copied");
    } catch (err) {
      toast.error("Clipboard blocked");
    }
  };
  return (
    <div className={cn(
      "flex flex-col h-full bg-black/40 backdrop-blur-sm border border-border rounded-lg overflow-hidden transition-all duration-300",
      status === 'connected' ? "terminal-glow" : "opacity-80"
    )}>
      <div className={cn(
        "flex items-center justify-between bg-muted/50 border-b border-border",
        compact ? "px-2 py-1" : "px-4 py-2"
      )}>
        <div className="flex items-center gap-2">
          <TerminalIcon className={cn("text-primary", compact ? "w-3 h-3" : "w-4 h-4")} />
          <div className="flex flex-col">
            <span className={cn("font-mono font-medium leading-none", compact ? "text-[10px]" : "text-sm")}>{config?.name || name}</span>
            {!compact && <span className="text-[10px] text-muted-foreground mt-0.5">{config?.id.slice(0, 8)}</span>}
          </div>
          {!compact && config?.cwd && (
            <div className="flex items-center gap-1.5 ml-3 bg-black/30 px-2 py-0.5 rounded border border-border/50">
              <Folder className="w-3 h-3 text-yellow-500" />
              <span className="text-[10px] font-mono text-muted-foreground">{config.cwd}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {!compact && config && (
            <Badge variant="outline" className="gap-1 h-6 border-primary/20 text-primary hidden sm:flex">
              <AgentIcon type={config.agentType} /> {config.agentType}
            </Badge>
          )}
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={copyId}>
            <Copy className="w-3 h-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsSettingsOpen(true)}>
            <SettingsIcon className="w-3 h-3" />
          </Button>
          <div className={cn("w-2 h-2 rounded-full", status === 'connected' ? "bg-emerald-500" : status === 'connecting' ? "bg-yellow-500 animate-pulse" : "bg-rose-500")} />
        </div>
      </div>
      <div className="flex-1 min-h-0 bg-[#09090b]">
        <XtermView ref={xtermRef} onData={handleData} className="h-full" />
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