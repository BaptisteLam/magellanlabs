import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InvoiceLine {
  designation: string;
  description?: string;
  quantity: number;
  unit: string;
  unit_price_ht: number;
  tva_rate: number;
  discount_percent: number;
}

interface InvoiceData {
  type_document: "devis" | "facture";
  informations_document: {
    numero: string;
    date_document: string;
    date_validite_ou_echeance: string;
  };
  emetteur: {
    nom_societe: string;
    forme_juridique?: string;
    siret?: string;
    tva?: string;
    adresse: string;
    email: string;
    telephone: string;
  };
  client: {
    nom: string;
    email: string;
    telephone?: string;
    adresse: string;
  };
  lignes: InvoiceLine[];
  conditions_paiement?: string;
  mode_paiement?: string;
  references_bancaires?: string;
  mentions_legales?: string;
  options_template: {
    url_logo?: string;
    couleur_principale: string;
  };
  prompt_libre: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not configured");
    }

    const invoiceData: InvoiceData = await req.json();

    // Calcul des totaux
    let sous_total_ht = 0;
    let montant_total_remises = 0;
    let total_tva = 0;

    for (const ligne of invoiceData.lignes) {
      const montant_ligne_ht = ligne.quantity * ligne.unit_price_ht;
      const remise = montant_ligne_ht * (ligne.discount_percent / 100);
      const montant_apres_remise = montant_ligne_ht - remise;
      const tva_ligne = montant_apres_remise * (ligne.tva_rate / 100);

      sous_total_ht += montant_ligne_ht;
      montant_total_remises += remise;
      total_tva += tva_ligne;
    }

    const total_ht = sous_total_ht - montant_total_remises;
    const total_ttc = total_ht + total_tva;

    const systemPrompt = `Tu es un générateur de documents commerciaux professionnels en français (devis et factures).
Tu dois produire un document HTML A4 imprimable, professionnel et esthétique.

RÈGLES STRICTES:
- Toujours répondre en français
- Utiliser la couleur principale fournie pour les titres, en-têtes de tableau, et total TTC
- Si des informations sont manquantes, afficher "À compléter" plutôt que d'inventer
- Ne jamais générer d'images, uniquement référencer le logo s'il est fourni
- Produire uniquement le JSON demandé, aucun texte avant ou après

FORMAT DE RÉPONSE (JSON uniquement):
{
  "type_document": "devis" ou "facture",
  "resume_court": "Description en 1-2 phrases",
  "totaux_calcules": {
    "sous_total_ht": nombre,
    "montant_total_remises": nombre,
    "total_ht": nombre,
    "total_tva": nombre,
    "total_ttc": nombre
  },
  "document_html": "<html>...</html>"
}

Le document_html doit:
- Être au format A4 (210mm x 297mm) avec marges
- Inclure en ordre: logo/émetteur, client, titre, tableau des lignes, totaux, conditions, mentions
- Utiliser un style professionnel et épuré
- Le tableau doit avoir des colonnes: Désignation, Qté, Unité, Prix U. HT, TVA, Remise, Total HT`;

    const userPrompt = `Génère un ${invoiceData.type_document} avec les informations suivantes:

TYPE: ${invoiceData.type_document.toUpperCase()}

INFORMATIONS DOCUMENT:
- Numéro: ${invoiceData.informations_document.numero}
- Date: ${invoiceData.informations_document.date_document}
- ${invoiceData.type_document === 'devis' ? 'Date de validité' : "Date d'échéance"}: ${invoiceData.informations_document.date_validite_ou_echeance}

ÉMETTEUR:
- Société: ${invoiceData.emetteur.nom_societe}
${invoiceData.emetteur.forme_juridique ? `- Forme juridique: ${invoiceData.emetteur.forme_juridique}` : ''}
${invoiceData.emetteur.siret ? `- SIRET: ${invoiceData.emetteur.siret}` : ''}
${invoiceData.emetteur.tva ? `- TVA: ${invoiceData.emetteur.tva}` : ''}
- Adresse: ${invoiceData.emetteur.adresse}
- Email: ${invoiceData.emetteur.email}
- Téléphone: ${invoiceData.emetteur.telephone}

CLIENT:
- Nom: ${invoiceData.client.nom}
- Email: ${invoiceData.client.email}
${invoiceData.client.telephone ? `- Téléphone: ${invoiceData.client.telephone}` : ''}
- Adresse: ${invoiceData.client.adresse}

LIGNES DE PRESTATIONS:
${invoiceData.lignes.map((l, i) => `${i + 1}. ${l.designation}
   ${l.description ? `Description: ${l.description}` : ''}
   Quantité: ${l.quantity} ${l.unit}
   Prix unitaire HT: ${l.unit_price_ht}€
   TVA: ${l.tva_rate}%
   Remise: ${l.discount_percent}%`).join('\n')}

TOTAUX PRÉ-CALCULÉS:
- Sous-total HT: ${sous_total_ht.toFixed(2)}€
- Total remises: ${montant_total_remises.toFixed(2)}€
- Total HT: ${total_ht.toFixed(2)}€
- Total TVA: ${total_tva.toFixed(2)}€
- Total TTC: ${total_ttc.toFixed(2)}€

CONDITIONS:
${invoiceData.conditions_paiement ? `- Conditions de paiement: ${invoiceData.conditions_paiement}` : ''}
${invoiceData.mode_paiement ? `- Mode de paiement: ${invoiceData.mode_paiement}` : ''}
${invoiceData.references_bancaires ? `- Références bancaires: ${invoiceData.references_bancaires}` : ''}
${invoiceData.mentions_legales ? `- Mentions légales: ${invoiceData.mentions_legales}` : ''}

TEMPLATE:
- Couleur principale: ${invoiceData.options_template.couleur_principale}
${invoiceData.options_template.url_logo ? `- Logo: ${invoiceData.options_template.url_logo}` : '- Pas de logo'}

INSTRUCTIONS SUPPLÉMENTAIRES DE L'UTILISATEUR:
${invoiceData.prompt_libre || 'Aucune instruction spécifique'}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-haiku-20241022",
        max_tokens: 8000,
        messages: [
          { role: "user", content: userPrompt }
        ],
        system: systemPrompt,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Claude API error:", errorText);
      throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.content[0]?.text || "";

    // Parse JSON response
    let parsedResult;
    try {
      // Extract JSON from response (handle potential markdown code blocks)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("Parse error:", parseError, "Content:", content);
      // Fallback with pre-calculated values
      parsedResult = {
        type_document: invoiceData.type_document,
        resume_court: `${invoiceData.type_document === 'devis' ? 'Devis' : 'Facture'} généré(e) pour ${invoiceData.client.nom}`,
        totaux_calcules: {
          sous_total_ht,
          montant_total_remises,
          total_ht,
          total_tva,
          total_ttc
        },
        document_html: generateFallbackHTML(invoiceData, { sous_total_ht, montant_total_remises, total_ht, total_tva, total_ttc })
      };
    }

    return new Response(JSON.stringify({
      success: true,
      ...parsedResult,
      tokens: {
        input: data.usage?.input_tokens || 0,
        output: data.usage?.output_tokens || 0
      }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});

function generateFallbackHTML(data: InvoiceData, totaux: { sous_total_ht: number; montant_total_remises: number; total_ht: number; total_tva: number; total_ttc: number }) {
  const color = data.options_template.couleur_principale || "#03A5C0";
  const isDevis = data.type_document === "devis";
  
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 12px; color: #333; padding: 40px; max-width: 210mm; }
    .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
    .logo img { max-height: 60px; }
    .emetteur { text-align: right; font-size: 11px; }
    .titre { color: ${color}; font-size: 28px; font-weight: bold; margin: 30px 0; text-transform: uppercase; }
    .info-doc { background: #f5f5f5; padding: 15px; border-radius: 8px; margin-bottom: 30px; }
    .client { margin-bottom: 30px; }
    .client h3 { color: ${color}; margin-bottom: 10px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th { background: ${color}; color: white; padding: 12px 8px; text-align: left; font-size: 11px; }
    td { padding: 12px 8px; border-bottom: 1px solid #eee; }
    .totaux { text-align: right; margin-top: 20px; }
    .totaux div { padding: 5px 0; }
    .total-ttc { font-size: 18px; font-weight: bold; color: ${color}; border-top: 2px solid ${color}; padding-top: 10px; margin-top: 10px; }
    .conditions { margin-top: 40px; font-size: 10px; color: #666; border-top: 1px solid #eee; padding-top: 20px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">${data.options_template.url_logo ? `<img src="${data.options_template.url_logo}" alt="Logo">` : ''}</div>
    <div class="emetteur">
      <strong>${data.emetteur.nom_societe}</strong>${data.emetteur.forme_juridique ? ` - ${data.emetteur.forme_juridique}` : ''}<br>
      ${data.emetteur.adresse}<br>
      ${data.emetteur.email}<br>
      ${data.emetteur.telephone}
      ${data.emetteur.siret ? `<br>SIRET: ${data.emetteur.siret}` : ''}
      ${data.emetteur.tva ? `<br>TVA: ${data.emetteur.tva}` : ''}
    </div>
  </div>
  
  <h1 class="titre">${isDevis ? 'Devis' : 'Facture'}</h1>
  
  <div class="info-doc">
    <strong>N° ${data.informations_document.numero}</strong><br>
    Date: ${data.informations_document.date_document}<br>
    ${isDevis ? 'Valable jusqu\'au' : 'Échéance'}: ${data.informations_document.date_validite_ou_echeance}
  </div>
  
  <div class="client">
    <h3>Client</h3>
    <strong>${data.client.nom}</strong><br>
    ${data.client.adresse}<br>
    ${data.client.email}
    ${data.client.telephone ? `<br>${data.client.telephone}` : ''}
  </div>
  
  <table>
    <thead>
      <tr>
        <th>Désignation</th>
        <th>Qté</th>
        <th>Unité</th>
        <th>Prix U. HT</th>
        <th>TVA</th>
        <th>Remise</th>
        <th>Total HT</th>
      </tr>
    </thead>
    <tbody>
      ${data.lignes.map(l => {
        const total = l.quantity * l.unit_price_ht * (1 - l.discount_percent / 100);
        return `<tr>
          <td>${l.designation}${l.description ? `<br><small style="color:#666">${l.description}</small>` : ''}</td>
          <td>${l.quantity}</td>
          <td>${l.unit}</td>
          <td>${l.unit_price_ht.toFixed(2)} €</td>
          <td>${l.tva_rate}%</td>
          <td>${l.discount_percent > 0 ? `-${l.discount_percent}%` : '-'}</td>
          <td>${total.toFixed(2)} €</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>
  
  <div class="totaux">
    <div>Sous-total HT: ${totaux.sous_total_ht.toFixed(2)} €</div>
    ${totaux.montant_total_remises > 0 ? `<div>Remises: -${totaux.montant_total_remises.toFixed(2)} €</div>` : ''}
    <div>Total HT: ${totaux.total_ht.toFixed(2)} €</div>
    <div>TVA: ${totaux.total_tva.toFixed(2)} €</div>
    <div class="total-ttc">Total TTC: ${totaux.total_ttc.toFixed(2)} €</div>
  </div>
  
  <div class="conditions">
    ${data.conditions_paiement ? `<p><strong>Conditions:</strong> ${data.conditions_paiement}</p>` : ''}
    ${data.mode_paiement ? `<p><strong>Mode de paiement:</strong> ${data.mode_paiement}</p>` : ''}
    ${data.references_bancaires ? `<p><strong>Coordonnées bancaires:</strong> ${data.references_bancaires}</p>` : ''}
    ${data.mentions_legales ? `<p>${data.mentions_legales}</p>` : ''}
  </div>
</body>
</html>`;
}
