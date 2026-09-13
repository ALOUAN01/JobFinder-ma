require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const NodeCache = require('node-cache');
const path = require('path');   // <-- ajouter cette ligne


const app = express();
const PORT = process.env.PORT || 3000;
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || '';

const cache = new NodeCache({ stdTTL: 900 }); // 15 min cache to save API quota

app.use(cors());
app.use(express.static('public'));
app.use(express.json());
// --- Page d'accueil (nécessaire car express.static() est ignoré sur Vercel) ---
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- Domain presets -------------------------------------------------------
// Each domain maps to the search terms used across every source.
const DOMAINS = {
  java: { label: 'Java Developer', terms: ['Java Developer', 'Java Spring Boot'] },
  python: { label: 'Python Developer', terms: ['Python Developer', 'Python Django Flask'] },
  php: { label: 'PHP / Laravel', terms: ['PHP Laravel Developer', 'Laravel Developer'] },
  qa: { label: 'QA Engineer', terms: ['QA Engineer', 'QA Testeur', 'Software Tester'] },
  sql: { label: 'SQL / DBA', terms: ['SQL Developer', 'Database Administrator DBA'] },
  sysadmin: { label: 'Administrateur Système', terms: ['System Administrator', 'Administrateur Systemes Reseaux'] },
  devops: { label: 'DevOps Engineer', terms: ['DevOps Engineer'] },
  fullstack: { label: 'Développeur Fullstack', terms: ['Fullstack Developer'] },
  frontend: { label: 'Frontend Developer', terms: ['Frontend Developer React Angular'] },
  custom: { label: 'Recherche libre', terms: [] }
};

const MOROCCO_CITIES = [
  'Casablanca', 'Rabat', 'Marrakech', 'Tanger', 'Fès', 'Agadir',
  'Meknès', 'Oujda', 'Kénitra', 'Tétouan', 'Salé', 'Remote'
];

// --- JSearch (Indeed / LinkedIn / Glassdoor aggregator) --------------------
function mapJob(j, cityFallback) {
  return {
    title: j.job_title,
    company: j.employer_name,
    city: j.job_city || cityFallback || 'Maroc',
    source: j.job_publisher || 'Web',
    url: j.job_apply_link || j.job_google_link,
    posted: j.job_posted_at_datetime_utc || null,
    remote: !!j.job_is_remote
  };
}

async function searchJSearch(query, city) {
  if (!RAPIDAPI_KEY) {
    return { error: 'no_api_key', jobs: [] };
  }
  const cacheKey = `jsearch:${query}:${city}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  let fullQuery;
  if (city === 'Remote') {
    fullQuery = `${query} Morocco remote`;
  } else if (city) {
    fullQuery = `${query} in ${city}, Morocco`;
  } else {
    fullQuery = `${query} Morocco`;
  }

  const MAX_PAGES = 3; // ~10 offres/page -> jusqu'à ~30 offres, pour préserver le quota gratuit (200 req/mois)
  let rawJobs = [];
  let cursor = null;

  try {
    for (let page = 0; page < MAX_PAGES; page++) {
      const params = { query: fullQuery, country: 'ma', date_posted: 'all' };
      if (cursor) params.cursor = cursor;

      const res = await axios.get('https://jsearch.p.rapidapi.com/search-v2', {
        params,
        headers: {
          'X-RapidAPI-Key': RAPIDAPI_KEY,
          'X-RapidAPI-Host': 'jsearch.p.rapidapi.com'
        },
        timeout: 25000
      });

      const raw = res.data;
      const list =
        Array.isArray(raw?.data) ? raw.data :
        Array.isArray(raw?.data?.jobs) ? raw.data.jobs :
        Array.isArray(raw?.jobs) ? raw.jobs :
        Array.isArray(raw) ? raw :
        [];

      console.log(`[JSearch] page ${page + 1} — "${fullQuery}" -> ${list.length} résultat(s)`);
      rawJobs = rawJobs.concat(list);

      cursor = raw?.cursor || raw?.data?.cursor || null;
      if (!cursor || list.length === 0) break; // plus de pages disponibles
    }
  } catch (err) {
    console.error(`[JSearch] Erreur sur "${fullQuery}":`, err.response?.status, err.response?.data || err.message);
    if (rawJobs.length === 0) {
      return { error: err.response?.status === 429 ? 'rate_limited' : 'fetch_failed', jobs: [] };
    }
    // sinon on garde les offres déjà récupérées avant l'erreur
  }

  const jobs = rawJobs.map(j => mapJob(j, city));
  const result = { error: null, jobs };
  cache.set(cacheKey, result);
  return result;
}

// --- Deep links for Moroccan job boards without a public API ---------------
function buildMoroccoLinks(query, city) {
  const q = encodeURIComponent(query);
  const cityQ = encodeURIComponent(city && city !== 'Remote' ? city : '');
  const citySafe = city && city !== 'Remote' ? city : '';

  // Slugify pour les sites qui mettent le mot-clé dans le chemin de l'URL (ex: Jooble)
  const slugify = (str) => String(str)
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  const googleQ = encodeURIComponent(
    `${query} emploi ${citySafe} Maroc`.replace(/\s+/g, ' ').trim()
  );

  return [
    {
      name: 'Rekrute',
      url: `https://www.rekrute.com/offres.html?keyword=${q}&positionId%5B0%5D=13&positionId%5B1%5D=19&positionId%5B2%5D=23&gNetwork=1`,
      note: 'Filtré sur les métiers IT, Maroc'
    },
    {
      name: 'Emploi.ma',
      url: `https://www.emploi.ma/recherche-jobs-maroc/${q}`,
      note: 'Recherche par mot-clé'
    },
    {
      name: 'MarocAnnonces',
      url: `https://www.marocannonces.com/maroc/emploi-b309.html?q=${q}`,
      note: 'Petites annonces emploi'
    },
    {
      name: 'StagiaireMaroc',
      url: `https://www.stagiairesmaroc.com/?s=${q}`,
      note: 'Stages et premiers emplois'
    },
    {
  name: 'ANAPEC (Agence Nationale)',
  url: `https://www.google.com/search?q=site:anapec.org+${q}`,
  note: 'Site public — recherche via Google (ancienne URL de recherche interne obsolète)'
    },  
    {
      name: 'LinkedIn',
      url: `https://www.linkedin.com/jobs/search/?keywords=${q}&location=${cityQ || 'Morocco'}`,
      note: 'Recherche directe LinkedIn'
    },
    {
      name: 'Indeed Maroc',
      url: `https://ma.indeed.com/jobs?q=${q}&l=${cityQ}`,
      note: 'Recherche directe Indeed'
    },
    {
      name: 'Glassdoor',
      url: `https://www.glassdoor.com/Job/morocco-${q}-jobs-SRCH_IL.0,7_IN139_KO8,${8 + query.length}.htm`,
      note: 'Avis entreprise + offres'
    },
    {
      name: 'Wetech.ma',
      url: `https://www.wetech.ma/q-offres/?Comp=${q}${citySafe ? `&Ville=${cityQ}` : ''}`,
      note: 'Spécialisé IT au Maroc'
    },
    {
      name: 'Talent.com',
      url: `https://ma.talent.com/jobs?k=${q}&l=${cityQ}`,
      note: 'Anciennement Neuvoo — agrégateur généraliste'
    },
    {
      name: 'Tanqeeb',
      url: `https://morocco.tanqeeb.com/jobs/search?keywords=${q}`,
      note: 'Offres Maroc et Moyen-Orient'
    },
    {
      name: 'Bayt',
      url: `https://www.bayt.com/en/morocco/jobs/?keywords=${q}`,
      note: 'Gros jobboard régional (MENA)'
    },
    {
      name: 'Jooble',
      url: `https://fr.jooble.org/emploi-${slugify(query)}${citySafe ? `-${slugify(citySafe)}` : '-maroc'}`,
      note: 'Métamoteur, agrège plusieurs jobboards'
    },
    {
      name: 'Google Jobs',
      url: `https://www.google.com/search?q=${googleQ}&ibp=htl;jobs`,
      note: 'Widget offres d\u2019emploi de Google'
    },
    {
      name: 'Novojob Maroc',
      url: `https://www.google.com/search?q=site:novojob.com+${q}+Maroc`,
      note: 'Pas de recherche mot-clé publique — lien via Google'
    },
    {
      name: 'Careerlink.ma',
      url: `https://www.google.com/search?q=site:careerlink.ma+${q}`,
      note: 'Jobboard IT Maroc — lien via Google'
    },
    {
      name: 'Jobi.ma',
      url: `https://www.google.com/search?q=site:jobi.ma+${q}`,
      note: 'Catégorie IT & Tech — lien via Google'
    },
    {
      name: 'AmalJob',
      url: `https://www.google.com/search?q=site:amaljob.com+${q}`,
      note: 'Portail marocain — lien via Google'
    },
    {
      name: 'Dreamjob.ma',
      url: `https://www.google.com/search?q=site:dreamjob.ma+${q}`,
      note: 'Rubrique Informatique/IT — lien via Google'
    },
    {
      name: 'OptionCarriere Maroc',
      url: `https://www.optioncarriere.ma/emploi?s=${q}&l=${cityQ}`,
      note: 'URL non vérifiable en direct (protection anti-bot) — à tester'
    }
  ];
}

// --- Routes ------------------------------------------------------------
app.get('/api/domains', (req, res) => {
  res.json({ domains: DOMAINS, cities: MOROCCO_CITIES });
});

app.get('/api/search', async (req, res) => {
  console.log('[API] /api/search reçu — query complète:', req.query);
  const { domain, custom, city, includeAggregated } = req.query;

  let terms = [];
  if (domain && DOMAINS[domain] && domain !== 'custom') {
    terms = DOMAINS[domain].terms;
  } else if (custom) {
    terms = [custom];
  } else {
    return res.status(400).json({ error: 'missing_query' });
  }

  const primaryTerm = terms[0];

  // On n'appelle JSearch (et donc le quota API) que si explicitement demandé.
  const jsearchResult = includeAggregated === 'true'
    ? await searchJSearch(primaryTerm, city)
    : { error: 'not_requested', jobs: [] };

  const links = buildMoroccoLinks(primaryTerm, city);

  res.json({
    query: primaryTerm,
    city: city || 'Toutes villes',
    jsearch: jsearchResult,
    moroccoLinks: links
  });
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, hasApiKey: !!RAPIDAPI_KEY });
});

app.listen(PORT, () => {
  console.log(`JobFinder Maroc en écoute sur http://localhost:${PORT}`);
  if (!RAPIDAPI_KEY) {
    console.log('⚠️  RAPIDAPI_KEY manquante dans .env — les résultats JSearch (Indeed/LinkedIn) seront désactivés, seuls les liens directs marchent.');
  }
});
