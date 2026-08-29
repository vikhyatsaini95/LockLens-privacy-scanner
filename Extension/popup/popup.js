document.addEventListener("DOMContentLoaded", () => {
    const scanButton = document.getElementById("scanButton");
    const dashboardButton = document.getElementById("dashboardButton");
    const privacyGuardButton = document.getElementById("privacyGuardButton");
    const guardStatus = document.getElementById("guardStatus");
    const status = document.getElementById("status");
    const setStatus = (message, state = "") => { status.textContent = message; status.className = `status ${state}`; };
    const updateGuardUI = async () => {
        const { privacyGuardEnabled = false } = await chrome.storage.local.get("privacyGuardEnabled");
        const enabled = Boolean(privacyGuardEnabled);
        privacyGuardButton.textContent = enabled ? "Disable Privacy Guard" : "Enable Privacy Guard";
        privacyGuardButton.setAttribute("aria-pressed", String(enabled));
        guardStatus.textContent = enabled ? "Privacy Guard is active on supported pages." : "Privacy Guard is currently off.";
    };
    scanButton.addEventListener("click", async () => {
        scanButton.disabled = true; setStatus("Analyzing this page locally...");
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab?.id) throw new Error("No active tab");
            const [{ result: pageText = "" } = {}] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => document.body?.innerText || "" });
            const findings = scanPageContent(pageText), risk = calculateRisk(findings);
            await chrome.storage.local.set({ lockLensFindings: findings, lockLensRisk: risk });
            await updateExposureTimeline(findings, risk);
            setStatus(`Analysis complete: ${risk.level} risk (${risk.score}/100).`, "is-success");
        } catch (error) { console.error("LockLens scan error:", error); setStatus("Scan failed. Try a regular webpage and reload the extension.", "is-error"); }
        finally { scanButton.disabled = false; }
    });
    privacyGuardButton.addEventListener("click", async () => {
        privacyGuardButton.disabled = true;
        try {
            const { privacyGuardEnabled = false } = await chrome.storage.local.get("privacyGuardEnabled");
            await chrome.storage.local.set({ privacyGuardEnabled: !privacyGuardEnabled });
            await updateGuardUI();
            setStatus(!privacyGuardEnabled ? "Privacy Guard enabled." : "Privacy Guard disabled.", "is-success");
        } finally { privacyGuardButton.disabled = false; }
    });
    dashboardButton.addEventListener("click", () => chrome.tabs.create({ url: chrome.runtime.getURL("dashboard/dashboard.html") }));
    updateGuardUI();
});
