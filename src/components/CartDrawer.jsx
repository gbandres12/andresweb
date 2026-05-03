import { useState } from 'react';
import { X, ShoppingBag, Trash2, Phone } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

export default function CartDrawer({ cart, onRemove, onClose, storePhone }) {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [notes, setNotes] = useState('');

  const total = cart.reduce((sum, item) => sum + item.price * item.qty, 0);

  const sendWhatsApp = () => {
    let msg = `Olá! Gostaria de fazer um pedido na *Sra Andres*:\n\n`;
    cart.forEach(item => {
      msg += `• *${item.name}*`;
      if (item.size) msg += ` - Tam: ${item.size}`;
      if (item.color) msg += ` - Cor: ${item.color}`;
      msg += ` — R$ ${item.price.toFixed(2).replace('.', ',')}`;
      if (item.qty > 1) msg += ` (x${item.qty})`;
      msg += `\n`;
    });
    msg += `\n*Total: R$ ${total.toFixed(2).replace('.', ',')}*`;
    if (customerName) msg += `\n\nNome: ${customerName}`;
    if (customerPhone) msg += `\nTelefone: ${customerPhone}`;
    if (notes) msg += `\nObs: ${notes}`;

    const phone = (storePhone || '55').replace(/\D/g, '');
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-[60] flex justify-end">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Drawer */}
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="relative bg-white w-full max-w-sm h-full flex flex-col shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#e8e0d8]">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-primary" />
            <h2 className="font-serif text-lg font-light tracking-wide">Meu Pedido</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-[#f5f1ed] rounded-full transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {cart.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-10">Nenhum item adicionado.</p>
          ) : (
            cart.map((item, i) => (
              <div key={i} className="flex gap-3 items-start border-b border-[#e8e0d8] pb-3 last:border-0">
                {item.image ? (
                  <img src={item.image} alt={item.name} className="w-14 h-14 object-cover rounded-lg shrink-0" />
                ) : (
                  <div className="w-14 h-14 bg-[#f5f1ed] rounded-lg flex items-center justify-center text-2xl shrink-0">👗</div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-snug">{item.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {[item.size, item.color].filter(Boolean).join(' · ')}
                    {item.qty > 1 && ` · x${item.qty}`}
                  </p>
                  <p className="font-serif text-primary text-sm mt-1">
                    R$ {(item.price * item.qty).toFixed(2).replace('.', ',')}
                  </p>
                </div>
                <button onClick={() => onRemove(i)} className="p-1 hover:bg-destructive/10 hover:text-destructive rounded transition-colors text-muted-foreground shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {cart.length > 0 && (
          <div className="px-5 py-4 border-t border-[#e8e0d8] space-y-3 bg-[#faf9f7]">
            <div className="flex justify-between items-center text-sm mb-1">
              <span className="text-muted-foreground">{cart.length} ite{cart.length > 1 ? 'ns' : 'm'}</span>
              <span className="font-serif text-lg text-primary font-semibold">
                R$ {total.toFixed(2).replace('.', ',')}
              </span>
            </div>

            <input
              type="text"
              placeholder="Seu nome"
              value={customerName}
              onChange={e => setCustomerName(e.target.value)}
              className="w-full border border-[#d4c9bf] px-3 py-2 text-sm bg-white placeholder:text-muted-foreground focus:outline-none focus:border-primary"
            />
            <input
              type="text"
              placeholder="Seu WhatsApp (opcional)"
              value={customerPhone}
              onChange={e => setCustomerPhone(e.target.value)}
              className="w-full border border-[#d4c9bf] px-3 py-2 text-sm bg-white placeholder:text-muted-foreground focus:outline-none focus:border-primary"
            />
            <textarea
              placeholder="Observações (opcional)"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="w-full border border-[#d4c9bf] px-3 py-2 text-sm bg-white placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none"
            />

            <button
              onClick={sendWhatsApp}
              className="w-full bg-[#25D366] hover:bg-[#1db954] text-white py-3.5 text-sm tracking-widest uppercase transition-colors flex items-center justify-center gap-2.5 font-sans"
            >
              <Phone className="w-4 h-4" />
              Enviar Pedido pelo WhatsApp
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}