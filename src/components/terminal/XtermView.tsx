import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';
import { TERMINAL_THEME } from '@/lib/terminal-theme';
import { cn } from '@/lib/utils';
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
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalInstance = useRef<Terminal | null>(null);
  const fitAddonInstance = useRef<FitAddon | null>(null);
  const isDisposedRef = useRef(false);
  useImperativeHandle(ref, () => ({
    write: (data: string) => {
      if (!isDisposedRef.current) terminalInstance.current?.write(data);
    },
    clear: () => {
      if (!isDisposedRef.current) {
        terminalInstance.current?.clear();
        terminalInstance.current?.write('\x1b[2J\x1b[H');
      }
    },
    focus: () => {
      if (!isDisposedRef.current) terminalInstance.current?.focus();
    },
  }));
  useEffect(() => {
    if (!containerRef.current) return;
    isDisposedRef.current = false;
    const term = new Terminal({
      theme: TERMINAL_THEME,
      fontFamily: '"JetBrains Mono", "Fira Code", monospace',
      fontSize: 14,
      cursorBlink: true,
      cursorStyle: 'block',
      allowProposedApi: true,
      rows: 24,
      cols: 80
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.loadAddon(new WebLinksAddon());
    term.open(containerRef.current);
    terminalInstance.current = term;
    fitAddonInstance.current = fit;
    const performFit = () => {
      if (isDisposedRef.current || !containerRef.current || !fitAddonInstance.current || !terminalInstance.current) return;
      try {
        // Fix for "Cannot read properties of undefined (reading 'dimensions')"
        // Ensure terminal is opened, has an element, and container is in DOM with size
        const termElement = (terminalInstance.current as any).element;
        if (
          termElement && 
          document.contains(containerRef.current) &&
          containerRef.current.clientWidth > 0 && 
          containerRef.current.clientHeight > 0
        ) {
          fitAddonInstance.current.fit();
        }
      } catch (e) {
        // Silently catch fit errors to prevent app crash
        console.warn('Xterm fit attempt skipped:', e);
      }
    };
    const timer = setTimeout(performFit, 150);
    const resizeObserver = new ResizeObserver(() => {
      if (!isDisposedRef.current) {
        requestAnimationFrame(performFit);
      }
    });
    resizeObserver.observe(containerRef.current);
    term.onData(onData);
    return () => {
      isDisposedRef.current = true;
      clearTimeout(timer);
      resizeObserver.disconnect();
      try {
        term.dispose();
      } catch (e) {
        console.error('Error disposing terminal:', e);
      }
      terminalInstance.current = null;
      fitAddonInstance.current = null;
    };
  }, [onData]);
  return <div ref={containerRef} className={cn("w-full h-full min-h-[100px] bg-[#09090b]", className)} />;
});
XtermView.displayName = 'XtermView';