export const config = { runtime: "edge" };

const SYSTEM_PROMPT = `Tu es un expert en périodisation pour l'aviron. Réponds UNIQUEMENT en JSON valide sans markdown.

FORMAT STRICT - sois très concis dans chaque champ :
{
  "plan_name": "string",
  "description": "string (1 phrase)",
  "semaines": [
    {
      "num_semaine": 1,
      "type_semaine": "CONSTRUCTION",
      "charge": "Modérée",
      "objectif": "string (5 mots max)",
      "notes": "string (1 phrase)",
      "seances": [
        {
          "jour": "Lundi",
          "type_seance": "ERGO",
          "titre": "string court",
          "duree_min": 60,
          "charge": "Modérée",
          "contenu": {
            "objectif": "string court",
            "echauffement": "10min Z1",
            "partie_principale": "ex: 4x8min Z3 r:3min",
            "retour_calme": "10min Z1",
            "notes_coach": "string court"
          }
        }
      ]
    }
  ]
}

Types semaine : CONSTRUCTION, CHARGE, DÉCHARGE, SURCOMPENSATION, AFFÛTAGE, COMPÉTITION
Types séance : ERGO, BATEAU, MUSCU, RECUP, TEST, COMPETITION
Zones : Z1 à Z7. Cycle 3+1 (3 semaines charge + 1 décharge). Affûtage 1 semaine avant régate.`;

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

  // Limiter à 6 semaines max pour éviter les timeouts
  const semaines_effectives = Math.min(nb_semaines || 4, 6);

  const userPrompt = `Plan aviron ${semaines_effectives} semaines.
Distance : ${distance} | Catégorie : ${categorie} | Niveau : ${niveau}
Début : ${date_debut} | Régate : ${date_regate}
Jours : ${(jours||[]).join(", ")} (${(jours||[]).length} jours/semaine)
Objectif : ${objectif_specifique || "Performance optimale"}

Génère exactement ${semaines_effectives} semaines, séances UNIQUEMENT les jours listés.
Contenu très concis (format compact type "4x8min Z3 r:3min").`;

  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 3000,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      return new Response(JSON.stringify({ error: "Erreur API: " + err }), { status: 500 });
    }

    const data = await resp.json();
    const raw = data.content?.[0]?.text || "";
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    let parsed;
    try { parsed = JSON.parse(cleaned); } catch {
      return new Response(JSON.stringify({ error: "JSON invalide", raw: raw.substring(0, 200) }), { status: 500 });
    }

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
