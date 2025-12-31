import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';
import { TERMINAL_THEME } from '@/lib/terminal-theme';
interface XtermViewProps {
  onData: (data: string) => void;
  className?: string;
}
export interface XtermRef {
  write: (data: string) => void;
  clear: () => void;
  focus: () => void;
}
export const XtermView = forwardRef<XtermRef, XtermViewProps>(({ onData, className }, ref) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermInstance = useRef<Terminal | null>(null);
  const fitAddon = useRef<FitAddon | null>(null);
  useImperativeHandle(ref, () => ({
    write: (data: string) => xtermInstance.current?.write(data),
    clear: () => xtermInstance.current?.clear(),
    focus: () => xtermInstance.current?.focus(),
  }));
  useEffect(() => {
    if (!terminalRef.current) return;
    const term = new Terminal({
      theme: TERMINAL_THEME,
      fontFamily: '"JetBrains Mono", "Fira Code", monospace',
      fontSize: 14,
      cursorBlink: true,
      cursorStyle: 'block',
      allowProposedApi: true,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.loadAddon(new WebLinksAddon());
    term.open(terminalRef.current);
    fit.fit();
    term.onData(onData);
    xtermInstance.current = term;
    fitAddon.current = fit;
    const handleResize = () => fit.fit();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      term.dispose();
    };
  }, []);
  return <div ref={terminalRef} className={className} />;
});
XtermView.displayName = 'XtermView';