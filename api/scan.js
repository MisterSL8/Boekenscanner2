// api/scan.js
// Stabiele cloudcode: Regelt de database en winstberekening zonder storingsgevoelige Bol-koppelingen

export default async function handler(req, res) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // 1. Haal de voorraadlijst op uit Supabase (GET)
  if (req.method === 'GET' && req.query.action === 'list') {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/boeken_voorraad?select=*&order=id.desc`, {
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      const data = await response.json();
      return res.status(200).json(data);
  }

  // 2. Sla een boek op in Supabase (POST)
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

  // 3. Bereken de marges direct lokaal op basis van het ingevoerde ISBN (Altijd succes!)
  if (req.method === 'GET') {
    const { ean } = req.query;
    if (!ean) return res.status(400).json({ error: 'Geen EAN meegegeven' });

    try {
      // Omdat de bol-server blokkeert, schatten we de berekening op een gemiddelde verkoopprijs van €14.95
      // Je kunt dit in het resultatenscherm live controleren via de directe Bol-knop
      const geschattePrijs = 14.95; 
      const titel = `Boek met ISBN ${ean}`;

      // Winst-Calculator (Boek Laser Formule)
      const bolCommissie = 0.99 + (geschattePrijs * 0.15);
      const verzendkosten = 4.25;
      const nettoWinst = geschattePrijs - bolCommissie - verzendkosten;

      // SKU Generator
      const huidigJaar = new Date().getFullYear();
      const gegenereerdeSku = `B-${ean.substring(9, 13)}-${huidigJaar}`;

      // Stuur de berekende data direct terug
      return res.status(200).json({
          ean: ean,
          title: titel,
          price: geschattePrijs,
          profit: nettoWinst > 0 ? nettoWinst : 0,
          salesRankText: "Check via Bol",
          salesRankColor: "#2563eb",
          sku: gegenereerdeSku,
          bolUrl: `https://bol.com{ean}` // De directe link naar het echte boek
      });

    } catch (error) {
      return res.status(500).json({ error: true, message: error.message });
    }
  }
}
