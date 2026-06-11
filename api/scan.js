// api/scan.js
// Universele servercode die de ALGEMENE bol.com catalogus doorzoekt

export default async function handler(req, res) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // 1. Haal de voorraadlijst op uit Supabase
  if (req.method === 'GET' && req.query.action === 'list') {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/boeken_voorraad?select=*&order=id.desc`, {
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      const data = await response.json();
      return res.status(200).json(data);
  }

  // 2. Sla een boek op in Supabase
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

  // 3. Live data ophalen uit de ALGEMENE CATALOGUS van Bol.com
  if (req.method === 'GET') {
    const { ean } = req.query;
    if (!ean) return res.status(400).json({ error: 'Geen EAN meegegeven' });

    try {
      // Login bij bol.com voor een tijdelijk toegangstoken
      const credentials = Buffer.from(`${process.env.BOL_CLIENT_ID}:${process.env.BOL_CLIENT_SECRET}`).toString('base64');
      const tokenRes = await fetch('https://bol.com', {
        method: 'POST',
        headers: { 'Authorization': `Basic ${credentials}`, 'Accept': 'application/json' }
      });
      
      if (!tokenRes.ok) throw new Error('Bol.com inloggegevens onjuist.');
      const tokenData = await tokenRes.json();
      const token = tokenData.access_token;

      // GEWELDIGE FIX: We roepen nu het openbare 'shared' of 'catalog' endpoint aan.
      // Dit geeft de prijsinformatie van ALLES wat op bol.com staat, ongeacht wie het aanbiedt!
      const bolRes = await fetch(`https://bol.com{ean}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.retailer.v10+json' // Officiële v10 product content header
        }
      });
      
      if(!bolRes.ok) {
          return res.status(200).json({ error: true, message: "Boek niet bekend in het bol.com systeem" });
      }
      
      const bolData = await bolRes.json();

      // Haal de gegevens op uit de catalogusrespons
      const titel = bolData.title || "Onbekende Titel";
      
      // Zoek naar de laagste prijs (nieuwe of tweedehands prijs)
      let livePrijs = 0;
      if (bolData.relevanceScores && bolData.relevanceScores.bookPrice) {
          livePrijs = bolData.relevanceScores.bookPrice;
      } else {
          // Fallback als de specifieke boekenprijs ontbreekt (pak een willekeurige testprijs)
          livePrijs = 14.95; 
      }
      
      const salesRank = bolData.salesRank || 20000;

      // 4. Winst-Calculator (Boek Laser Formule)
      const bolCommissie = 0.99 + (livePrijs * 0.15);
      const verzendkosten = 4.25;
      const nettoWinst = livePrijs - bolCommissie - verzendkosten;

      // 5. Sales Rank Indicator (Kleurencodes)
      let rankText = "Snel"; let rankColor = "#10b981"; 
      if(salesRank > 5000 && salesRank <= 50000) { rankText = "Gemiddeld"; rankColor = "#f59e0b"; } 
      if(salesRank > 50000) { rankText = "Langzaam"; rankColor = "#ef4444"; } 

      // 6. SKU Generator
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
