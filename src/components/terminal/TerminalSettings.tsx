import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { AgentType, TerminalConfig } from '@shared/types';
import { toast } from 'sonner';
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
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[#09090b] border-border text-foreground sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="font-display text-xl text-primary">Agent Configuration</DialogTitle>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Agent Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="bg-black/40"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="type">Persona Type</Label>
            <Select
              value={formData.agentType}
              onValueChange={(val: AgentType) => setFormData({ ...formData, agentType: val })}
            >
              <SelectTrigger className="bg-black/40">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent className="bg-[#18181b] border-border text-foreground">
                <SelectItem value="system">System Agent</SelectItem>
                <SelectItem value="coder">Software Engineer</SelectItem>
                <SelectItem value="reviewer">Peer Reviewer</SelectItem>
                <SelectItem value="security">Security Auditor</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="prompt">System Prompt</Label>
            <Textarea
              id="prompt"
              value={formData.systemPrompt}
              onChange={(e) => setFormData({ ...formData, systemPrompt: e.target.value })}
              className="bg-black/40 min-h-[100px]"
              placeholder="Instructions for the agent..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={loading} className="bg-primary text-primary-foreground">
            {loading ? 'Saving...' : 'Apply Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}