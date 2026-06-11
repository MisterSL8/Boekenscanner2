// app.js - Verbeterde universele versie voor PC en Android
let momenteelGescandBoek = null;

window.addEventListener('DOMContentLoaded', () => {
    // We starten de camera handmatig op via de stabiele route
    Html5Qrcode.getCameras().then(cameras => {
        if (cameras && cameras.length > 0) {
            // Als er camera's zijn, starten we de scanner
            const html5QrCode = new Html5Qrcode("reader");
            
            // Kies bij voorkeur de achtercamera (Android), anders de eerste beschikbare (PC)
            const cameraId = cameras.length > 1 ? cameras[1].id : cameras[0].id;

            html5QrCode.start(
                cameraId, 
                { fps: 15, qrbox: { width: 250, height: 150 } },
                (decodedText) => { onScanSuccess(decodedText); }, // Succes handler
                (errorMessage) => { /* Stille fouten negeren tijdens het zoeken */ }
            ).catch(err => {
                document.getElementById('connection-status').innerText = "Camera startfout";
                console.error("Camera startfout:", err);
            });
        } else {
            document.getElementById('connection-status').innerText = "Geen camera gevonden";
        }
    }).catch(err => {
        // Hier vraagt de browser expliciet om toestemming zodra dit faalt
        document.getElementById('connection-status').innerText = "Toegang geweigerd of geblokkeerd";
        console.error("Camera permissie fout:", err);
    });

    laadVoorraadUitDatabase();
});

// Functie die afgaat zodra je camera een barcode pakt
async function onScanSuccess(decodedText) {
    // Stop als de code geen geldige ISBN lengte heeft
    if(decodedText.length !== 13) return;
    
    // Tril Android telefoon kort als succes-feedback
    if (navigator.vibrate) navigator.vibrate(150);

    const resultCard = document.getElementById('result-card');
    resultCard.classList.remove('hidden');
    document.getElementById('res-title').innerText = "Live data ophalen...";
    document.getElementById('res-isbn').innerText = decodedText;

    try {
        const response = await fetch(`/api/scan?ean=${decodedText}`);
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
        document.getElementById('res-title').innerText = "Netwerkfout met backend";
    }
}

// Knop om boek op te slaan in Supabase
document.getElementById('btn-save').addEventListener('click', async () => {
    if (!momenteelGescandBoek) return;

    try {
        const response = await fetch('/api/scan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(momenteelGescandBoek)
        });

        if(response.ok) {
            alert("Succesvol opgeslagen!");
            document.getElementById('result-card').classList.add('hidden');
            momenteelGescandBoek = null;
            laadVoorraadUitDatabase();
        }
    } catch (err) {
        alert("Fout bij opslaan.");
    }
});

// Haal de lijst met gescande boeken op uit Supabase
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
