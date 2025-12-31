import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { AgentType, TerminalConfig } from '@shared/types';
import { toast } from 'sonner';
import { RotateCcw } from 'lucide-react';
interface TerminalSettingsProps {
  config: TerminalConfig;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (newConfig: TerminalConfig) => void;
}
export function TerminalSettings({ config, isOpen, onClose, onUpdate }: TerminalSettingsProps) {
  const [formData, setFormData] = useState<TerminalConfig>(config);
  const [loading, setLoading] = useState(false);
  const handleSave = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/terminal/${config.id}/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const result = await response.json();
      if (result.success) {
        onUpdate(result.data);
        toast.success('Agent configuration updated');
        onClose();
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      toast.error('Failed to update settings');
    } finally {
      setLoading(false);
    }
  };
  const handleReset = () => {
    setFormData({
      ...config,
      name: `Agent-${config.id.slice(0, 4)}`,
      agentType: 'system',
      systemPrompt: "You are a helpful Synapse system agent.",
    });
    toast.info("Settings staged for reset");
  };
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[#09090b]/95 backdrop-blur-xl border-border text-foreground sm:max-w-[425px] shadow-glass">
        <DialogHeader>
          <DialogTitle className="font-display text-xl text-primary">Agent Configuration</DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs">
            Modify the operational parameters for this node in the synapse mesh.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Node Label</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="bg-black/40 border-primary/10 focus:border-primary/40 transition-colors"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="type" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Logic Persona</Label>
            <Select
              value={formData.agentType}
              onValueChange={(val: AgentType) => setFormData({ ...formData, agentType: val })}
            >
              <SelectTrigger className="bg-black/40 border-primary/10">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent className="bg-[#09090b] border-border text-foreground">
                <SelectItem value="system">System Core</SelectItem>
                <SelectItem value="coder">Logic Architect</SelectItem>
                <SelectItem value="reviewer">Audit Reviewer</SelectItem>
                <SelectItem value="security">Guard Protocol</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="prompt" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Heuristic Instructions</Label>
            <Textarea
              id="prompt"
              value={formData.systemPrompt}
              onChange={(e) => setFormData({ ...formData, systemPrompt: e.target.value })}
              className="bg-black/40 border-primary/10 min-h-[100px] resize-none"
              placeholder="Primary directives for the agent..."
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={handleReset} size="icon" className="mr-auto text-muted-foreground hover:text-primary">
            <RotateCcw className="w-4 h-4" />
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose} className="hover:bg-muted/50">Cancel</Button>
            <Button onClick={handleSave} disabled={loading} className="bg-primary text-primary-foreground hover:bg-primary/80 transition-all font-bold">
              {loading ? 'Processing...' : 'Sync Node'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}