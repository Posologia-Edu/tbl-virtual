import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Key, Eye, EyeOff, Trash2, ExternalLink, Loader2 } from 'lucide-react';

type Provider = {
  id: string;
  label: string;
  placeholder: string;
  docsUrl: string;
};

const PROVIDERS: Provider[] = [
  { id: 'groq', label: 'Groq', placeholder: 'gsk_...', docsUrl: 'https://console.groq.com/keys' },
  { id: 'openai', label: 'OpenAI', placeholder: 'sk-...', docsUrl: 'https://platform.openai.com/api-keys' },
  { id: 'anthropic', label: 'Anthropic', placeholder: 'sk-ant-...', docsUrl: 'https://console.anthropic.com/settings/keys' },
  { id: 'openrouter', label: 'OpenRouter', placeholder: 'sk-or-...', docsUrl: 'https://openrouter.ai/keys' },
  { id: 'google', label: 'Google AI', placeholder: 'AIza...', docsUrl: 'https://aistudio.google.com/apikey' },
];

type StoredKey = {
  id: string;
  provider: string;
  api_key: string;
};

function maskKey(key: string) {
  if (key.length <= 8) return '••••••••';
  return key.slice(0, 4) + '••••••••' + key.slice(-4);
}

export default function AdminApiKeys() {
  const [keys, setKeys] = useState<StoredKey[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadKeys();
  }, []);

  const loadKeys = async () => {
    const { data, error } = await supabase.from('ai_api_keys').select('*');
    if (error) {
      toast.error('Erro ao carregar chaves de API');
      console.error(error);
    }
    setKeys((data as StoredKey[]) || []);
    setLoading(false);
  };

  const getStoredKey = (provider: string) => keys.find(k => k.provider === provider);

  const handleSave = async (provider: string) => {
    const value = drafts[provider]?.trim();
    if (!value) return;

    setSaving(s => ({ ...s, [provider]: true }));
    const existing = getStoredKey(provider);

    let error;
    if (existing) {
      ({ error } = await supabase.from('ai_api_keys').update({ api_key: value, updated_at: new Date().toISOString() }).eq('id', existing.id));
    } else {
      ({ error } = await supabase.from('ai_api_keys').insert({ provider, api_key: value }));
    }

    setSaving(s => ({ ...s, [provider]: false }));
    if (error) {
      toast.error('Erro ao salvar chave');
      console.error(error);
    } else {
      toast.success(`Chave ${provider} salva com sucesso`);
      setDrafts(d => ({ ...d, [provider]: '' }));
      loadKeys();
    }
  };

  const handleDelete = async (provider: string) => {
    const existing = getStoredKey(provider);
    if (!existing) return;

    const { error } = await supabase.from('ai_api_keys').delete().eq('id', existing.id);
    if (error) {
      toast.error('Erro ao remover chave');
    } else {
      toast.success(`Chave ${provider} removida`);
      loadKeys();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-heading font-bold">API Keys externas</h2>
        <p className="text-muted-foreground mt-1">
          Configure as API Keys das suas LLMs favoritas. Elas serão usadas na geração de questionários com IA.
        </p>
        <p className="text-sm text-muted-foreground/70 mt-1">
          Se nenhuma chave estiver configurada, o sistema usará o modelo padrão da plataforma. Se a chamada com sua chave falhar, o sistema fará fallback automático.
        </p>
      </div>

      <div className="space-y-4">
        {PROVIDERS.map(p => {
          const stored = getStoredKey(p.id);
          const isVisible = visible[p.id];
          const draft = drafts[p.id] || '';
          const isSaving = saving[p.id];

          return (
            <Card key={p.id} className={`transition-colors ${stored ? 'border-primary/30' : ''}`}>
              <CardContent className="pt-5 pb-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Key className="w-4 h-4 text-muted-foreground" />
                    <span className="font-semibold">{p.label}</span>
                  </div>
                  <a
                    href={p.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline flex items-center gap-1"
                  >
                    Adquira sua chave de API <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="flex items-center gap-2">
                  <Input
                    type={isVisible ? 'text' : 'password'}
                    placeholder={stored ? maskKey(stored.api_key) : `Cole aqui sua API Key`}
                    value={draft}
                    onChange={e => setDrafts(d => ({ ...d, [p.id]: e.target.value }))}
                    className="flex-1"
                  />
                  {stored && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setVisible(v => ({ ...v, [p.id]: !v[p.id] }))}
                      title={isVisible ? 'Ocultar' : 'Mostrar'}
                    >
                      {isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => handleSave(p.id)}
                    disabled={!draft.trim() || isSaving}
                  >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Editar'}
                  </Button>
                  {stored && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(p.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
