const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Erreur : Variables Supabase manquantes dans .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const client = new ImapFlow({
  host: 'imap.gmail.com',
  port: 993,
  secure: true,
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  },
  logger: false
});

async function sync() {
  console.log('🔄 Connexion à Gmail...');
  await client.connect();

  // On ouvre "Tous les messages" pour ne rater aucune catégorie Gmail
  let lock = await client.getMailboxLock('[Gmail]/All Mail');
  try {
    console.log('🔍 Recherche des messages non lus récents (7 derniers jours)...');
    
    // On calcule la date d'il y a 7 jours
    const sliceDate = new Date();
    sliceDate.setDate(sliceDate.getDate() - 7);

    // On demande à Gmail uniquement les mails NON LUS ET REÇUS DEPUIS CETTE DATE
    let messages = await client.search({ 
      seen: false,
      since: sliceDate
    });

    if (messages.length === 0) {
      console.log('✅ Aucun nouveau message non lu.');
    } else {
      console.log(`📥 ${messages.length} message(s) trouvé(s). Filtrage en cours...`);

      // Récupérer la liste blanche des expéditeurs
      const { data: allowedSenders } = await supabase.from('allowed_senders').select('email');
      const allowedEmailsSet = new Set((allowedSenders || []).map(s => s.email.toLowerCase()));

      for (let uid of messages) {
        // Récupérer l'ID unique Gmail du message pour éviter les doublons
        let meta = await client.fetchOne(uid, { uid: true, envelope: true });
        const gmailId = meta.envelope.messageId; // Identifiant unique mondial du mail

        let messageSource = await client.fetchOne(uid, { source: true });
        let parsed = await simpleParser(messageSource.source);

        const sender = parsed.from?.value[0];
        const senderEmail = sender?.address?.toLowerCase() || '';
        const subject = parsed.subject || '(Sans objet)';
        
        console.log(`Analyse en cours : "${subject}" de [${senderEmail}]`);

        if (!allowedEmailsSet.has(senderEmail)) {
          continue; // On ignore silencieusement si pas dans la liste blanche
        }

        const bodyHtml = parsed.html || parsed.textAsHtml || parsed.text;

        // ⏱️ CALCUL DU TEMPS DE LECTURE (Moyenne de 200 mots par minute)
        const textOnly = parsed.text || '';
        const wordCount = textOnly.split(/\s+/).filter(word => word.length > 0).length;
        const readingTime = Math.max(1, Math.ceil(wordCount / 200));

        // Insertion avec sécurité anti-doublon et nouvelles colonnes
        const { error } = await supabase.from('newsletters').insert({
          gmail_id: gmailId,
          sender_name: sender?.name || null,
          sender_email: senderEmail,
          subject: subject,
          body_html: bodyHtml,
          received_at: parsed.date ? parsed.date.toISOString() : new Date().toISOString(),
          is_read: false,
          reading_time_minutes: readingTime // 💡 Ajout du temps calculé
        });

        if (error) {
          if (error.code === '23505') {
            console.log(`⏩ Déjà importé : "${subject}"`);
          } else {
            console.error(`❌ Erreur Supabase :`, error.message);
          }
        } else {
          console.log(`💾 Sauvegardé [⏱️ ${readingTime} min] : "${subject}" de ${senderEmail}`);
        }
        
        // On le marque comme lu dans Gmail pour ne plus s'en occuper
        await client.messageFlagsAdd(uid, ['\\Seen']);
      }
    }

    // =========================================================
    // SÉCURITÉ NETTOYAGE : Supprimer les newsletters de plus de 30 jours (SAUF LES FAVORIS)
    // =========================================================
    console.log('🧹 Nettoyage des vieilles newsletters dans Supabase...');
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() - 30);

    const { count, error: deleteError } = await supabase
      .from('newsletters')
      .delete({ count: 'exact' })
      .lt('received_at', expirationDate.toISOString())
      .eq('is_favorite', false); // 💡 Protège les favoris de la suppression
    
    if (deleteError) {
      console.error('❌ Erreur lors du nettoyage :', deleteError.message);
    } else {
      console.log(`🗑️ Nettoyage terminé. ${count || 0} ancienne(s) newsletter(s) supprimée(s).`);
    }
    // =========================================================

  } finally {
    lock.release();
  }

  await client.logout();
  console.log('✨ Tout est synchro et propre !');
}

sync().catch(err => {
  console.error('💥 Erreur critique :', err);
  process.exit(1);
});