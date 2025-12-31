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
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalInstance = useRef<Terminal | null>(null);
  const fitAddonInstance = useRef<FitAddon | null>(null);
  useImperativeHandle(ref, () => ({
    write: (data: string) => terminalInstance.current?.write(data),
    clear: () => {
      terminalInstance.current?.clear();
      terminalInstance.current?.write('\x1b[2J\x1b[H');
    },
    focus: () => terminalInstance.current?.focus(),
  }));
  useEffect(() => {
    if (!containerRef.current) return;
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
      if (containerRef.current && fitAddonInstance.current) {
        try {
          fitAddonInstance.current.fit();
        } catch (e) {
          console.warn('Xterm fit failed', e);
        }
      }
    };
    // Delay initial fit to ensure container sizing is stable
    const timer = setTimeout(performFit, 50);
    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(performFit);
    });
    resizeObserver.observe(containerRef.current);
    term.onData(onData);
    return () => {
      clearTimeout(timer);
      resizeObserver.disconnect();
      term.dispose();
    };
  }, [onData]);
  return <div ref={containerRef} className={cn("w-full h-full min-h-[100px]", className)} />;
});
import { cn } from '@/lib/utils';
XtermView.displayName = 'XtermView';