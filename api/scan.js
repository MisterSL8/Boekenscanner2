// api/scan.js
// Dit is de officieel gecorrigeerde cloud-servercode voor Vercel

export default async function handler(req, res) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // VERZOEK 1: Haal de voorraadlijst op uit Supabase
  if (req.method === 'GET' && req.query.action === 'list') {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/boeken_voorraad?select=*&order=id.desc`, {
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      const data = await response.json();
      return res.status(200).json(data);
  }

  // VERZOEK 2: Sla een boek op in Supabase
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

  // VERZOEK 3: Live data ophalen bij Bol.com (Gecorrigeerd!)
  if (req.method === 'GET') {
    const { ean } = req.query;
    if (!ean) return res.status(400).json({ error: 'Geen EAN meegegeven' });

    try {
      // 1. Vraag OAuth-token aan via de exacte bol.com methode
      const credentials = Buffer.from(`${process.env.BOL_CLIENT_ID}:${process.env.BOL_CLIENT_SECRET}`).toString('base64');
      
      const tokenRes = await fetch('https://login.bol.com/token?grant_type=client_credentials', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Accept': 'application/json'
        }
      });
      
      if (!tokenRes.ok) {
          const errorToken = await tokenRes.text();
          throw new Error(`Bol.com Login Geweigerd: ${errorToken}`);
      }
      
      const tokenData = await tokenRes.json();
      const token = tokenData.access_token;

      // 2. Haal de live productaanbiedingen op (Let op het juiste v10 endpoint)
      const bolRes = await fetch(`https://bol.com{ean}/offers`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.retailer.v10+json'
        }
      });
      
      if(!bolRes.ok) {
          return res.status(200).json({ error: true, message: "Boek niet actief op bol.com" });
      }
      
      const bolData = await bolRes.json();

      // Controleer of er daadwerkelijk actieve aanbiedingen zijn
      if (!bolData.offers || bolData.offers.length === 0) {
          return res.status(200).json({ error: true, message: "Geen aanbieders gevonden" });
      }

      // Pak de prijs van de allerlaagste tweedehands of nieuwe aanbieder
      const livePrijs = bolData.offers[0].price; 
      const titel = bolData.offers[0].title || "Onbekende Titel";
      const salesRank = bolData.offers[0].salesRank || 25000;

      // 3. Winst-Calculator (Boek Laser Formule)
      const bolCommissie = 0.99 + (livePrijs * 0.15);
      const verzendkosten = 4.25;
      const nettoWinst = livePrijs - bolCommissie - verzendkosten;

      // 4. Sales Rank Indicator (Kleurencodes)
      let rankText = "Snel"; let rankColor = "#10b981"; 
      if(salesRank > 5000 && salesRank <= 50000) { rankText = "Gemiddeld"; rankColor = "#f59e0b"; } 
      if(salesRank > 50000) { rankText = "Langzaam"; rankColor = "#ef4444"; } 

      // 5. SKU Generator
      const huidigJaar = new Date().getFullYear();
      const gegenereerdeSku = `B-${ean.substring(9, 13)}-${huidigJaar}`;

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
      return res.status(500).json({ error: true, message: error.message });
    }
  }
}
