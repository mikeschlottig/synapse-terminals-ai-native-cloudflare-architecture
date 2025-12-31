import React, { useEffect, useRef, useState, useCallback } from 'react';
import { XtermView, XtermRef } from './XtermView';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Terminal as TerminalIcon, Wifi, WifiOff, Settings as SettingsIcon, Shield, Code, UserCheck, Cpu, Copy } from 'lucide-react';
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
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
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
        if (!reconnectTimeoutRef.current) {
          reconnectTimeoutRef.current = setTimeout(connect, 3000);
        }
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
  const copyId = () => {
    navigator.clipboard.writeText(terminalId);
    toast.success("Node ID copied to clipboard");
  };
  return (
    <div className={cn(
      "flex flex-col h-full bg-black/40 backdrop-blur-sm border border-border rounded-lg overflow-hidden transition-all duration-300",
      status === 'connected' ? "terminal-glow" : "opacity-80 shadow-none border-dashed"
    )}>
      <div className={cn(
        "flex items-center justify-between bg-muted/50 border-b border-border",
        compact ? "px-3 py-1.5" : "px-4 py-2"
      )}>
        <div className="flex items-center gap-3">
          <TerminalIcon className={cn("text-primary", compact ? "w-3 h-3" : "w-4 h-4")} />
          <div className="flex flex-col">
            <span className={cn("font-mono font-medium leading-none", compact ? "text-xs" : "text-sm")}>{config?.name || name}</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-tighter mt-0.5">{config?.agentType || 'system'}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {!compact && config && (
            <Badge variant="outline" className="gap-1 h-6 border-primary/20 bg-primary/5 text-primary">
              <AgentIcon type={config.agentType} /> {config.agentType}
            </Badge>
          )}
          <div className="h-4 w-px bg-border mx-1" />
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={copyId} title="Copy ID">
            <Copy className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => setIsSettingsOpen(true)}>
            <SettingsIcon className="w-3.5 h-3.5" />
          </Button>
          {status === 'connecting' && <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse ml-2" />}
          {status === 'connected' && <div className="w-2 h-2 rounded-full bg-emerald-500 ml-2" />}
          {status === 'error' && <div className="w-2 h-2 rounded-full bg-rose-500 ml-2" />}
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