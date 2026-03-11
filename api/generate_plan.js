export const config = { runtime: "nodejs", maxDuration: 60 };

const SYSTEM_PROMPT = `Tu es un expert en entraînement d'aviron avec 20 ans d'expérience en périodisation sportive.
Tu génères des plans d'entraînement structurés selon les principes de la périodisation (Matveyev, Tudor Bompa) adaptés à l'aviron.

RÈGLES STRICTES :
- Réponds UNIQUEMENT avec du JSON valide, sans markdown, sans texte autour
- Structure de sortie exacte imposée ci-dessous
- Les types de semaine possibles : TRANSITION, CONSTRUCTION, CHARGE 1, CHARGE 2, DÉCHARGE, SURCOMPENSATION, SPÉCIFIQUE, AFFÛTAGE, COMPÉTITION, RECONSTRUCTION
- Les charges possibles : Légère, Modérée, Élevée, Maximale, Compétition
- Les types de séance : MUSCU, ERGO, BATEAU, RECUP, REPOS, TEST, COMPETITION
- Les jours : Lundi, Mardi, Mercredi, Jeudi, Vendredi, Samedi, Dimanche
- Respecte EXACTEMENT les jours d'entraînement fournis
- Adapte le contenu à la distance cible et à la catégorie

PRINCIPES DE PÉRIODISATION À APPLIQUER :
- Progression de la charge sur 3 semaines puis décharge (cycle 3+1)
- Surcompensation 1-2 semaines avant compétition
- Affûtage la semaine précédant la compétition (volume -40%, intensité maintenue)
- Semaine compétition : très légère + échauffements
- Adapter les intensités aux zones : Z1 (régénération), Z2 (endurance fondamentale), Z3 (seuil aérobie), Z4 (seuil anaérobie), Z5 (VO2max), Z6 (anaérobie lactique), Z7 (sprint)

FORMAT JSON DE SORTIE :
{
  "plan_name": "string",
  "description": "string (résumé de la stratégie)",
  "semaines": [
    {
      "num_semaine": 1,
      "type_semaine": "CONSTRUCTION",
      "charge": "Modérée",
      "objectif": "string court",
      "notes": "string détaillé sur les intentions de la semaine",
      "seances": [
        {
          "jour": "Lundi",
          "type_seance": "ERGO",
          "titre": "string",
          "duree_min": 60,
          "charge": "Modérée",
          "contenu": {
            "objectif": "string",
            "echauffement": "string",
            "partie_principale": "string détaillé avec distances/temps/intensités/zones",
            "retour_calme": "string",
            "notes_coach": "string"
          }
        }
      ]
    }
  ]
}`;

export default async function handler(req) {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Clé API Anthropic manquante" }), { status: 500 });
  }

  let body;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "Body invalide" }), { status: 400 });
  }

  const { nb_semaines, date_debut, date_regate, distance, categorie, jours, niveau, objectif_specifique } = body;

  const userPrompt = `Génère un plan d'entraînement d'aviron avec ces paramètres :

- Durée : ${nb_semaines} semaines
- Date de début : ${date_debut}
- Date de compétition : ${date_regate}
- Distance cible : ${distance}
- Catégorie : ${categorie}
- Niveau : ${niveau}
- Jours d'entraînement disponibles : ${jours.join(", ")} (${jours.length} jours/semaine)
- Objectif spécifique : ${objectif_specifique || "Performance optimale le jour J"}

Génère exactement ${nb_semaines} semaines avec des séances UNIQUEMENT les jours : ${jours.join(", ")}.
Applique une périodisation intelligente en tenant compte de la date de régate.
Pour la distance ${distance}, adapte les types de séances (pour 500m : plus de travail en Z6-Z7 ; pour 1000m : équilibre Z4-Z6 ; pour 2000m : base aérobie Z3-Z4 dominante).
Sois précis dans les contenus : donne des distances, des temps de travail/récup, des cadences (allures/500m ou SPM).`;

  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4000,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      return new Response(JSON.stringify({ error: "Erreur API Anthropic: " + err }), { status: 500 });
    }

    const data = await resp.json();
    const raw = data.content?.[0]?.text || "";

    // Nettoyer le JSON (enlever les éventuels backticks markdown)
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    let parsed;
    try { parsed = JSON.parse(cleaned); } catch {
      return new Response(JSON.stringify({ error: "JSON invalide reçu", raw }), { status: 500 });
    }

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
