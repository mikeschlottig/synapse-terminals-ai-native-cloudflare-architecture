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
  const timersRef = useRef<number[]>([]);
  const roRef = useRef<ResizeObserver | null>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const addTimer = (cb: () => void, delay: number) => {
    const id = window.setTimeout(cb, delay) as unknown as number;
    timersRef.current.push(id);
  };
  useImperativeHandle(ref, () => ({
    write: (data: string) => {
      if (!isDisposedRef.current && terminalInstance.current) {
        terminalInstance.current.write(data);
      }
    },
    clear: () => {
      if (!isDisposedRef.current && terminalInstance.current) {
        terminalInstance.current.clear();
        terminalInstance.current.write('\x1b[2J\x1b[H');
      }
    },
    focus: () => {
      if (!isDisposedRef.current && terminalInstance.current) {
        terminalInstance.current.focus();
      }
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
      const core = (terminalInstance.current as any)._core;
      // DEEP INSPECTION: Ensure render service and dimensions are initialized
      if (!core || !core._renderService || !core._renderService.dimensions) {
        return;
      }
      try {
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
        // Detailed suppression to avoid crashing the UI
        console.warn('Xterm fit deferred: rendering engine not yet ready');
      }
    };
    addTimer(performFit, 50);
    addTimer(performFit, 200);
    addTimer(() => {
      performFit();
      const handleResize = () => {
        if (debounceTimeoutRef.current) {
          clearTimeout(debounceTimeoutRef.current as any);
        }
        debounceTimeoutRef.current = setTimeout(() => {
          if (!isDisposedRef.current) {
            requestAnimationFrame(performFit);
          }
        }, 150) as unknown as NodeJS.Timeout;
      };
      roRef.current = new ResizeObserver(handleResize);
      if (containerRef.current) {
        roRef.current.observe(containerRef.current);
      }
    }, 500);
    term.onData(onData);
    return () => {
      isDisposedRef.current = true;
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      roRef.current?.disconnect();
      roRef.current = null;
      try {
        if (fitAddonInstance.current) {
          fitAddonInstance.current.dispose();
        }
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