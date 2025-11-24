// --- FUNÇÃO GPS CORRIGIDA E BLINDADA (MOTOR DUPLO) ---
    async function initGPS(mode) {
        let input, display;
        
        // Define os campos baseados na aba (Vendas ou Instalação)
        if (mode === 'install_current') {
            input = document.getElementById('addressInputInstall');
            display = document.getElementById('gpsDisplayInstall');
        } else {
            input = document.getElementById('addressInput');
            display = document.getElementById('gpsDisplaySales');
        }
        
        // --- MODO 1: BUSCA POR ENDEREÇO (DIGITADO) ---
        if(mode === 'search') {
            let address = input.value;
            // Limpa o endereço para evitar erros comuns
            address = address.replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
            
            if(address.length < 3) { alert("Digite cidade e estado pelo menos."); return; }
            
            display.innerText = "⏳ Buscando endereço...";
            display.style.color = "var(--primary)";
            
            // MOTOR 1: Tenta NOMINATIM (Oficial)
            try {
                const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1&addressdetails=1`;
                // Adicionando cabeçalho para tentar evitar bloqueio
                const response = await fetch(url, { headers: { "Accept-Language": "pt-BR" } });
                
                if (!response.ok) throw new Error("Bloqueio Nominatim");
                
                const data = await response.json();

                if(data && data.length > 0) {
                    // Sucesso no Motor 1
                    processGPSResult(data[0].lat, data[0].lon, display);
                    return; // Encerra aqui
                } 
                throw new Error("Não encontrado no Nominatim");

            } catch (err1) {
                // Falhou Motor 1? Ativa MOTOR 2: PHOTON (Mais permissivo para arquivos locais)
                console.log("Tentando motor secundário...", err1);
                display.innerText = "🔄 Tentando servidor alternativo...";
                
                try {
                    const url2 = `https://photon.komoot.io/api/?q=${encodeURIComponent(address)}&limit=1`;
                    const res2 = await fetch(url2);
                    const data2 = await res2.json();
                    
                    if(data2 && data2.features && data2.features.length > 0) {
                        // O Photon devolve [Longitude, Latitude] (Invertido)
                        const coords = data2.features[0].geometry.coordinates;
                        processGPSResult(coords[1], coords[0], display);
                    } else {
                        throw new Error("Não encontrado no Photon");
                    }
                } catch (err2) {
                    // Falhou tudo
                    display.innerText = "❌ Erro: Verifique a internet.";
                    display.style.color = "var(--error)";
                    alert("Não foi possível localizar. Verifique sua internet ou digite apenas 'Cidade, Estado'.");
                }
            }
        } 
        // --- MODO 2: GPS DO CELULAR/NAGEVADOR ---
        else {
            if(!navigator.geolocation) { alert("Seu navegador não tem GPS."); return; }
            
            display.innerText = "📡 Buscando satélites...";
            display.style.color = "#64748b";
            
            navigator.geolocation.getCurrentPosition(async (pos) => {
                // Sucesso no GPS Físico
                processGPSResult(pos.coords.latitude, pos.coords.longitude, display);
                
                // Preenchimento reverso (Lat/Lon -> Nome da Rua)
                if(mode === 'current' && !input.value) {
                    display.innerText += " (Buscando nome da rua...)";
                    try {
                        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`);
                        const data = await res.json();
                        const addr = data.address;
                        const street = addr.road || addr.street || '';
                        const num = addr.house_number ? `, ${addr.house_number}` : '';
                        const hood = addr.suburb || addr.neighbourhood ? ` - ${addr.suburb || addr.neighbourhood}` : '';
                        const city = addr.city || addr.town || addr.village || '';
                        input.value = `${street}${num}${hood} - ${city}`;
                    } catch(e){}
                }
            }, (error) => {
                display.innerText = "❌ GPS Desativado/Erro.";
                display.style.color = "var(--error)";
                alert("Ative a localização do seu dispositivo.");
            }, { enableHighAccuracy: true, timeout: 15000 });
        }
    }

    // Função auxiliar para processar e salvar
    function processGPSResult(lat, lon, displayEl) {
        // Garante formato numérico e limita casas decimais
        const fLat = parseFloat(lat).toFixed(6);
        const fLon = parseFloat(lon).toFixed(6);
        
        gpsCoords = `${fLat}, ${fLon}`;
        
        displayEl.innerText = `✅ GPS: ${gpsCoords}`;
        displayEl.style.color = "var(--success)";
        
        // Feedback visual rápido
        displayEl.parentElement.style.background = "#f0fdf4";
        setTimeout(() => displayEl.parentElement.style.background = "white", 1000);
        
        autoSave();
    }