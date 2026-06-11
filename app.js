let momenteelGescandBoek = null;
let isScannenBezig = false; // Voorkomt dat hij hetzelfde boek 100 keer achter elkaar scant

window.addEventListener('DOMContentLoaded', () => {
    const statusElement = document.getElementById('connection-status');

    // 1. Configureer Quagga2 barcodescanner
    Quagga.init({
        inputStream: {
            name: "Live",
            type: "LiveStream",
            target: document.querySelector('#interactive'), // De HTML-container
            constraints: {
                width: 640,
                height: 480,
                facingMode: "environment" // Gebruik de achtercamera op Android
            },
        },
        decoder: {
            readers: ["ean_reader"] // EAN_READER is specifiek voor boek-barcodes
        }
    }, function (err) {
        if (err) {
            statusElement.innerText = "Camera Fout";
            statusElement.style.borderColor = "#ef4444";
            console.error(err);
            return;
        }
        // Succesvol opgestart!
        Quagga.start();
        statusElement.innerText = "Scanner Actief";
        statusElement.style.borderColor = "#10b981";
        statusElement.style.color = "#10b981";
    });

    // 2. Luister naar barcodes die herkend worden
    Quagga.onDetected(function (data) {
        const code = data.codeResult.code;
        
        // Boeken hebben ALTIJD een 13-cijferig ISBN dat begint met 978 of 979
        if (code && code.length === 13 && (code.startsWith("978") || code.startsWith("979"))) {
            if (!isScannenBezig) {
                isScannenBezig = true; // Zet op pauze zodat hij rustig data kan laden
                verwerkIsbn(code);
                
                // Start de scanner na 4 seconden pas weer voor het volgende boek
                setTimeout(() => { isScannenBezig = false; }, 4000);
            }
        }
    });

    // Handmatige zoekknop activeren (als back-up)
    document.getElementById('btn-manual-search').addEventListener('click', () => {
        const handmatigIsbn = document.getElementById('manual-isbn').value.trim();
        if(handmatigIsbn.length === 13) {
            verwerkIsbn(handmatigIsbn);
        } else {
            alert("Voer een geldig 13-cijferig ISBN in.");
        }
    });

    laadVoorraadUitDatabase();
});

// Stuur het ISBN-nummer door naar de Vercel-backend
async function verwerkIsbn(isbnNummer) {
    if (navigator.vibrate) navigator.vibrate(150);

    const resultCard = document.getElementById('result-card');
    resultCard.classList.remove('hidden');
    document.getElementById('res-title').innerText = "Live data ophalen uit Bol...";
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
            document.getElementById('manual-isbn').value = '';
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
