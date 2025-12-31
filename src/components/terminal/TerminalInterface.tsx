import React, { useEffect, useRef, useState, useCallback } from 'react';
import { XtermView, XtermRef } from './XtermView';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Terminal as TerminalIcon, Wifi, WifiOff, Settings as SettingsIcon, Shield, Code, UserCheck, Cpu } from 'lucide-react';
import { TerminalSettings } from './TerminalSettings';
import { TerminalConfig, AgentType } from '@shared/types';
interface TerminalInterfaceProps {
  terminalId: string;
  name: string;
}
const AgentIcon = ({ type }: { type: AgentType }) => {
  switch (type) {
    case 'coder': return <Code className="w-3 h-3" />;
    case 'security': return <Shield className="w-3 h-3" />;
    case 'reviewer': return <UserCheck className="w-3 h-3" />;
    default: return <Cpu className="w-3 h-3" />;
  }
};
export function TerminalInterface({ terminalId, name }: TerminalInterfaceProps) {
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
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
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
    <div className="flex flex-col h-full bg-black/40 backdrop-blur-sm border border-border rounded-lg overflow-hidden terminal-glow">
      <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b border-border">
        <div className="flex items-center gap-3">
          <TerminalIcon className="w-4 h-4 text-primary" />
          <div className="flex flex-col">
            <span className="text-sm font-mono font-medium leading-none">{config?.name || name}</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-tighter mt-1">{config?.agentType || 'system'}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {config && (
            <Badge variant="outline" className="gap-1 h-6 border-primary/20 bg-primary/5 text-primary">
              <AgentIcon type={config.agentType} /> {config.agentType}
            </Badge>
          )}
          <div className="h-4 w-px bg-border mx-1" />
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => setIsSettingsOpen(true)}>
            <SettingsIcon className="w-4 h-4" />
          </Button>
          {status === 'connecting' && <Badge variant="outline" className="h-6 animate-pulse"><Loader2 className="w-3 h-3 animate-spin mr-1" /> Syncing</Badge>}
          {status === 'connected' && <Badge variant="secondary" className="h-6 bg-emerald-500/10 text-emerald-500 border-emerald-500/20"><Wifi className="w-3 h-3 mr-1" /> Online</Badge>}
          {status === 'error' && <Badge variant="destructive" className="h-6"><WifiOff className="w-3 h-3 mr-1" /> Offline</Badge>}
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