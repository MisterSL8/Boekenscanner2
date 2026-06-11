let momenteelGescandBoek = null;

window.addEventListener('DOMContentLoaded', () => {
    // Initialiseer html5-qrcode barcodescanner voor Android camera
    const html5QrcodeScanner = new Html5QrcodeScanner(
        "reader", { fps: 15, qrbox: { width: 280, height: 120 } }
    );
    html5QrcodeScanner.render(onScanSuccess);
    laadVoorraadUitDatabase();
});

// Functie die afgaat zodra je Android-camera een barcode pakt
async function onScanSuccess(decodedText) {
    // Alleen 13-cijferige ISBN codes accepteren
    if(decodedText.length !== 13) return;
    
    // Tril Android telefoon kort als succes-feedback
    if (navigator.vibrate) navigator.vibrate(150);

    const resultCard = document.getElementById('result-card');
    resultCard.classList.remove('hidden');
    document.getElementById('res-title').innerText = "Live data ophalen...";
    document.getElementById('res-isbn').innerText = decodedText;

    try {
        // Vraag live data op bij onze beveiligde Vercel serverless function
        const response = await fetch(`/api/scan?ean=${decodedText}`);
        const data = await response.json();

        if (data.error) {
            document.getElementById('res-title').innerText = "Boek niet gevonden op Bol.com";
            return;
        }

        // Live data toekennen aan interface
        document.getElementById('res-title').innerText = data.title || "Onbekende Titel";
        document.getElementById('res-price').innerText = `€ ${data.price.toFixed(2)}`;
        document.getElementById('res-profit').innerText = `€ ${data.profit.toFixed(2)}`;
        
        // Sales rank indicator logica (Gelijk aan Boek Laser)
        const rankBadge = document.getElementById('res-rank');
        rankBadge.innerText = data.salesRankText;
        rankBadge.style.color = data.salesRankColor;

        document.getElementById('res-sku').innerText = data.sku;

        // Onthoud dit boek in het geheugen voor als men op 'Opslaan' klikt
        momenteelGescandBoek = data;

    } catch (err) {
        document.getElementById('res-title').innerText = "Netwerkfout met backend server";
    }
}

// Knop om boek daadwerkelijk naar je gratis database (Supabase) te schrijven
document.getElementById('btn-save').addEventListener('click', async () => {
    if (!momenteelGescandBoek) return;

    try {
        const response = await fetch('/api/scan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(momenteelGescandBoek)
        });

        if(response.ok) {
            alert("Succesvol opgeslagen in je database!");
            document.getElementById('result-card').classList.add('hidden');
            momenteelGescandBoek = null;
            laadVoorraadUitDatabase();
        }
    } catch (err) {
        alert("Fout bij opslaan.");
    }
});

// Haal de lijst met gescande boeken op om onderaan het scherm te tonen
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
