# Poste Radar — recherche d'emploi IT au Maroc

Application web locale (Node.js + page HTML) qui centralise la recherche
d'offres d'emploi IT au Maroc : Java, Python, PHP/Laravel, QA, SQL/DBA,
administrateur système, DevOps, fullstack, frontend — ou recherche libre.

Deux sources combinées :
1. **JSearch** (API gratuite via RapidAPI) — agrège Indeed, LinkedIn et
   Glassdoor dans un seul résultat structuré.
2. **Liens directs pré-filtrés** vers les plateformes marocaines qui n'ont
   pas d'API publique : Rekrute, Emploi.ma, MarocAnnonces, StagiaireMaroc,
   ANAPEC, plus les liens LinkedIn/Indeed/Glassdoor directs.

## Installation (5 minutes)

### 1. Prérequis
- [Node.js](https://nodejs.org) version 18 ou plus (vérifie avec `node -v`).

### 2. Installer les dépendances
```bash
cd jobfinder-ma
npm install
```

### 3. (Optionnel mais recommandé) Clé API gratuite JSearch
Sans cette clé, l'app fonctionne quand même — seule la section "Résultats
agrégés" (Indeed/LinkedIn/Glassdoor) sera désactivée, mais tous les liens
directs marchent toujours.

1. Va sur https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch
2. Crée un compte gratuit RapidAPI.
3. Clique sur "Subscribe" → choisis le plan **Basic (gratuit, 200 requêtes/mois)**.
4. Copie ta clé API ("X-RapidAPI-Key") depuis l'onglet "Endpoints".
5. Copie `.env.example` en `.env` :
   ```bash
   cp .env.example .env
   ```
6. Colle ta clé dans `.env` :
   ```
   RAPIDAPI_KEY=ta_clé_ici
   ```

### 4. Lancer l'application
```bash
npm start
```
Puis ouvre **http://localhost:3000** dans ton navigateur.

## Utilisation
- Choisis un domaine (Java, Python, PHP/Laravel, QA, SQL, SysAdmin...) ou
  "Recherche libre" pour taper tes propres mots-clés.
- Choisis une ville marocaine ou "Toutes villes".
- Clique "Chercher" : les résultats Indeed/LinkedIn/Glassdoor apparaissent
  directement, et les cartes de plateformes marocaines s'ouvrent en un clic
  dans un nouvel onglet, déjà filtrées sur ta recherche.

## Limites connues
- Le quota gratuit JSearch est de 200 requêtes/mois — l'app met les résultats
  en cache 15 minutes pour économiser ce quota.
- Rekrute, Emploi.ma et les autres sites marocains n'ont pas d'API publique :
  l'app ouvre leur moteur de recherche déjà rempli plutôt que de scraper leurs
  pages (plus fiable, et respecte leurs conditions d'utilisation).
- LinkedIn ne fournit pas d'API de recherche d'offres publique ; le lien
  ouvre leur recherche native dans un nouvel onglet.

## Aller plus loin
- **Automatiser l'envoi quotidien par email** : ajoute un script planifié
  (`cron` sur Mac/Linux, Planificateur de tâches sur Windows) qui appelle
  `GET /api/search?domain=java&city=Casablanca` et envoie le résultat par
  email via `nodemailer`. Demande-moi si tu veux ce script en complément.
- **Déployer en ligne gratuitement** (pour y accéder même ordi éteint) :
  Render.com ou Railway.app ont un plan gratuit compatible avec ce projet.
