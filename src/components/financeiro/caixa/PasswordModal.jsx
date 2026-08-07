import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

// Modal de validação da senha de gerente antes de operações sensíveis do caixa.
export default function PasswordModal({ open, title, correctPassword, onSuccess, onClose }) {
  const [pwd, setPwd] = useState('');

  const confirm = () => {
    if (pwd === correctPassword) {
      setPwd('');
      onSuccess();
    } else {
      toast.error('Senha de gerente incorreta');
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { setPwd(''); onClose(); } }}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>{title || 'Senha de gerente'}</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground -mt-2 mb-2">Informe a senha de gerente para autorizar a operação.</p>
        <Input
          type="password"
          autoFocus
          value={pwd}
          onChange={e => setPwd(e.target.value)}
          placeholder="Senha do gerente"
          onKeyDown={e => e.key === 'Enter' && confirm()}
        />
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => { setPwd(''); onClose(); }}>Cancelar</Button>
          <Button onClick={confirm}>Confirmar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}