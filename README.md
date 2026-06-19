# 📬 Mon Méco - Free Newsletter Aggregator PWA

Une application web progressive (PWA) de lecture de newsletters inspirée de Meco, conçue pour centraliser vos abonnements e-mails, optimiser votre temps de lecture et sauvegarder vos connaissances, le tout de manière 100% autonome et gratuite.

## 🚀 Fonctionnalités Clés

- **📦 Format PWA Mobile & Tactile** : Interface responsive développée spécifiquement pour une utilisation sur iPhone avec une barre de navigation flottante style *Liquid Glass* (effet de flou et de transparence iOS).
- **📥 Synchronisation Automatique (CRON via GitHub Actions)** : Un script Node.js s'exécute de manière transparente toutes les heures pour récupérer les nouveaux messages non lus de votre boîte Gmail dédiée via le protocole IMAP.
- **🛡️ Whitelist & Gestion de Groupes Thématiques** : Filtrage strict à l'entrée basé sur une table de serveurs d'expéditeurs autorisés, triés automatiquement par catégories (Tech, Finance, Sport, Veille, Général).
- **⏳ Calcul du Temps de Lecture** : Analyse robuste du contenu HTML/texte de chaque newsletter à l'import, estimant à la volée le temps requis (base moyenne de 200 mots/minute).
- **📊 Statistiques en Temps Réel** : Visualisation sur le dashboard du temps global de lecture restant dans votre boîte de réception et de votre historique de lecture global.
- **🔖 Favoris & Carnet de Notes (Highlights)** : Protection des newsletters coup de cœur contre le nettoyage automatique (conservation illimitée vs suppression à 30 jours) et possibilité de surligner des citations textuelles marquantes sauvegardées dans un carnet de notes dédié.
- **🔔 Notifications Push d'iOS** : Implémentation du protocole Web Push à l'aide d'un Service Worker en arrière-plan et d'une identification sécurisée par clés VAPID pour faire vibrer votre iPhone à chaque nouvelle édition.

## 🛠️ Stack Technique

- **Frontend** : Next.js 14 (App Router), React, TypeScript, Tailwind CSS (Glassmorphic UI).
- **Backend Automation** : Node.js 22, GitHub Actions (CI/CD Workflows), ImapFlow, Mailparser.
- **Base de Données** : Supabase (PostgreSQL, Realtime Client, Joins).
- **Push Protocol** : Service Workers API, Web Push (VAPID).
- **Hébergement** : Vercel.

## 📁 Structure du Projet

```text
├── .github/
│   └── workflows/
│       └── sync.yml          # Workflow GitHub Actions (CRON horaire)
├── public/
│   ├── sw.js                 # Service Worker gérant les notifications push
│   ├── icon-192.png          # Icône d'application PWA (192x192)
│   └── icon-512.png          # Icône d'application PWA (512x512)
├── scripts/
│   └── sync-emails.js        # Script principal de tri IMAP et de push
└── src/
    └── app/
        ├── layout.tsx        # Balises méta d'application native Apple & Splash Screen
        ├── manifest.js       # Configuration de l'installation PWA
        ├── globals.css       # Styles généraux et configurations Tailwind
        └── page.tsx          # Application Single Page avec architecture à onglets globale

## ⚙️ Variables d'Environnement Requises

Pour faire tourner le projet localement ou sur vos plateformes de déploiement (Vercel & GitHub Secrets), créez un fichier `.env.local` contenant :

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL="votre_url_supabase"
NEXT_PUBLIC_SUPABASE_ANON_KEY="votre_cle_anonyme"

# Gmail IMAP Authentication
GMAIL_USER="votre_adresse_gmail"
GMAIL_APP_PASSWORD="votre_mot_de_passe_d_application_gmail"

# Web Push Security Configuration (VAPID)
NEXT_PUBLIC_VAPID_PUBLIC_KEY="votre_cle_publique_vapid"
VAPID_PRIVATE_KEY="votre_cle_privee_vapid"

## 🔧 Installation locale

1. **Cloner le dépôt** :
```bash
   git clone [https://github.com/votre-username/MecoClone-Free-Newsletter-aggregator.git](https://github.com/votre-username/MecoClone-Free-Newsletter-aggregator.git)
   cd MecoClone-Free-Newsletter-aggregator

2. **Installer les dépendances** :
```bash
   npm install

3. **Générer les clés VAPID** :
```bash
   npx web-push generate-vapid-keys

4. **Lancer le serveur de développement** :
```bash
   npm run dev

## 🔒 Configuration de la Base de Données (Supabase)

Exécutez le script SQL suivant dans le **SQL Editor** de votre tableau de bord Supabase pour initialiser la structure des tables nécessaires au projet :

```sql
-- Table des expéditeurs autorisés (Whitelist)
create table allowed_senders (
  id uuid default gen_random_uuid() primary key,
  email text unique not null,
  group_name text default 'Général',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Table des newsletters reçues
create table newsletters (
  id uuid default gen_random_uuid() primary key,
  gmail_id text unique not null,
  sender_name text,
  sender_email text not null,
  subject text,
  body_html text,
  is_read boolean default false,
  is_favorite boolean default false,
  reading_time_minutes int default 1,
  group_name text default 'Général',
  received_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Table des abonnements push (iPhone tokens)
create table push_subscriptions (
  id uuid default gen_random_uuid() primary key,
  subscription jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Table des extraits surlignés (Highlights)
create table highlights (
  id uuid default gen_random_uuid() primary key,
  newsletter_id uuid references newsletters(id) on delete cascade,
  text text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Désactivation de la RLS pour simplifier la communication avec le script autonome et l'iPhone
alter table allowed_senders disable row level security;
alter table newsletters disable row level security;
alter table push_subscriptions disable row level security;
alter table highlights disable row level security;

## 📝 Licence

Ce projet est sous licence MIT. N'hésitez pas à le forker et à l'adapter pour vos besoins de lecture personnels !