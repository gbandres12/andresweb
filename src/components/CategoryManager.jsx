import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Trash2, Edit2, Check, X, GripVertical } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function CategoryManager() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editCode, setEditCode] = useState('');
  const [editDesc, setEditDesc] = useState('');

  const load = () =>
    base44.entities.Category.list('order').then(c => {
      setCategories(c);
      setLoading(false);
    });

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!newName.trim()) { toast.error('Nome obrigatório'); return; }
    await base44.entities.Category.create({
      name: newName.trim(),
      code: newCode.trim(),
      description: newDesc.trim(),
      order: categories.length,
    });
    toast.success('Categoria criada');
    setNewName('');
    setNewCode('');
    setNewDesc('');
    setAdding(false);
    load();
  };

  const handleDelete = async (id) => {
    await base44.entities.Category.delete(id);
    toast.success('Categoria removida');
    load();
  };

  const startEdit = (cat) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditCode(cat.code || '');
    setEditDesc(cat.description || '');
  };

  const saveEdit = async (id) => {
    if (!editName.trim()) { toast.error('Nome obrigatório'); return; }
    await base44.entities.Category.update(id, { name: editName.trim(), code: editCode.trim(), description: editDesc.trim() });
    toast.success('Categoria atualizada');
    setEditingId(null);
    load();
  };

  if (loading) return (
    <div className="flex items-center justify-center h-40">
      <div className="w-6 h-6 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-serif font-semibold">Categorias</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{categories.length} categorias cadastradas</p>
        </div>
        {!adding && (
          <Button onClick={() => setAdding(true)} size="sm">
            <Plus className="w-4 h-4 mr-1" /> Nova Categoria
          </Button>
        )}
      </div>

      {/* Add form */}
      {adding && (
        <div className="bg-accent/40 border border-border rounded-xl p-4 mb-4 space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="Nome da categoria *"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              className="flex-1"
              autoFocus
            />
            <Input
              placeholder="Código (ex: VST)"
              value={newCode}
              onChange={e => setNewCode(e.target.value)}
              className="w-32"
            />
          </div>
          <Input
            placeholder="Descrição (opcional)"
            value={newDesc}
            onChange={e => setNewDesc(e.target.value)}
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAdd}>
              <Check className="w-4 h-4 mr-1" /> Salvar
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setAdding(false); setNewName(''); setNewCode(''); setNewDesc(''); }}>
              <X className="w-4 h-4 mr-1" /> Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        {categories.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">
            <p className="text-sm">Nenhuma categoria cadastrada.</p>
            <p className="text-xs mt-1 text-muted-foreground/60">Crie categorias com códigos para consultar no PDV.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {categories.map(cat => (
              <li key={cat.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-muted/30 transition-colors">
                <GripVertical className="w-4 h-4 text-muted-foreground/40 shrink-0" />

                {editingId === cat.id ? (
                  <div className="flex-1 flex gap-2 items-center flex-wrap">
                    <Input
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      className="h-8 text-sm flex-1 min-w-32"
                      autoFocus
                    />
                    <Input
                      value={editCode}
                      onChange={e => setEditCode(e.target.value)}
                      placeholder="Código"
                      className="h-8 text-sm w-28"
                    />
                    <Input
                      value={editDesc}
                      onChange={e => setEditDesc(e.target.value)}
                      placeholder="Descrição"
                      className="h-8 text-sm flex-1 min-w-32"
                    />
                    <button onClick={() => saveEdit(cat.id)} className="p-1.5 rounded hover:bg-green-100 text-green-600">
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={() => setEditingId(null)} className="p-1.5 rounded hover:bg-muted text-muted-foreground">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{cat.name}</p>
                        {cat.code && (
                          <span className="text-xs font-mono font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded">{cat.code}</span>
                        )}
                      </div>
                      {cat.description && <p className="text-xs text-muted-foreground mt-0.5">{cat.description}</p>}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => startEdit(cat)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(cat.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}