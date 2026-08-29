document.addEventListener("DOMContentLoaded", async () => {
    const $ = (id) => document.getElementById(id);
    const safeText = (value) => typeof value === "string" ? value : "";
    const levelLabel = (level) => ({ low: "Low information request", moderate: "Moderate information request", high: "High information request" }[level] || "No assessment yet");
    const renderGuard = async () => {
        const { privacyGuardEnabled = false, lockLensGuardLastResult: result } = await chrome.storage.local.get(["privacyGuardEnabled", "lockLensGuardLastResult"]);
        $("dashboardGuardStatus").textContent = privacyGuardEnabled ? "Status: Active" : "Status: Inactive";
        $("guardAssessment").textContent = result ? levelLabel(result.level) : "No page assessment available yet. Enable Privacy Guard and visit a supported webpage.";
        const list = $("guardCategories"); list.replaceChildren();
        const categories = Array.isArray(result?.categories) ? result.categories : [];
        (categories.length ? categories : ["No categories detected yet."]).forEach((category) => { const item = document.createElement("li"); item.textContent = safeText(category); list.append(item); });
    };
    const renderScan = async () => {
        const data = await chrome.storage.local.get(["lockLensFindings", "lockLensRisk", "exposureTimeline"]);
        const findings = Array.isArray(data.lockLensFindings) ? data.lockLensFindings : [];
        const risk = data.lockLensRisk && typeof data.lockLensRisk === "object" ? data.lockLensRisk : {};
        const score = Number.isFinite(risk.score) ? Math.max(0, Math.min(100, risk.score)) : 0;
        $("score").textContent = score; $("riskLevel").textContent = safeText(risk.level) || "Not analyzed";
        requestAnimationFrame(() => $("riskRing").style.setProperty("--progress", score));
        const box = $("findings"); box.replaceChildren();
        if (!findings.length) box.innerHTML = '<div class="empty">No supported exposure categories detected yet. Run a local scan to see your privacy-safe summary.</div>';
        else findings.forEach((finding) => { const card = document.createElement("article"); card.className = "finding-card"; const title = document.createElement("h3"); title.textContent = safeText(finding.label) || "Exposure category"; const count = document.createElement("span"); count.className = "finding-count"; count.textContent = `${Number.isFinite(finding.count) ? finding.count : 0} detected`; card.append(title, count); box.append(card); });
        const recommendations = $("recommendations"); recommendations.replaceChildren();
        const items = Array.isArray(risk.recommendations) && risk.recommendations.length ? risk.recommendations : ["Analyze a page to receive privacy recommendations."];
        items.forEach((recommendation) => { const li = document.createElement("li"); li.textContent = safeText(recommendation); recommendations.append(li); });
    };
    const renderTimeline = async () => {
        const { exposureTimeline } = await chrome.storage.local.get("exposureTimeline");
        const timeline = exposureTimeline && typeof exposureTimeline === "object" ? exposureTimeline : {};
        const todayKey = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
        const today = timeline[todayKey] && typeof timeline[todayKey] === "object" ? timeline[todayKey] : {};
        const pages = Number.isFinite(today.analyzedPages) ? today.analyzedPages : 0;
        const categories = today.categories && typeof today.categories === "object" ? today.categories : {};
        const highRisk = Number.isFinite(today.highRiskInteractions) ? today.highRiskInteractions : 0;
        const scores = Array.isArray(today.riskScores) ? today.riskScores.filter(Number.isFinite) : [];
        const average = scores.length ? scores.reduce((total, score) => total + score, 0) / scores.length : 0;
        const exposure = average >= 76 ? "Critical" : average >= 60 ? "High" : average >= 30 ? "Moderate" : "Low";
        $("pagesAnalyzed").textContent = pages;
        $("categoriesDetected").textContent = Object.keys(categories).length;
        $("highRiskInteractions").textContent = highRisk;
        $("timelineStatus").textContent = `${exposure} exposure`;
        const history = $("timelineHistory"); history.replaceChildren();
        const dates = Object.keys(timeline).sort().reverse().slice(0, 7);
        if (!dates.length) { history.innerHTML = '<div class="empty">No privacy activity recorded yet.</div>'; return; }
        dates.forEach((date) => {
            const entry = timeline[date] && typeof timeline[date] === "object" ? timeline[date] : {};
            const row = document.createElement("div"), label = document.createElement("strong"), detail = document.createElement("span");
            const entryCategories = entry.categories && typeof entry.categories === "object" ? entry.categories : {};
            label.textContent = date;
            detail.textContent = `${Number.isFinite(entry.analyzedPages) ? entry.analyzedPages : 0} pages | ${Object.keys(entryCategories).length} categories | ${Number.isFinite(entry.highRiskInteractions) ? entry.highRiskInteractions : 0} high-risk`;
            row.className = "history-row"; row.append(label, detail); history.append(row);
        });
    };
    await Promise.all([renderGuard(), renderScan(), renderTimeline()]);
    chrome.storage.onChanged.addListener((changes, area) => { if (area !== "local") return; if (changes.privacyGuardEnabled || changes.lockLensGuardLastResult) renderGuard(); if (changes.lockLensFindings || changes.lockLensRisk) renderScan(); if (changes.exposureTimeline) renderTimeline(); });
});
