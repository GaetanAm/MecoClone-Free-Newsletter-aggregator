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

interface AllowedSender {
  id: string;
  email: string;
}

export default function Home() {
  const [newsletters, setNewsletters] = useState<Newsletter[]>([]);
  const [selected, setSelected] = useState<Newsletter | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'reader'>('list');

  // États pour la gestion de la liste blanche
  const [allowedSenders, setAllowedSenders] = useState<AllowedSender[]>([]);
  const [showWhitelistModal, setShowWhitelistModal] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [whitelistLoading, setWhitelistLoading] = useState(false);

  // Charger les newsletters
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

  // Charger la liste blanche
  const fetchWhitelist = async () => {
    const { data, error } = await supabase
      .from('allowed_senders')
      .select('*')
      .order('email', { ascending: true });

    if (!error && data) {
      setAllowedSenders(data);
    }
  };

  useEffect(() => {
    fetchNewsletters();
    fetchWhitelist();
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

  // Ajouter un email à la whitelist
  const handleAddEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;

    setWhitelistLoading(true);
    const emailToInsert = newEmail.trim().toLowerCase();

    const { data, error } = await supabase
      .from('allowed_senders')
      .insert([{ email: emailToInsert }])
      .select();

    if (!error && data) {
      setAllowedSenders(prev => [...prev, data[0]].sort((a, b) => a.email.localeCompare(b.email)));
      setNewEmail('');
    } else if (error?.code === '23505') {
      alert('Cet email est déjà dans la liste blanche !');
    } else {
      alert("Erreur lors de l'ajout : " + error?.message);
    }
    setWhitelistLoading(false);
  };

  // Supprimer un email de la whitelist
  const handleRemoveEmail = async (id: string) => {
    if (!confirm('Voulez-vous vraiment retirer cet expéditeur de la liste blanche ?')) return;

    const { error } = await supabase
      .from('allowed_senders')
      .delete()
      .eq('id', id);

    if (!error) {
      setAllowedSenders(prev => prev.filter(sender => sender.id !== id));
    } else {
      alert('Erreur lors de la suppression : ' + error.message);
    }
  };

  return (
    <main className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden relative">
      
      {/* Colonne Gauche : Liste */}
      <section className={`w-full md:w-1/3 border-r border-slate-200 bg-white flex flex-col h-full ${viewMode === 'reader' ? 'hidden md:flex' : 'flex'}`}>
        <header className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-900 text-white sticky top-0 z-10">
          <h1 className="text-xl font-bold tracking-tight">📬 Mon Méco</h1>
          <div className="flex gap-2">
            <button 
              onClick={() => setShowWhitelistModal(true)} 
              className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-md transition text-xs flex items-center gap-1"
              title="Gérer la liste blanche"
            >
              ⚙️ <span className="hidden sm:inline">Whitelist</span>
            </button>
            <button 
              onClick={fetchNewsletters} 
              className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 rounded-md transition"
            >
              🔄
            </button>
          </div>
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
                  setViewMode('reader');
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

      {/* Colonne Droite : Lecteur */}
      <section className={`w-full md:w-2/3 flex flex-col h-full bg-white ${viewMode === 'list' ? 'hidden md:flex' : 'flex'}`}>
        {selected ? (
          <div className="flex flex-col h-full">
            <div className="p-4 md:p-6 border-b border-slate-200 bg-slate-50/50 flex items-center gap-3">
              <button 
                onClick={() => setViewMode('list')}
                className="md:hidden p-2 text-slate-600 bg-white border border-slate-200 rounded-md shadow-sm text-sm"
              >
                ⬅️ Liste
              </button>
              <div className="flex-1 min-w-0">
                <h1 className="text-base md:text-2xl font-bold text-slate-900 truncate">{selected.subject}</h1>
                <p className="text-xs md:text-sm text-slate-500 truncate">
                  De : <span className="font-medium text-slate-700">{selected.sender_name || selected.sender_email}</span>
                </p>
              </div>
            </div>

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

      {/* MODALE : Gestion de la Whitelist */}
      {showWhitelistModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
            
            {/* Header Modale */}
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-xl">
              <h2 className="text-lg font-bold text-slate-900">⚙️ Whitelist Expéditeurs</h2>
              <button 
                onClick={() => setShowWhitelistModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-medium p-1"
              >
                ✕
              </button>
            </div>

            {/* Formulaire d'ajout */}
            <form onSubmit={handleAddEmail} className="p-4 border-b border-slate-100 flex gap-2 bg-white">
              <input
                type="email"
                placeholder="Ex: news@finimize.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                type="submit"
                disabled={whitelistLoading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium shadow-sm transition disabled:opacity-50"
              >
                {whitelistLoading ? '...' : 'Ajouter'}
              </button>
            </form>

            {/* Liste des expéditeurs */}
            <div className="flex-1 overflow-y-auto p-2 bg-slate-50/50 max-h-[40vh]">
              {allowedSenders.length === 0 ? (
                <p className="text-center text-slate-400 text-sm py-8">Aucun expéditeur autorisé.</p>
              ) : (
                <div className="divide-y divide-slate-100 bg-white rounded-lg border border-slate-100">
                  {allowedSenders.map((sender) => (
                    <div key={sender.id} className="flex justify-between items-center p-3 hover:bg-slate-50 transition-colors">
                      <span className="text-sm text-slate-700 font-medium truncate pr-4">{sender.email}</span>
                      <button
                        onClick={() => handleRemoveEmail(sender.id)}
                        className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-md transition"
                        title="Supprimer"
                      >
                        🗑️
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer Modale */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-xl flex justify-end">
              <button
                onClick={() => setShowWhitelistModal(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-sm font-medium transition"
              >
                Fermer
              </button>
            </div>

          </div>
        </div>
      )}

    </main>
  );
}