import React, { useEffect, useRef, useState, useCallback } from 'react';
import { XtermView, XtermRef } from './XtermView';
import { Button } from '@/components/ui/button';
import { Settings as SettingsIcon, Shield, Code, UserCheck, Cpu, Loader2, Zap, Share2 } from 'lucide-react';
import { TerminalSettings } from './TerminalSettings';
import { TerminalConfig, AgentType, TerminalStatus, ApiResponse } from '@shared/types';
import { cn } from '@/lib/utils';
interface TerminalInterfaceProps {
  terminalId: string;
  name: string;
  compact?: boolean;
}
const AgentIcon = ({ type, className, isProcessing }: { type: AgentType; className?: string; isProcessing?: boolean }) => {
  const iconBase = cn(className, isProcessing && "animate-pulse text-primary shadow-[0_0_10px_rgba(6,182,212,0.5)]");
  switch (type) {
    case 'coder': return <Code className={iconBase} />;
    case 'security': return <Shield className={iconBase} />;
    case 'reviewer': return <UserCheck className={iconBase} />;
    default: return <Cpu className={iconBase} />;
  }
};
export function TerminalInterface({ terminalId, name, compact = false }: TerminalInterfaceProps) {
  const [status, setStatus] = useState<TerminalStatus>('connecting');
  const [config, setConfig] = useState<TerminalConfig | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isRelayActive, setIsRelayActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const xtermRef = useRef<XtermRef>(null);
  const reconnectTimeoutRef = useRef<any>(null);
  const isMountedRef = useRef(true);
  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch(`/api/terminal/${terminalId}/config`);
      const result = await res.json() as ApiResponse<TerminalConfig>;
      if (result.success && result.data) setConfig(result.data);
    } catch (e) {
      console.error('Failed to fetch config', e);
    }
  }, [terminalId]);
  useEffect(() => {
    isMountedRef.current = true;
    fetchConfig();
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/terminal/${terminalId}/connect`;
    const connect = () => {
      if (!isMountedRef.current || wsRef.current) return;
      setStatus('connecting');
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      ws.onopen = () => {
        if (!isMountedRef.current) return;
        setStatus('online');
        setTimeout(() => xtermRef.current?.focus(), 150);
      };
      ws.onmessage = (event) => {
        if (!isMountedRef.current) return;
        const data = event.data as string;
        if (data.includes('>> RELAYING') || data.includes('[RELAY_START]')) {
          setIsProcessing(true);
        }
        if (data.includes('[RELAY_START]')) setIsRelayActive(true);
        if (data.includes('[RELAY_END]')) {
          setIsRelayActive(false);
          setIsProcessing(false);
        }
        // Standard prompt returned means processing done
        if (data.includes('user@synapse')) {
          setIsProcessing(false);
        }
        xtermRef.current?.write(data);
      };
      ws.onclose = () => {
        if (!isMountedRef.current) return;
        wsRef.current = null;
        setStatus('offline');
        reconnectTimeoutRef.current = setTimeout(connect, 4000);
      };
    };
    connect();
    return () => {
      isMountedRef.current = false;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [terminalId, fetchConfig]);
  const handleData = useCallback((data: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(data);
    }
  }, []);
  const isConnected = status === 'online';
  return (
    <div className={cn(
      "flex flex-col h-full bg-[#09090b]/60 backdrop-blur-xl border border-border rounded-xl overflow-hidden transition-all duration-500",
      isConnected ? "terminal-glow" : "opacity-70",
      (isProcessing || isRelayActive) && "border-primary/50 shadow-[0_0_25px_rgba(6,182,212,0.15)] bg-primary/[0.02]"
    )}>
      <div className="flex items-center justify-between bg-muted/20 border-b border-border px-4 py-2">
        <div className="flex items-center gap-3">
          <div className="relative">
            <AgentIcon
              type={config?.agentType || 'system'}
              isProcessing={isProcessing || isRelayActive}
              className={cn("text-primary transition-all duration-300", compact ? "w-3.5 h-3.5" : "w-4 h-4")}
            />
            {isRelayActive && (
              <span className="absolute -top-1 -left-1 w-2.5 h-2.5 bg-amber-500 rounded-full animate-ping" />
            )}
          </div>
          <div className="flex flex-col">
            <span className={cn("font-mono font-bold leading-none tracking-tight text-[11px]", isConnected ? "text-primary" : "text-muted-foreground")}>
              {config?.name || name}
            </span>
            {isRelayActive && (
              <span className="text-[8px] text-amber-500 font-mono animate-pulse uppercase tracking-widest">Neural Relay Active</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isRelayActive && <Share2 className="w-3 h-3 text-amber-500 animate-pulse" />}
          <div className={cn(
            "w-2 h-2 rounded-full transition-shadow duration-300",
            isConnected ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-rose-500"
          )} />
          {!compact && (
            <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-primary transition-colors" onClick={() => setIsSettingsOpen(true)}>
              <SettingsIcon className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>
      <div className="flex-1 min-h-0 relative">
        <XtermView ref={xtermRef} onData={handleData} className="h-full" />
        {status !== 'online' && (
          <div className="absolute inset-0 z-10 bg-black/70 flex items-center justify-center backdrop-blur-[1px]">
             <div className="flex flex-col items-center gap-4">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
                <span className="text-[10px] font-mono text-primary/80 uppercase tracking-[0.2em] animate-pulse">Neural Synchronization In Progress...</span>
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