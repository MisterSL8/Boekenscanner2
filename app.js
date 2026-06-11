let momenteelGescandBoek = null;

window.addEventListener('DOMContentLoaded', () => {
    // 1. Initialiseer de Instascan scanner gekoppeld aan de HTML video-tag
    let scanner = new Instascan.Scanner({ video: document.getElementById('preview'), scanPeriod: 5 });
    
    // Luister naar succesvolle scans
    scanner.addListener('scan', function (content) {
        onScanSuccess(content);
    });

    // 2. Vraag actief de camera's op bij het besturingssysteem (dit triggert de pop-up direct!)
    Instascan.Camera.getCameras().then(function (cameras) {
        if (cameras.length > 0) {
            // Als er een achtercamera is (meestal camera 1 of de laatste op Android), kies die. Anders camera 0 (PC).
            let gekozenCamera = cameras.length > 1 ? cameras[1] : cameras[0];
            scanner.start(gekozenCamera);
            document.getElementById('connection-status').innerText = "Camera Actief";
        } else {
            document.getElementById('connection-status').innerText = "Geen camera gedetecteerd";
            alert("Er is geen camera op dit apparaat gevonden.");
        }
    }).catch(function (e) {
        document.getElementById('connection-status').innerText = "Toestemming Geweigerd";
        console.error(e);
        alert("Cameratoestemming is geweigerd of geblokkeerd in je browser.");
    });

    laadVoorraadUitDatabase();
});

// Verwerk het gescande ISBN-nummer
async function onScanSuccess(isbnNummer) {
    // Alleen 13-cijferige streepjescodes verwerken
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
