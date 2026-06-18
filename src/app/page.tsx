'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Newsletter {
  id: string;
  sender_name: string | null;
  sender_email: string;
  subject: string;
  body_html: string;
  received_at: string;
  is_read: boolean;
}

export default function Home() {
  const [newsletters, setNewsletters] = useState<Newsletter[]>([]);
  const [selected, setSelected] = useState<Newsletter | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'reader'>('list'); // Gère la vue sur mobile

  const fetchNewsletters = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('newsletters')
      .select('*')
      .order('received_at', { ascending: false });

    if (!error && data) {
      setNewsletters(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchNewsletters();
  }, []);

  const markAsRead = async (id: string) => {
    const { error } = await supabase
      .from('newsletters')
      .update({ is_read: true })
      .eq('id', id);

    if (!error) {
      setNewsletters(prev =>
        prev.map(n => (n.id === id ? { ...n, is_read: true } : n))
      );
    }
  };

  return (
    <main className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      {/* Colonne Gauche : Liste (Masquée sur mobile si le lecteur est ouvert) */}
      <section className={`w-full md:w-1/3 border-r border-slate-200 bg-white flex flex-col h-full ${viewMode === 'reader' ? 'hidden md:flex' : 'flex'}`}>
        <header className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-900 text-white sticky top-0 z-10">
          <h1 className="text-xl font-bold tracking-tight">📬 Mon Méco</h1>
          <button 
            onClick={fetchNewsletters} 
            className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 rounded-md transition"
          >
            🔄 Rafraîchir
          </button>
        </header>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 pb-10">
          {loading ? (
            <p className="p-4 text-center text-slate-500">Chargement...</p>
          ) : newsletters.length === 0 ? (
            <p className="p-4 text-center text-slate-500">Aucune newsletter.</p>
          ) : (
            newsletters.map((nl) => (
              <div
                key={nl.id}
                onClick={() => {
                  setSelected(nl);
                  setViewMode('reader'); // Bascule sur le lecteur sur mobile
                  if (!nl.is_read) markAsRead(nl.id);
                }}
                className={`p-4 cursor-pointer transition-colors border-l-4 ${
                  selected?.id === nl.id 
                    ? 'bg-blue-50/70 border-blue-600' 
                    : 'hover:bg-slate-50 border-transparent'
                }`}
              >
                <div className="flex justify-between items-baseline mb-1">
                  <span className={`text-sm truncate max-w-[180px] ${!nl.is_read ? 'font-bold text-slate-900' : 'text-slate-600'}`}>
                    {nl.sender_name || nl.sender_email}
                  </span>
                  <span className="text-xs text-slate-400">
                    {new Date(nl.received_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
                <h2 className={`text-sm truncate ${!nl.is_read ? 'font-semibold text-slate-900' : 'text-slate-500'}`}>
                  {nl.subject}
                </h2>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Colonne Droite : Lecteur (Prend tout l'écran sur mobile si ouvert) */}
      <section className={`w-full md:w-2/3 flex flex-col h-full bg-white ${viewMode === 'list' ? 'hidden md:flex' : 'flex'}`}>
        {selected ? (
          <div className="flex flex-col h-full">
            {/* Header du lecteur */}
            <div className="p-4 md:p-6 border-b border-slate-200 bg-slate-50/50 flex items-center gap-3">
              {/* Bouton retour visible UNIQUEMENT sur mobile */}
              <button 
                onClick={() => setViewMode('list')}
                className="md:hidden p-2 text-slate-600 bg-white border border-slate-200 rounded-md shadow-sm text-sm"
              >
                ⬅️ Liste
              </button>
              <div className="flex-1 min-w-0">
                <h1 className="text-base md:text-2xl font-bold text-slate-900 truncate">{selected.subject}</h1>
                <p className="text-xs md:text-sm text-slate-500 truncate">
                  De : <span className="font-medium text-slate-700">{selected.sender_name}</span>
                </p>
              </div>
            </div>

            {/* Iframe stylisée */}
            <div className="flex-1 bg-white p-2 md:p-4 overflow-hidden h-full">
              <iframe
                title="Newsletter Content"
                srcDoc={selected.body_html}
                className="w-full h-full border-0 bg-white"
                sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"
                onLoad={(e) => {
                  try {
                    const iframe = e.currentTarget;
                    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
                    if (iframeDoc) {
                      const style = iframeDoc.createElement('style');
                      style.innerHTML = `
                        body, table, td, p, span, a {
                          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
                          line-height: 1.6 !important;
                          color: #1e293b !important;
                        }
                        body {
                          max-width: 680px !important;
                          margin: 0 auto !important;
                          padding: 10px !important;
                          background-color: #ffffff !important;
                        }
                        img {
                          max-width: 100% !important;
                          height: auto !important;
                          border-radius: 8px !important;
                        }
                        div, table {
                          background-color: transparent !important;
                        }
                      `;
                      iframeDoc.head.appendChild(style);
                    }
                  } catch (err) {
                    console.error(err);
                  }
                }}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <span className="text-4xl mb-2">📖</span>
            <p>Sélectionne une newsletter pour commencer la lecture.</p>
          </div>
        )}
      </section>
    </main>
  );
}