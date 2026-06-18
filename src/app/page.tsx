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
  is_favorite: boolean;
  reading_time_minutes: number;
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
  const [filter, setFilter] = useState<'all' | 'favorites'>('all');

  const [allowedSenders, setAllowedSenders] = useState<AllowedSender[]>([]);
  const [showWhitelistModal, setShowWhitelistModal] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [whitelistLoading, setWhitelistLoading] = useState(false);

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

  const toggleFavorite = async (e: React.MouseEvent, nl: Newsletter) => {
    e.stopPropagation();
    const nextState = !nl.is_favorite;

    const { error } = await supabase
      .from('newsletters')
      .update({ is_favorite: nextState })
      .eq('id', nl.id);

    if (!error) {
      setNewsletters(prev =>
        prev.map(n => (n.id === nl.id ? { ...n, is_favorite: nextState } : n))
      );
      if (selected?.id === nl.id) {
        setSelected(prev => prev ? { ...prev, is_favorite: nextState } : null);
      }
    }
  };

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
    }
    setWhitelistLoading(false);
  };

  const handleRemoveEmail = async (id: string) => {
    if (!confirm('Retirer de la liste blanche ?')) return;
    const { error } = await supabase.from('allowed_senders').delete().eq('id', id);
    if (!error) setAllowedSenders(prev => prev.filter(s => s.id !== id));
  };

  // 💡 FONCTION POUR ACTIVER LES NOTIFICATIONS SUR TON IPHONE
  const subscribeToPush = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      alert("Les notifications push ne sont supportées que si l'application est installée sur ton écran d'accueil iPhone.");
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        alert("Permission de notification refusée.");
        return;
      }

      const registration = await navigator.serviceWorker.register('/sw.js');
      
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) {
        alert("Clé publique VAPID introuvable dans le fichier d'environnement.");
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: publicKey
      });

      const { error } = await supabase
        .from('push_subscriptions')
        .insert([{ subscription: subscription.toJSON() }]);

      if (error) {
        console.error(error);
        alert("Erreur lors de la sauvegarde de l'abonnement sur Supabase.");
      } else {
        alert("🔔 Notifications activées avec succès ! Ton iPhone va vibrer à chaque nouvelle édition.");
      }

    } catch (err) {
      console.error("Erreur d'abonnement:", err);
      alert("Impossible d'activer les notifications. Vérifie que tu es bien sur l'app installée via ton écran d'accueil.");
    }
  };

  const displayedNewsletters = newsletters.filter(nl => {
    if (filter === 'favorites') return nl.is_favorite;
    return true;
  });

  return (
    <main className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      
      {/* Colonne Gauche : Liste */}
      <section className={`w-full md:w-1/3 border-r border-slate-200 bg-white flex flex-col h-full ${viewMode === 'reader' ? 'hidden md:flex' : 'flex'}`}>
        <header className="p-4 border-b border-slate-200 bg-slate-900 text-white sticky top-0 z-10 flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <h1 className="text-xl font-bold tracking-tight">📬 Mon Méco</h1>
            <div className="flex gap-2">
              <button 
                onClick={() => setShowWhitelistModal(true)} 
                className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-md transition text-xs"
              >
                ⚙️ Whitelist
              </button>
              <button onClick={fetchNewsletters} className="px-2.5 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 rounded-md transition">
                🔄
              </button>
            </div>
          </div>
          
          <div className="flex bg-slate-850 p-0.5 rounded-lg border border-slate-700 text-xs">
            <button 
              onClick={() => setFilter('all')}
              className={`flex-1 py-1.5 text-center rounded-md font-medium transition ${filter === 'all' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Tous ({newsletters.length})
            </button>
            <button 
              onClick={() => setFilter('favorites')}
              className={`flex-1 py-1.5 text-center rounded-md font-medium transition ${filter === 'favorites' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
            >
              ⭐ Favoris ({newsletters.filter(n => n.is_favorite).length})
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 pb-10">
          {loading ? (
            <p className="p-4 text-center text-slate-500">Chargement...</p>
          ) : displayedNewsletters.length === 0 ? (
            <p className="p-4 text-center text-slate-400 text-sm">Aucun message trouvé.</p>
          ) : (
            displayedNewsletters.map((nl) => (
              <div
                key={nl.id}
                onClick={() => {
                  setSelected(nl);
                  setViewMode('reader');
                  if (!nl.is_read) markAsRead(nl.id);
                }}
                className={`p-4 cursor-pointer transition-colors border-l-4 flex flex-col gap-1.5 ${
                  selected?.id === nl.id ? 'bg-blue-50/70 border-blue-600' : 'hover:bg-slate-50 border-transparent'
                }`}
              >
                <div className="flex justify-between items-baseline">
                  <span className={`text-sm truncate max-w-[180px] ${!nl.is_read ? 'font-bold text-slate-900' : 'text-slate-600'}`}>
                    {nl.sender_name || nl.sender_email}
                  </span>
                  <span className="text-xs text-slate-400 shrink-0">
                    {new Date(nl.received_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
                
                <h2 className={`text-sm line-clamp-1 ${!nl.is_read ? 'font-semibold text-slate-900' : 'text-slate-500'}`}>
                  {nl.subject}
                </h2>

                <div className="flex justify-between items-center mt-1">
                  <span className="text-[11px] px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full font-medium">
                    ⏱️ {nl.reading_time_minutes} min
                  </span>
                  
                  <button 
                    onClick={(e) => toggleFavorite(e, nl)}
                    className="text-base p-1 rounded hover:bg-slate-100/80 transition-transform active:scale-95"
                  >
                    {nl.is_favorite ? '⭐' : '☆'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Colonne Droite : Lecteur */}
      <section className={`w-full md:w-2/3 flex flex-col h-full bg-white ${viewMode === 'list' ? 'hidden md:flex' : 'flex'}`}>
        {selected ? (
          <div className="flex flex-col h-full">
            <div className="p-4 md:p-6 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <button onClick={() => setViewMode('list')} className="md:hidden p-2 text-slate-600 bg-white border border-slate-200 rounded-md shadow-sm text-sm">
                  ⬅️ Liste
                </button>
                <div className="min-w-0">
                  <h1 className="text-base md:text-xl font-bold text-slate-900 truncate">{selected.subject}</h1>
                  <p className="text-xs text-slate-500 truncate">De : {selected.sender_name || selected.sender_email}</p>
                </div>
              </div>
              <button 
                onClick={(e) => toggleFavorite(e, selected)}
                className="p-2 border border-slate-200 rounded-lg bg-white shadow-sm hover:bg-slate-50 text-lg transition"
              >
                {selected.is_favorite ? '⭐' : '☆'}
              </button>
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
                        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height: 1.6; color: #1e293b; max-width: 680px; margin: 0 auto; padding: 10px; }
                        img { max-width: 100% !important; height: auto !important; border-radius: 8px; }
                      `;
                      iframeDoc.head.appendChild(style);
                    }
                  } catch (err) {}
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

      {/* MODALE : Gestion Whitelist & Notifications */}
      {showWhitelistModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-xl">
              <h2 className="text-lg font-bold text-slate-900">⚙️ Paramètres</h2>
              <button onClick={() => setShowWhitelistModal(false)} className="text-slate-400 text-xl font-medium">✕</button>
            </div>
            
            <form onSubmit={handleAddEmail} className="p-4 border-b border-slate-100 flex gap-2">
              <input
                type="email" placeholder="Ex: news@finimize.com" value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)} required
                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
              />
              <button type="submit" disabled={whitelistLoading} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">
                Ajouter
              </button>
            </form>

            {/* 💡 BLOC BOUTON NOTIFICATIONS */}
            <div className="p-4 border-b border-slate-100 bg-blue-50/50 flex flex-col gap-2">
              <p className="text-xs text-slate-600 font-medium">Alerte iPhone en temps réel :</p>
              <button
                onClick={subscribeToPush}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg text-sm shadow-sm transition active:scale-98 flex items-center justify-center gap-2"
              >
                🔔 Activer les notifications push
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 bg-slate-50/50 max-h-[30vh]">
              <div className="divide-y divide-slate-100 bg-white rounded-lg border border-slate-100">
                {allowedSenders.map(s => (
                  <div key={s.id} className="flex justify-between items-center p-2.5">
                    <span className="text-sm text-slate-700 truncate">{s.email}</span>
                    <button onClick={() => handleRemoveEmail(s.id)} className="text-xs text-red-500 p-1">🗑️</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}