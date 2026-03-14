export const config = { runtime: "edge" };

export default async function handler(req) {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  try {
    const body = await req.json();
    const { mode, athlete, perfs, blocs, session_type } = body;
    // mode = "planning" (conseils séance du planning) | "session" (intervals séance libre) | "muscu" (estimation 1RM)

    const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
    if (!ANTHROPIC_KEY) return new Response(JSON.stringify({ error: "Clé API manquante" }), { status: 500 });

    // ─── Construire le profil athlète ───
    const best2k = perfs?.filter(p => (p.distance_type || "2000m") === "2000m").sort((a, b) => {
      const toSec = t => { if (!t) return 9999; const [m, s] = t.split(":"); return +m * 60 + parseFloat(s); };
      return toSec(a.time) - toSec(b.time);
    })[0];
    const best1k = perfs?.filter(p => p.distance_type === "1000m").sort((a, b) => {
      const toSec = t => { if (!t) return 9999; const [m, s] = t.split(":"); return +m * 60 + parseFloat(s); };
      return toSec(a.time) - toSec(b.time);
    })[0];
    const lastPerf = perfs?.slice(-1)[0];

    const athleteProfile = `
Athlète: ${athlete.name || "Inconnu"}
Catégorie: ${athlete.category || "-"}
Âge: ${athlete.age || "-"} ans
Poids: ${athlete.weight || "-"} kg
Taille: ${athlete.height || "-"} cm
Envergure: ${athlete.envergure || "-"} cm
Meilleur 2000m: ${best2k?.time || "-"} (${best2k?.watts || "-"}W)
Meilleur 1000m: ${best1k?.time || "-"}
Dernière puissance: ${lastPerf?.watts || "-"}W
W/kg: ${lastPerf?.watts && athlete.weight ? (lastPerf.watts / athlete.weight).toFixed(2) : "-"}
`.trim();

    let systemPrompt, userPrompt;

    if (mode === "planning") {
      // Conseils pour une séance du planning
      const blocsStr = blocs.map(b => `- ${b.titre}: ${b.detail || ""}`).join("\n");
      systemPrompt = `Tu es un entraîneur aviron expert FFAviron. Réponds UNIQUEMENT en JSON valide, sans markdown.
Format: {"conseils": [{"bloc": "nom du bloc", "intensite": "description zone", "allure": "X:XX/500m", "watts": "XXX-XXX", "cadence": "XX-XX spm", "conseil": "conseil court"}], "intro": "phrase courte de mise en contexte"}`;
      userPrompt = `${athleteProfile}

Séance prévue (${session_type}):
${blocsStr}

Génère des indications personnalisées pour chaque bloc: allures cibles, watts, cadence, et un conseil spécifique à cet athlète.`;

    } else if (mode === "session") {
      // Intervalles pour séance libre ergo/bateau
      const blocsStr = blocs.map(b => `- ${b.titre}`).join("\n");
      systemPrompt = `Tu es un entraîneur aviron expert FFAviron. Réponds UNIQUEMENT en JSON valide, sans markdown.
Format: {"blocs": [{"titre": "nom", "allure": "X:XX/500m", "watts": "XXX", "cadence": "XX", "conseil": "court"}]}`;
      userPrompt = `${athleteProfile}

Séance ${session_type} prévue:
${blocsStr}

Génère les cibles personnalisées (allure /500m, watts, cadence) pour chaque bloc.`;

    } else if (mode === "muscu") {
      // Estimation 1RM et charges cibles
      const blocsStr = blocs.map(b => `- ${b.titre}`).join("\n");
      systemPrompt = `Tu es un préparateur physique expert aviron. Réponds UNIQUEMENT en JSON valide, sans markdown.
Format: {"blocs": [{"titre": "exercice", "charge_cible": "XX-XXkg", "series_reps": "Xx10", "rpe_cible": "X/10", "conseil": "court", "estimation_1rm": "XXkg si applicable"}]}`;
      userPrompt = `${athleteProfile}

Séance muscu - exercices prévus:
${blocsStr}

En te basant sur le poids, la catégorie, l'âge et le niveau de puissance de cet athlète, estime les charges de travail appropriées et le 1RM estimé si pertinent.`;
    }

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    const data = await resp.json();
    const text = data.content?.[0]?.text || "{}";

    // Nettoyer le JSON
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    return new Response(JSON.stringify(parsed), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
