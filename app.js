let momenteelGescandBoek = null;

window.addEventListener('DOMContentLoaded', () => {
    // Luister naar de handmatige zoekknop
    document.getElementById('btn-manual-search').addEventListener('click', () => {
        const handmatigIsbn = document.getElementById('manual-isbn').value.trim();
        if(handmatigIsbn.length === 13 && (handmatigIsbn.startsWith("978") || handmatigIsbn.startsWith("979"))) {
            verwerkIsbn(handmatigIsbn);
        } else {
            alert("Voer een geldig 13-cijferig ISBN in (begint met 978 of 979).");
        }
    });

    laadVoorraadUitDatabase();
});

// Verwerk het ISBN-nummer
async function verwerkIsbn(isbnNummer) {
    const resultCard = document.getElementById('result-card');
    resultCard.classList.remove('hidden');
    document.getElementById('res-title').innerText = "Berekening uitvoeren...";
    document.getElementById('res-isbn').innerText = isbnNummer;

    try {
        const response = await fetch(`/api/scan?ean=${isbnNummer}`);
        const data = await response.json();

        // Toon de lokale berekening op het scherm
        document.getElementById('res-title').innerHTML = `
            ${data.title} <br>
            <a href="${data.bolUrl}" target="_blank" style="display:inline-block; margin-top:8px; padding:6px 12px; background:#f59e0b; color:black; text-decoration:none; border-radius:4px; font-weight:bold; font-size:0.85rem;">
                🔍 Verifieer Live Prijs op Bol.com ↗
            </a>
        `;
        
        document.getElementById('res-price').innerText = `€ ${data.price.toFixed(2)}`;
        document.getElementById('res-profit').innerText = `€ ${data.profit.toFixed(2)}`;
        
        const rankBadge = document.getElementById('res-rank');
        rankBadge.innerText = data.salesRankText;
        rankBadge.style.color = data.salesRankColor;

        document.getElementById('res-sku').innerText = data.sku;
        momenteelGescandBoek = data;

    } catch (err) {
        document.getElementById('res-title').innerText = "Fout bij laden data";
    }
}

// Schrijf het boek weg naar Supabase
document.getElementById('btn-save').addEventListener('click', async () => {
    if (!momenteelGescandBoek) return;

    try {
        const response = await fetch('/api/scan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(momenteelGescandBoek)
        });

        if(response.ok) {
            alert("Boek succesvol bewaard in je voorraad!");
            document.getElementById('result-card').classList.add('hidden');
            document.getElementById('manual-isbn').value = '';
            momenteelGescandBoek = null;
            laadVoorraadUitDatabase();
        }
    } catch (err) {
        alert("Fout bij opslaan.");
    }
});

// Laad de live geschiedenis in onderaan het scherm
async function laadVoorraadUitDatabase() {
    try {
        const response = await fetch('/api/scan?action=list');
        const items = await response.json();
        const list = document.getElementById('inventory-list');
        if (!list) return;
        list.innerHTML = '';

        items.forEach(item => {
            const li = document.createElement('li');
            li.className = 'inventory-item';
            li.innerHTML = `
                <div>
                    <strong>${item.title}</strong><br>
                    <small>${item.sku}</small>
                </div>
                <div style="color: #10b981; font-weight: bold;">+ €${item.profit.toFixed(2)}</div>
            `;
            list.appendChild(li);
        });
    } catch(e) {}
}
