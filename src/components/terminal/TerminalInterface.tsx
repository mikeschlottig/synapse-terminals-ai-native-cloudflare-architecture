import React, { useEffect, useRef, useState } from 'react';
import { XtermView, XtermRef } from './XtermView';
import { Badge } from '@/components/ui/badge';
import { Loader2, Terminal as TerminalIcon, Wifi, WifiOff } from 'lucide-react';
interface TerminalInterfaceProps {
  terminalId: string;
  name: string;
}
export function TerminalInterface({ terminalId, name }: TerminalInterfaceProps) {
  const [status, setStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const wsRef = useRef<WebSocket | null>(null);
  const xtermRef = useRef<XtermRef>(null);
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/api/terminal/${terminalId}/connect`;
    const connect = () => {
      setStatus('connecting');
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      ws.onopen = () => {
        setStatus('connected');
        xtermRef.current?.write(`\r\n\x1b[36mConnected to Synapse Node: ${name}\x1b[0m\r\n`);
      };
      ws.onmessage = (event) => {
        xtermRef.current?.write(event.data);
      };
      ws.onclose = () => {
        setStatus('error');
        xtermRef.current?.write('\r\n\x1b[31mConnection closed.\x1b[0m\r\n');
      };
      ws.onerror = () => {
        setStatus('error');
      };
    };
    connect();
    return () => {
      wsRef.current?.close();
    };
  }, [terminalId, name]);
  const handleData = (data: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(data);
    }
  };
  return (
    <div className="flex flex-col h-full bg-black/40 backdrop-blur-sm border border-border rounded-lg overflow-hidden terminal-glow">
      <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b border-border">
        <div className="flex items-center gap-2">
          <TerminalIcon className="w-4 h-4 text-primary" />
          <span className="text-sm font-mono font-medium">{name}</span>
        </div>
        <div className="flex items-center gap-3">
          {status === 'connecting' && (
            <Badge variant="outline" className="gap-1 animate-pulse">
              <Loader2 className="w-3 h-3 animate-spin" /> Connecting
            </Badge>
          )}
          {status === 'connected' && (
            <Badge variant="secondary" className="gap-1 bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
              <Wifi className="w-3 h-3" /> Online
            </Badge>
          )}
          {status === 'error' && (
            <Badge variant="destructive" className="gap-1">
              <WifiOff className="w-3 h-3" /> Offline
            </Badge>
          )}
        </div>
      </div>
      <div className="flex-1 min-h-0 bg-[#09090b]">
        <XtermView ref={xtermRef} onData={handleData} className="h-full" />
      </div>
    </div>
  );
}