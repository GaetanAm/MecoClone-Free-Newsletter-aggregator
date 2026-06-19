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
  group_name: string;
}

interface AllowedSender {
  id: string;
  email: string;
  group_name: string;
}

interface Highlight {
  id: string;
  newsletter_id: string;
  text: string;
  created_at: string;
  newsletters?: {
    subject: string;
    sender_name: string | null;
  };
}

type Tab = 'digest' | 'bookmarks' | 'senders';

export default function Home() {
  // Onglet actif global (Style Meco Bottom Bar)
  const [activeTab, setActiveTab] = useState<Tab>('digest');

  const [newsletters, setNewsletters] = useState<Newsletter[]>([]);
  const [selected, setSelected] = useState<Newsletter | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'reader'>('list');
  
  // Filtre par groupe thématique (Onglet Digest)
  const [selectedGroup, setSelectedGroup] = useState<string>('Tous');

  // Whitelist & Gestion des groupes
  const [allowedSenders, setAllowedSenders] = useState<AllowedSender[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [newEmailGroup, setNewEmailGroup] = useState('Général');
  const [whitelistLoading, setWhitelistLoading] = useState(false);

  // Carnet de notes (Highlights)
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [bookmarkSubTab, setBookmarkSubTab] = useState<'favs' | 'highlights'>('favs');

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

  const fetchHighlights = async () => {
    const { data, error } = await supabase
      .from('highlights')
      .select(`
        id,
        newsletter_id,
        text,
        created_at,
        newsletters (
          subject,
          sender_name
        )
      `)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setHighlights(data as any);
    }
  };

  useEffect(() => {
    fetchNewsletters();
    fetchWhitelist();
    fetchHighlights();
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
      .insert([{ email: emailToInsert, group_name: newEmailGroup }])
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

  // Ajouter une citation / Surlignage
  const handleAddHighlight = async () => {
    if (!selected) return;
    const quote = prompt("Entrez ou collez la phrase importante à sauvegarder :");
    if (!quote || !quote.trim()) return;

    const { data, error } = await supabase
      .from('highlights')
      .insert([{ newsletter_id: selected.id, text: quote.trim() }])
      .select();

    if (!error) {
      alert("✍️ Extrait sauvegardé dans vos Highlights !");
      fetchHighlights();
    }
  };

  const handleRemoveHighlight = async (id: string) => {
    if (!confirm('Supprimer cet extrait ?')) return;
    const { error } = await supabase.from('highlights').delete().eq('id', id);
    if (!error) setHighlights(prev => prev.filter(h => h.id !== id));
  };

  // Notifications push d'iOS
  const subscribeToPush = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      alert("Abonnement impossible : assurez-vous d'avoir installé l'application sur l'écran d'accueil.");
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return alert("Permission refusée.");
      const registration = await navigator.serviceWorker.register('/sw.js');
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: publicKey
      });
      await supabase.from('push_subscriptions').insert([{ subscription: subscription.toJSON() }]);
      alert("🔔 Notifications activées !");
    } catch (err) {
      alert("Erreur d'activation.");
    }
  };

  // Liste unique des groupes créés pour les filtres du haut
  const uniqueGroups = ['Tous', ...Array.from(new Set(allowedSenders.map(s => s.group_name)))];

  // Filtrage intelligent de la liste
  const displayedNewsletters = newsletters.filter(nl => {
    if (selectedGroup !== 'Tous' && nl.group_name !== selectedGroup) return false;
    return true;
  });

  // 📊 CALCUL DES STATS (Style Meco - image.png)
  // 1. Temps total de lecture restant dans le Digest non lu
  const totalUnreadReadingTime = newsletters
    .filter(nl => !nl.is_read)
    .reduce((sum, nl) => sum + (nl.reading_time_minutes || 1), 0);

  // 2. Nombre total de newsletters lues (historique)
  const totalReadCount = newsletters.filter(nl => nl.is_read).length;
  
  // 💡 Écran de chargement complet pour le premier démarrage de l'application
  if (loading && newsletters.length === 0) {
    return (
      <div className="fixed inset-0 bg-slate-900 flex flex-col items-center justify-center gap-4 z-50">
        <span className="text-5xl animate-bounce">📬</span>
        <h1 className="text-white font-bold text-xl tracking-wide">Mon Méco</h1>
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mt-2"></div>
      </div>
    );
  }
  return (
    <main className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden pb-16 md:pb-0 relative">
      
      {/* ========================================================= */}
      {/* COLONNE GAUCHE : DYNAMIQUE SELON L'ONGLET SÉLECTIONNÉ     */}
      {/* ========================================================= */}
      <section className={`w-full md:w-1/3 border-r border-slate-200 bg-white flex flex-col h-full ${viewMode === 'reader' ? 'hidden md:flex' : 'flex'}`}>
        
        {/* ONGLET 1 : DIGEST (Boîte principale) */}
        {activeTab === 'digest' && (
          <>
            <header className="p-4 border-b border-slate-200 bg-slate-900 text-white flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <h1 className="text-xl font-bold tracking-tight">📥 Digest</h1>
                <button onClick={fetchNewsletters} className="px-2.5 py-1.5 text-xs bg-slate-800 rounded-md">🔄</button>
              </div>
              {/* Horizontal Scroll Bar pour les groupes (Style image_3.png) */}
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
                {uniqueGroups.map(group => (
                  <button
                    key={group} onClick={() => setSelectedGroup(group)}
                    className={`px-3 py-1.5 rounded-full shrink-0 font-medium transition-colors ${selectedGroup === group ? 'bg-white text-slate-900' : 'bg-slate-800 text-slate-300'}`}
                  >
                    {group}
                  </button>
                ))}
              </div>
            </header>
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {loading ? <p className="p-4 text-center text-slate-500">Chargement...</p> : 
               displayedNewsletters.length === 0 ? <p className="p-4 text-center text-slate-400">Aucun message dans {selectedGroup}.</p> :
               displayedNewsletters.map(nl => (
                <div key={nl.id} onClick={() => { setSelected(nl); setViewMode('reader'); if(!nl.is_read) markAsRead(nl.id); }}
                     className={`p-4 cursor-pointer border-l-4 flex flex-col gap-1.5 ${selected?.id === nl.id ? 'bg-blue-50/70 border-blue-600' : 'border-transparent hover:bg-slate-50'}`}>
                  <div className="flex justify-between items-baseline">
                    <span className={`text-sm truncate max-w-[180px] ${!nl.is_read ? 'font-bold' : 'text-slate-600'}`}>{nl.sender_name}</span>
                    <span className="text-xs text-slate-400">{new Date(nl.received_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
                  </div>
                  <h2 className={`text-sm line-clamp-1 ${!nl.is_read ? 'font-semibold' : 'text-slate-500'}`}>{nl.subject}</h2>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full font-medium">⏱️ {nl.reading_time_minutes} min • {nl.group_name}</span>
                    <button onClick={(e) => toggleFavorite(e, nl)} className="text-sm p-1">{nl.is_favorite ? '⭐' : '☆'}</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ONGLET 2 : BOOKMARKS (Favoris & Extraits - Style image_2.png) */}
        {activeTab === 'bookmarks' && (
          <>
            <header className="p-4 border-b border-slate-200 bg-slate-900 text-white flex flex-col gap-3">
              <h1 className="text-xl font-bold tracking-tight">🔖 Bookmarks</h1>
              <div className="flex bg-slate-800 p-0.5 rounded-lg text-xs">
                <button onClick={() => setBookmarkSubTab('favs')} className={`flex-1 py-1.5 text-center rounded-md font-medium ${bookmarkSubTab === 'favs' ? 'bg-white text-slate-900' : 'text-slate-400'}`}>Newsletters</button>
                <button onClick={() => setBookmarkSubTab('highlights')} className={`flex-1 py-1.5 text-center rounded-md font-medium ${bookmarkSubTab === 'highlights' ? 'bg-white text-slate-900' : 'text-slate-400'}`}>Highlights</button>
              </div>
            </header>
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {bookmarkSubTab === 'favs' ? (
                newsletters.filter(n => n.is_favorite).length === 0 ? <p className="p-6 text-center text-slate-400 text-sm">Aucun favori enregistré.</p> :
                newsletters.filter(n => n.is_favorite).map(nl => (
                  <div key={nl.id} onClick={() => { setSelected(nl); setViewMode('reader'); }} className="p-4 cursor-pointer hover:bg-slate-50 flex flex-col gap-1.5">
                    <div className="flex justify-between items-baseline">
                      <span className="text-sm font-bold text-slate-900">{nl.sender_name}</span>
                      <span className="text-xs text-slate-400">{new Date(nl.received_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
                    </div>
                    <h2 className="text-sm text-slate-700 line-clamp-1">{nl.subject}</h2>
                  </div>
                ))
              ) : (
                highlights.length === 0 ? <p className="p-6 text-center text-slate-400 text-sm">Aucune citation surlignée.</p> :
                highlights.map(h => (
                  <div key={h.id} className="p-4 flex flex-col gap-2 bg-amber-50/40 border-l-4 border-amber-400">
                    <p className="text-sm italic text-slate-800 font-serif">"{h.text}"</p>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-slate-400 truncate max-w-[180px]">Issu de : {h.newsletters?.sender_name || 'Newsletter'}</span>
                      <button onClick={() => handleRemoveHighlight(h.id)} className="text-xs text-red-500">🗑️</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {/* ONGLET 3 : PARAMÈTRES & GROUPES (Style image_1.png / image_5.png) */}
        {activeTab === 'senders' && (
          <>
            <header className="p-4 border-b border-slate-200 bg-slate-900 text-white">
              <h1 className="text-xl font-bold tracking-tight">⚙️ Config & Groupes</h1>
            </header>
            
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 bg-slate-50/50">

            {/* 📊 BLOC STATISTIQUES INSPIRED BY MECO (image.png) */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center text-center gap-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Temps de lecture en attente</span>
                <span className="text-3xl font-black text-slate-900 font-sans">{totalUnreadReadingTime} {totalUnreadReadingTime > 1 ? 'minutes' : 'minute'}</span>
                <span className="text-[10px] text-slate-400 mt-1">Bravo, tu as déjà lu {totalReadCount} newsletters au total !</span>
              </div>

              {/* Box Alerte Notification */}
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-2">
                <p className="text-xs font-semibold text-slate-700">Alerte Push iPhone</p>
                <button onClick={subscribeToPush} className="w-full py-2 bg-slate-900 text-white font-medium rounded-lg text-xs shadow-sm">🔔 Activer les notifications push</button>
              </div>

              {/* Formulaire ajout avec Catégorie */}
              <form onSubmit={handleAddEmail} className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-3">
                <p className="text-xs font-semibold text-slate-700">Ajouter un expéditeur</p>
                <input type="email" placeholder="news@finimize.com" value={newEmail} onChange={e => setNewEmail(e.target.value)} required className="w-full px-3 py-2 border rounded-lg text-xs focus:ring-1 focus:ring-slate-900"/>
                <div className="flex gap-2 items-center">
                  <label className="text-[11px] text-slate-400 shrink-0">Groupe :</label>
                  <select value={newEmailGroup} onChange={e => setNewEmailGroup(e.target.value)} className="flex-1 bg-slate-100 px-2 py-1.5 rounded-md text-xs font-medium border-0">
                    <option value="Général">📁 Général</option>
                    <option value="Tech">🤖 Tech</option>
                    <option value="Finance">📈 Finance</option>
                    <option value="Sport">🚴 Sport</option>
                    <option value="Veille">📚 Veille</option>
                  </select>
                </div>
                <button type="submit" disabled={whitelistLoading} className="w-full py-2 bg-blue-600 text-white rounded-lg text-xs font-medium">Ajouter à la Whitelist</button>
              </form>

              {/* Liste complète des Senders (Style image_5.png) */}
              <div className="flex flex-col gap-2">
                <p className="text-xs font-bold text-slate-400 tracking-wider uppercase px-1">Whitelisted Senders</p>
                <div className="divide-y divide-slate-100 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  {allowedSenders.map(s => (
                    <div key={s.id} className="flex justify-between items-center p-3 hover:bg-slate-50">
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-semibold text-slate-800 truncate">{s.email}</span>
                        <span className="text-[10px] text-slate-400">Dossier : {s.group_name}</span>
                      </div>
                      <button onClick={() => handleRemoveEmail(s.id)} className="text-xs p-1">🗑️</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </section>

      {/* ========================================================= */}
      {/* COLONNE DROITE : LE LECTEUR DE NEWSLETTER                 */}
      {/* ========================================================= */}
      <section className={`w-full md:w-2/3 flex flex-col h-full bg-white ${viewMode === 'list' ? 'hidden md:flex' : 'flex'}`}>
        {selected ? (
          <div className="flex flex-col h-full">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <button onClick={() => setViewMode('list')} className="md:hidden px-2.5 py-1.5 text-slate-600 bg-white border border-slate-200 rounded-md text-xs font-medium">⬅️ Retour</button>
                <div className="min-w-0">
                  <h1 className="text-sm md:text-base font-bold text-slate-900 truncate">{selected.subject}</h1>
                  <p className="text-xs text-slate-500">De : {selected.sender_name} • <span className="text-slate-400">{selected.group_name}</span></p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Bouton Surligner */}
                <button onClick={handleAddHighlight} className="p-2 border border-slate-200 bg-white rounded-lg text-xs font-medium shadow-sm active:bg-slate-50" title="Surligner une phrase">✍️ Citation</button>
                <button onClick={(e) => toggleFavorite(e, selected)} className="p-2 border border-slate-200 rounded-lg bg-white shadow-sm text-sm">{selected.is_favorite ? '⭐' : '☆'}</button>
              </div>
            </div>

            <div className="flex-1 bg-white p-1 overflow-hidden h-full">
              <iframe title="Newsletter Content" srcDoc={selected.body_html} className="w-full h-full border-0 bg-white" sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"
                onLoad={(e) => {
                  try {
                    const iframe = e.currentTarget;
                    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
                    if (iframeDoc) {
                      const style = iframeDoc.createElement('style');
                      style.innerHTML = `
                        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height: 1.6; color: #1e293b; max-width: 680px; margin: 0 auto; padding: 12px; }
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
            <span className="text-3xl mb-2">📖</span>
            <p className="text-sm">Sélectionnez un message pour démarrer.</p>
          </div>
        )}
      </section>

      {/* ========================================================= */}
      {/* BOTTOM NAVIGATION BAR (Style Liquid Glass Floating Bar)    */}
      {/* ========================================================= */}
      <nav className="fixed bottom-4 left-4 right-4 h-16 bg-white/70 backdrop-blur-xl border border-white/40 flex items-center justify-around z-40 md:hidden rounded-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.08)] px-2 transition-all">
        <button 
          onClick={() => { setActiveTab('digest'); setViewMode('list'); }} 
          className={`flex flex-col items-center justify-center flex-1 h-full gap-0.5 rounded-xl transition-colors ${activeTab === 'digest' ? 'text-slate-950 font-bold bg-slate-900/5' : 'text-slate-500 hover:text-slate-900'}`}
        >
          <span className="text-xl">📥</span>
          <span className="text-[10px] tracking-wide font-medium">Digest</span>
        </button>
        
        <button 
          onClick={() => { setActiveTab('bookmarks'); setViewMode('list'); }} 
          className={`flex flex-col items-center justify-center flex-1 h-full gap-0.5 rounded-xl transition-colors ${activeTab === 'bookmarks' ? 'text-slate-950 font-bold bg-slate-900/5' : 'text-slate-500 hover:text-slate-900'}`}
        >
          <span className="text-xl">🔖</span>
          <span className="text-[10px] tracking-wide font-medium">Bookmarks</span>
        </button>
        
        <button 
          onClick={() => { setActiveTab('senders'); setViewMode('list'); }} 
          className={`flex flex-col items-center justify-center flex-1 h-full gap-0.5 rounded-xl transition-colors ${activeTab === 'senders' ? 'text-slate-950 font-bold bg-slate-900/5' : 'text-slate-500 hover:text-slate-900'}`}
        >
          <span className="text-xl">⚙️</span>
          <span className="text-[10px] tracking-wide font-medium">Groups</span>
        </button>
      </nav>

    </main>
  );
}