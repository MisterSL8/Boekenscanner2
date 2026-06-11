let momenteelGescandBoek = null;

window.addEventListener('DOMContentLoaded', () => {
    const videoElement = document.getElementById('video');
    const statusElement = document.getElementById('connection-status');

    // CONFIGURATIE: Vraag de browser direct om de camera te starten (Webcam of Android-achtercamera)
    const constraints = {
        video: { facingMode: { ideal: "environment" } } // Zoekt achtercamera op mobiel, pakt webcam op PC
    };

    navigator.mediaDevices.getUserMedia(constraints)
        .then((stream) => {
            // Succes! De camera geeft beeld door aan de video-tag
            videoElement.srcObject = stream;
            statusElement.innerText = "Camera Actief";
            statusElement.style.borderColor = "#10b981";
            statusElement.style.color = "#10b981";
        })
        .catch((err) => {
            // Foutafhandeling als de camera fysiek ontbreekt of geblokkeerd is
            statusElement.innerText = "Camera Geblokkeerd/Fout";
            statusElement.style.borderColor = "#ef4444";
            statusElement.style.color = "#ef4444";
            console.error("Camerafout:", err);
        });

    // Handmatige zoekknop activeren (zodat je app altijd bruikbaar is)
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
