import React, { useEffect, useState } from 'react';
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator, CommandShortcut } from '@/components/ui/command';
import { Terminal as TermIcon, Plus, LayoutGrid, Square, Trash2, Shield, Code, Cpu, UserCheck } from 'lucide-react';
import { AgentType } from '@shared/types';
interface CommandPaletteProps {
  onAddTerminal: (type: AgentType) => void;
  onSwitchTerminal: (id: string) => void;
  onToggleView: (view: 'focus' | 'mesh') => void;
  onClearCurrent: () => void;
  terminals: { id: string; name: string; type: AgentType }[];
}
export function CommandPalette({ onAddTerminal, onSwitchTerminal, onToggleView, onClearCurrent, terminals }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);
  const runCommand = (action: () => void) => {
    action();
    setOpen(false);
  };
  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search nodes..." className="font-mono" />
      <CommandList className="bg-[#09090b] text-foreground border-none">
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="View Management">
          <CommandItem onSelect={() => runCommand(() => onToggleView('focus'))}>
            <Square className="mr-2 h-4 w-4" />
            <span>Focus Mode</span>
            <CommandShortcut>⌘F</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => onToggleView('mesh'))}>
            <LayoutGrid className="mr-2 h-4 w-4" />
            <span>Mesh Grid View</span>
            <CommandShortcut>⌘G</CommandShortcut>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Active Nodes">
          {terminals.map((t) => (
            <CommandItem key={t.id} onSelect={() => runCommand(() => onSwitchTerminal(t.id))}>
              <TermIcon className="mr-2 h-4 w-4 text-primary" />
              <span>{t.name}</span>
              <span className="ml-2 text-2xs text-muted-foreground uppercase">{t.type}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Spawn Agent">
          <CommandItem onSelect={() => runCommand(() => onAddTerminal('coder'))}>
            <Code className="mr-2 h-4 w-4" />
            <span>New Coder Node</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => onAddTerminal('security'))}>
            <Shield className="mr-2 h-4 w-4" />
            <span>New Security Auditor</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => onAddTerminal('reviewer'))}>
            <UserCheck className="mr-2 h-4 w-4" />
            <span>New Reviewer Node</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => onAddTerminal('system'))}>
            <Cpu className="mr-2 h-4 w-4" />
            <span>New System Core</span>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Maintenance">
          <CommandItem onSelect={() => runCommand(onClearCurrent)}>
            <Trash2 className="mr-2 h-4 w-4 text-destructive" />
            <span>Clear Active Terminal</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}