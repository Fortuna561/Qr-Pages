async function sha1hex(input) {
    // Generar tokenId unico
    const enc = new TextEncoder();
    const data = enc.encode(input + Date.now().toString() + Math.random());
    const hashBuffer = await crypto.subtle.digest("SHA-1", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

document.getElementById("go").onclick = async () => {
    const name = document.getElementById("name").value.trim();
    const lastname = document.getElementById("lastname").value.trim();
    const githubOwner = "Fortuna561";
    const githubRepo = "Qr-Pages";
    const branch = "main";
    const workerHost = "qr-pages.fortunaluciano561.workers.dev/";
    const githubToken = process.env.GITHUBTOKEN;

    if (!name || !lastname) {
        return alert("Completa los campos.");
    }

    const tokenId = await sha1hex(name + lastname).then(h => h.slice(0,12));
    const filename = `pages/${tokenId}.html`;

    // Plantilla HTML (puedes personalizarla)
    const pageHtml = `<!doctype html>
<html>
<head><meta charset="utf-8"/><title>${name} ${lastname}</title></head>
<body>
    <h1>Hola ${name} ${lastname}!</h1>
    <p>Esta es tu página única generada el ${new Date().toISOString()}.</p>
</body>
</html>`;

    // Crear archivo en el repo desde API de GitHub
    const createUrl = `https://api.github.com/repos/${githubOwner}/${githubRepo}/contents/${encodeURIComponent(filename)}`;

    const createResp = await fetch(createUrl, {
        method: "PUT",
        headers: {
            Authorization: `token ${githubToken}`,
            Accept: "application/vnd.github.v3+json"
        },
        body: JSON.stringify({
            message: `Crear página para ${name} ${lastname} (${tokenId})`,
            content: btoa(unescape(encodeURIComponent(pageHtml))),
            branch: branch
        })
    });

    if (!createResp.ok) {
        const err = await createResp.json().catch(()=>({message:"error desconocido"}));
        return alert("Error creando archivo en GitHub: " + (err.message||JSON.stringify(err)));
    }

    // Registar token en tokens.json (se mantiene un map token -> ruta, valid:true)
    const tokensUrl = `https://api.github.com/repos/${githubOwner}/${githubRepo}/contents/tokens.json`;
    let tokensSha = null;
    let tokensData = {};
    const getTokensResp = await fetch(tokensUrl + `?ref=${branch}`, { headers: { Authorization: `token ${githubToken}`, Accept: "application/vnd.github.v3+json" }});
    if (getTokensResp.ok) {
        const obj = await getTokensResp.json();
        tokensSha = obj.sha;
        const decoded = decodeURIComponent(escape(atob(obj.content)));
        try { tokensData = JSON.parse(decoded); } catch(e) { tokensData = {}; }
    }

    tokensData[tokenId] = {
        path: filename,
        valid: true,
        createdAt: new Date().toISOString(),
        name: `${name} ${lastname}`
    };

    const newContent = btoa(unescape(encodeURIComponent(JSON.stringify(tokensData, null, 2))));
    const putTokensResp = await fetch(tokensUrl, {
        method: "PUT",
        headers: { Authorization: `token ${githubToken}`, Accept: "application/vnd.github.v3+json" },
        body: JSON.stringify({
            message: `Registrar token ${tokenId}`,
            content: newContent,
            branch: branch,
            sha: tokensSha // Undefined si no existia
        })
    });

    if (!putTokensResp.ok) {
        const err = await putTokensResp.json().catch(()=>({message:"error desconocido"}));
        return alert("Error registrando token: " + (err.message||JSON.stringify(err)));
    }

    // Generar QR que apunte al Worker + token
    const workerUrl = `https://${workerHost}/${tokenId}`;
    document.getElementById("link").innerText = workerUrl;
    QRCode.toDataURL(workerUrl).then(url => {
        document.getElementById("qrimg").src = url;
    }).catch(err => alert("Error generando QR: " + err));
};

