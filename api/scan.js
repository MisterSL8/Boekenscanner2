// api/scan.js
// Dit bestand draait volledig afgeschermd in de cloudomgeving van Vercel.

export default async function handler(req, res) {
  // CONFIGURATIE: Supabase URL en Sleutels uit de omgevingsvariabelen halen
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // VERZOEK 1: Haal de opgeslagen voorraadlijst op uit Supabase (GET met action=list)
  if (req.method === 'GET' && req.query.action === 'list') {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/boeken_voorraad?select=*&order=id.desc`, {
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      const data = await response.json();
      return res.status(200).json(data);
  }

  // VERZOEK 2: Sla een nieuw gescand boek op in Supabase (POST)
  if (req.method === 'POST') {
      const boek = req.body;
      await fetch(`${SUPABASE_URL}/rest/v1/boeken_voorraad`, {
          method: 'POST',
          headers: { 
              'apikey': SUPABASE_KEY, 
              'Authorization': `Bearer ${SUPABASE_KEY}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=minimal'
          },
          body: JSON.stringify({
              ean: boek.ean,
              title: boek.title,
              price: boek.price,
              profit: boek.profit,
              sku: boek.sku
          })
      });
      return res.status(200).json({ success: true });
  }

  // VERZOEK 3: Het scannen van een boek (Standaard GET met een EAN/ISBN nummer)
  if (req.method === 'GET') {
    const { ean } = req.query;
    if (!ean) return res.status(400).json({ error: 'Geen EAN meegegeven' });

    try {
      // 1. Vraag OAuth-token aan bij bol.com Retailer API
      const tokenRes = await fetch('https://bol.com', {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(process.env.BOL_CLIENT_ID + ':' + process.env.BOL_CLIENT_SECRET).toString('base64'),
          'Content-Type': 'application/json'
        }
      });
      const tokenData = await tokenRes.json();
      const token = tokenData.access_token;

      // 2. Haal product- en prijsdata op via Bol API
      const bolRes = await fetch(`https://bol.com{ean}/offers`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.retailer.v10+json'
        }
      });
      if(!bolRes.ok) throw new Error('Niet gevonden op Bol');
      const bolData = await bolRes.json();

      // Pak de allerlaagste prijs uit de live aanbiedingen
      const livePrijs = bolData.offers[0].price; 
      const salesRank = bolData.offers[0].salesRank || 15000; // Fallback als rang ontbreekt
      const titel = bolData.offers[0].title || "Onbekend Boek";

      // 3. WINST-CALCULATOR LOGICA (Boek Laser Functie)
      // Formule: Prijs - Bol commissie (€0.99 vast + 15% variabel) - Pakketkosten (€4.25)
      const bolCommissie = 0.99 + (livePrijs * 0.15);
      const verzendkosten = 4.25;
      const nettoWinst = livePrijs - bolCommissie - verzendkosten;

      // 4. SALES RANK LOGICA (Boek Laser Kleurencodes)
      let rankText = "Snel"; let rankColor = "#10b981"; // Groen
      if(salesRank > 5000 && salesRank <= 50000) { rankText = "Gemiddeld"; rankColor = "#f59e0b"; } // Oranje
      if(salesRank > 50000) { rankText = "Langzaam"; rankColor = "#ef4444"; } // Rood

      // 5. GEAUTOMATISEERDE SKU GENERATOR
      const huidigJaar = new Date().getFullYear();
      const gegenereerdeSku = `B-${ean.substring(9, 13)}-${huidigJaar}`;

      // Stuur de verwerkte schone data terug naar de Android-telefoon
      return res.status(200).json({
          ean: ean,
          title: titel,
          price: livePrijs,
          profit: nettoWinst > 0 ? nettoWinst : 0,
          salesRankText: rankText,
          salesRankColor: rankColor,
          sku: gegenereerdeSku
      });

    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }
}
