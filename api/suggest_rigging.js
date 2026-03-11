export const config = { runtime: "edge" };

const SYSTEM_PROMPT = `Tu es un expert en réglages d'aviron (rigging) avec 25 ans d'expérience en compétition internationale.
Tu maîtrises parfaitement la biomécanique du geste d'aviron et l'adaptation des réglages à la morphologie et au niveau des rameurs.

RÈGLES STRICTES :
- Réponds UNIQUEMENT avec du JSON valide, sans markdown, sans texte autour
- Toutes les valeurs numériques sont en centimètres sauf indication
- Sois précis : donne des valeurs chiffrées, pas des fourchettes vagues
- Explique ton raisonnement en français, de façon concise et pédagogique
- IMPORTANT: "longueur_pedale" dans ce contexte = longueur TOTALE de la pelle (manche + pale), typiquement entre 270 et 300 cm pour couple (ex: 284, 286, 288, 290cm), 370-395 cm pour pointe. Ce n'est PAS la hauteur des cale-pieds.
- IMPORTANT: Si type_nage = "pointe", NE PAS mettre de croisement (croisement = 0). Les réglages pointe sont fondamentalement différents du couple.

PRINCIPES BIOMÉCHANIQUES À APPLIQUER :

Couple :
- Entraxe standard : 158-160 cm, ajusté selon envergure (+ 1cm par 3cm d'envergure au-dessus de 183cm)
- Levier intérieur (inboard) : typiquement 88-90 cm pour couple, influence l'arc de nage
- Longueur totale pelle = levier intérieur + levier extérieur
- Croisement = 2 × levier_intérieur - entraxe (formule de base, l'IA peut nuancer)
- Longueur pédale : influencée par taille assise et longueur des bras

Pointe :
- Entraxe (spread) : typiquement 80-90 cm (standard ~85cm), ajusté selon envergure
- Levier intérieur (inboard) : typiquement 113-120 cm (standard ~115cm pour couple/pointe mixte, 117-120 pour pointe pure)
- Longueur totale pelle : 370-395 cm pour pointe (pelles plus longues qu'en couple)
- PAS DE CROISEMENT en pointe (la pelle est d'un seul côté) → mettre croisement = 0 ou null
- Arc de nage plus grand qu'en couple → adapter le levier selon longueur des bras

Facteurs d'ajustement :
- Rameur puissant (W/kg élevé) → peut supporter un levier extérieur plus long (+ charge)
- Rameur débutant → réglages plus conservateurs, marge de confort
- Bras longs → arc de nage plus grand → ajuster levier intérieur en conséquence
- Envergure > taille → tendance bras longs, adapter entraxe et levier
- Pelle Fat 2 vs Smoothie 2 : Fat 2 crée plus de résistance, compenser par levier ext légèrement plus court

FORMAT JSON DE SORTIE (un seul poste) :
{
  "athlete": "string",
  "poste": number,
  "type_nage": "couple|pointe",
  "reglages": {
    "entraxe": number,
    "longueur_pedale": number,
    "levier_interieur": number,
    "levier_exterieur": number,
    "croisement": number
  },
  "_note": "longueur_pedale = longueur TOTALE de la pelle en cm (typiquement 270-300cm, ex: 286cm). PAS la position des cale-pieds.",
  "raisonnement": {
    "morpho": "string - analyse morpho et impact sur les réglages",
    "puissance": "string - analyse du profil de puissance",
    "pelle": "string - impact du type de pelle choisi",
    "points_attention": ["string", "string"]
  }
}

FORMAT JSON DE SORTIE (plusieurs postes) :
{
  "bateau": "string",
  "type_nage": "couple|pointe",
  "synthese": "string - stratégie globale pour ce bateau",
  "postes": [
    {
      "poste": number,
      "athlete": "string",
      "reglages": {
        "entraxe": number,
        "longueur_pedale": number,
        "levier_interieur": number,
        "levier_exterieur": number,
        "croisement": number
      },
      "notes": "string - justification spécifique à ce rameur"
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

  const { mode, bateau, athlete, poste, paddle } = body;
  // mode = "single" (un poste) | "all" (tous les postes)

  let userPrompt;

  if (mode === "single") {
    const a = athlete;
    userPrompt = `Suggère les réglages pour ce rameur sur ce poste :

BATEAU :
- Nom : ${bateau.name}
- Type de nage : ${bateau.type} (${bateau.type === "couple" ? "deux pelles par rameur" : "une pelle par rameur"})
- Nombre de postes : ${bateau.seats}

RAMEUR (Poste #${poste}) :
- Nom : ${a.name}
- Catégorie : ${a.category}
- Poids : ${a.weight || "non renseigné"} kg
- Taille : ${a.taille || "non renseignée"} cm
- Envergure : ${a.envergure || "non renseignée"} cm
- Longueur des bras : ${a.longueur_bras || "non renseignée"} cm
${a.wpkg ? `- Puissance : ${a.wpkg} W/kg (estimé sur 2000m)` : "- Puissance : non disponible"}
${a.watts ? `- Puissance absolue : ${a.watts} W` : ""}
${a.best_time ? `- Meilleur temps : ${a.best_time}` : ""}
- Niveau estimé : ${a.wpkg > 3 ? "Avancé" : a.wpkg > 2 ? "Intermédiaire" : "Débutant/non renseigné"}

PELLE :
- Numéro : ${paddle?.numero || "non sélectionnée"}
- Marque : ${paddle?.marque || "inconnue"}
- Modèle : ${paddle?.modele || "inconnu"}
- Type de nage pelle : ${paddle?.type_nage || bateau.type}
- Plage de réglage : ${paddle?.plage_reglage || "non renseignée"} cm

Génère les réglages optimaux pour ce rameur. Si certaines données morpho sont manquantes, utilise les standards pour la catégorie et le type de nage, et signale-le dans le raisonnement.`;

  } else {
    // mode "all" - tous les postes
    const postes = body.postes; // [{poste, athlete, paddle}]
    const postes_str = postes.map(p => {
      const a = p.athlete;
      if (!a) return `Poste #${p.poste} : Rameur non assigné`;
      return `Poste #${p.poste} — ${a.name} (${a.category})
  Poids: ${a.weight||"?"} kg | Taille: ${a.taille||"?"} cm | Envergure: ${a.envergure||"?"} cm | Bras: ${a.longueur_bras||"?"} cm
  Puissance: ${a.wpkg||"?"} W/kg | ${a.watts||"?"}W
  Pelle: ${p.paddle ? `${p.paddle.marque} ${p.paddle.modele} (${p.paddle.plage_reglage||"?"}cm)` : "non assignée"}`;
    }).join("\n\n");

    userPrompt = `Génère les réglages pour TOUS les postes de ce bateau :

BATEAU :
- Nom : ${bateau.name}
- Type : ${bateau.type}
- Nombre de postes : ${bateau.seats}

ÉQUIPAGE :
${postes_str}

Pour chaque poste, fournis TOUS les réglages (entraxe, longueur_pedale, levier_interieur, levier_exterieur, croisement) — même si l'entraxe est identique pour tous les postes, répète-le pour chacun. Fournis aussi une synthèse de la stratégie de réglage pour l'équipage.`;
  }

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
        max_tokens: mode === "all" ? 4000 : 2000,
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
      return new Response(JSON.stringify({ error: "JSON invalide", raw }), { status: 500 });
    }

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
