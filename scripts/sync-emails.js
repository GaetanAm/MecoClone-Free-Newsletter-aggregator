const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const { createClient } = require('@supabase/supabase-js');
const webpush = require('web-push');
require('dotenv').config();

// Configuration Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Configuration Web Push
if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:your-email@example.com',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

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

// Fonction pour envoyer les notifications push à tous les appareils abonnés
async function sendPushNotifications(senderName, subject) {
  try {
    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('*');

    if (error || !subscriptions || subscriptions.length === 0) return;

    console.log(`🔔 Envoi de notifications push à ${subscriptions.length} appareil(s)...`);

    const payload = JSON.stringify({
      title: `📬 Nouvelle édition : ${senderName}`,
      body: subject,
      url: '/'
    });

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(sub.subscription, payload);
      } catch (pushErr) {
        // Si l'abonnement a expiré ou n'est plus valide, on le nettoie de la BDD
        if (pushErr.statusCode === 404 || pushErr.statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id);
        }
      }
    }
  } catch (err) {
    console.error("Erreur lors de l'envoi des notifications push:", err);
  }
}

async function main() {
  console.log('🚀 Démarrage de la synchronisation des newsletters...');
  await client.connect();

  let lock = await client.getMailboxLock('INBOX');
  try {
    // 1. Récupérer la liste blanche
    const { data: whitelistData, error: whitelistError } = await supabase
      .from('allowed_senders')
      .select('email');

    if (whitelistError) throw whitelistError;
    const allowedEmails = new Set(whitelistData.map(item => item.email.toLowerCase()));

    // 2. Recherche optimisée des messages non lus des 7 derniers jours
    console.log('🔍 Recherche des messages non lus récents (7 derniers jours)...');
    const sliceDate = new Date();
    sliceDate.setDate(sliceDate.getDate() - 7);

    let messages = await client.search({ 
      seen: false,
      since: sliceDate
    });
    
    console.log(`📩 Nouveaux messages bruts trouvés : ${messages.length}`);

    let newNewslettersCount = 0;

    // 3. Traitement des messages
    for (let uid of messages) {
      let messageData = await client.fetchOne(uid, { source: true, uid: true });
      let parsed = await simpleParser(messageData.source);

      const gmailId = parsed.messageId || `uid-${messageData.uid}`;
      const sender = parsed.from?.value?.[0];
      const senderEmail = sender?.address?.toLowerCase();
      const subject = parsed.subject || '(Sans objet)';

      if (senderEmail && allowedEmails.has(senderEmail)) {
        // Vérification anti-doublon
        const { data: exists } = await supabase
          .from('newsletters')
          .select('id')
          .eq('gmail_id', gmailId)
          .maybeSingle();

        if (!exists) {
          const bodyHtml = parsed.html || parsed.textAsHtml || parsed.text || '';
          
          // Calcul du temps de lecture (200 mots/minute)
          const textOnly = parsed.text || '';
          const wordCount = textOnly.split(/\s+/).filter(word => word.length > 0).length;
          const readingTime = Math.max(1, Math.ceil(wordCount / 200));

          const senderName = sender?.name || senderEmail.split('@')[0];

          const { error: insertError } = await supabase.from('newsletters').insert({
            gmail_id: gmailId,
            sender_name: senderName,
            sender_email: senderEmail,
            subject: subject,
            body_html: bodyHtml,
            received_at: parsed.date ? parsed.date.toISOString() : new Date().toISOString(),
            is_read: false,
            reading_time_minutes: readingTime
          });

          if (!insertError) {
            newNewslettersCount++;
            // Déclencher la notification Push immédiate
            await sendPushNotifications(senderName, subject);
          }
        }
      }
    }

    console.log(`✅ Tri terminé. ${newNewslettersCount} nouvelle(s) newsletter(s) ajoutée(s).`);

    // 4. Nettoyage automatique des messages de plus de 30 jours (SAUF LES FAVORIS)
    console.log('Cleaning up: suppression des messages de plus de 30 jours (hors favoris)...');
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() - 30);

    const { error: deleteError } = await supabase
      .from('newsletters')
      .delete()
      .lt('received_at', expirationDate.toISOString())
      .eq('is_favorite', false);

    if (deleteError) console.error('Erreur nettoyage:', deleteError);

    console.log('✨ Tout est synchro, propre et notifié !');

  } finally {
    lock.release();
  }

  await client.logout();
}

main().catch(err => {
  console.error('❌ Erreur critique dans le script :', err);
  process.exit(1);
});