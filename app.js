let momenteelGescandBoek = null;
let codeReader = null;

window.addEventListener('DOMContentLoaded', () => {
    // 1. Initialiseer de barcode-lezer van ZXing
    codeReader = new ZXing.BrowserBarcodeReader();
    console.log('ZXing code reader geïnitialiseerd');

    // 2. Start de camera en begin direct met scannen (triggert de pop-up)
    codeReader.decodeFromInputVideoDevice(undefined, 'video')
        .then((result) => {
            // Zodra er een barcode succesvol wordt gelezen
            onScanSuccess(result.text);
        })
        .catch((err) => {
            document.getElementById('connection-status').innerText = "Camera Fout";
            console.error(err);
        });
        
    document.getElementById('connection-status').innerText = "Camera Actief";
    laadVoorraadUitDatabase();
});

// Verwerk het gescande ISBN-nummer
async function onScanSuccess(isbnNummer) {
    if(isbnNummer.length !== 13) return;
    
    if (navigator.vibrate) navigator.vibrate(150);

    const resultCard = document.getElementById('result-card');
    resultCard.classList.remove('hidden');
    document.getElementById('res-title').innerText = "Live data ophalen...";
    document.getElementById('res-isbn').innerText = isbnNummer;

    try {
        const response = await fetch(`/api/scan?ean=${isbnNummer}`);
        const data = await response.json();

        if (data.error) {
            document.getElementById('res-title').innerText = "Niet gevonden op Bol.com";
            return;
        }

        document.getElementById('res-title').innerText = data.title || "Onbekend Boek";
        document.getElementById('res-price').innerText = `€ ${data.price.toFixed(2)}`;
        document.getElementById('res-profit').innerText = `€ ${data.profit.toFixed(2)}`;
        
        const rankBadge = document.getElementById('res-rank');
        rankBadge.innerText = data.salesRankText;
        rankBadge.style.color = data.salesRankColor;

        document.getElementById('res-sku').innerText = data.sku;
        momenteelGescandBoek = data;

    } catch (err) {
        document.getElementById('res-title').innerText = "Fout bij laden backend data";
    }
}

// Opslaan knop actie (Supabase)
document.getElementById('btn-save').addEventListener('click', async () => {
    if (!momenteelGescandBoek) return;

    try {
        const response = await fetch('/api/scan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(momenteelGescandBoek)
        });

        if(response.ok) {
            alert("Boek toegevoegd aan je voorraad!");
            document.getElementById('result-card').classList.add('hidden');
            momenteelGescandBoek = null;
            laadVoorraadUitDatabase();
        }
    } catch (err) {
        alert("Fout bij opslaan.");
    }
});

// Haal voorraad op uit Supabase
async function laadVoorraadUitDatabase() {
    try {
        const response = await fetch('/api/scan?action=list');
        const items = await response.json();
        const list = document.getElementById('inventory-list');
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
