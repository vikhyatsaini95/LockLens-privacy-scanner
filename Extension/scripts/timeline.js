// LockLens Personal Exposure Timeline
// Stores ONLY anonymous exposure metadata locally.
// No email addresses, phone numbers, passwords, or page content are stored.

function getLocalDate() {
    const date = new Date();
    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return localDate.toISOString().split("T")[0];
}

async function updateExposureTimeline(findings, risk) {
    const today = getLocalDate();

    const data = await chrome.storage.local.get(["exposureTimeline"]);
    const timeline = data.exposureTimeline && typeof data.exposureTimeline === "object"
        ? data.exposureTimeline
        : {};

    // Create today's record if it doesn't exist
    if (!timeline[today] || typeof timeline[today] !== "object") {
        timeline[today] = {
            analyzedPages: 0,
            categories: {},
            highRiskInteractions: 0,
            riskScores: []
        };
    }

    const todayData = timeline[today];
    todayData.analyzedPages = Number.isFinite(todayData.analyzedPages)
        ? todayData.analyzedPages
        : 0;
    todayData.categories = todayData.categories && typeof todayData.categories === "object"
        ? todayData.categories
        : {};
    todayData.highRiskInteractions = Number.isFinite(todayData.highRiskInteractions)
        ? todayData.highRiskInteractions
        : 0;
    todayData.riskScores = Array.isArray(todayData.riskScores)
        ? todayData.riskScores.filter(Number.isFinite)
        : [];

    // Count this analysis
    todayData.analyzedPages += 1;

    // Store ONLY category type and count
    (Array.isArray(findings) ? findings : []).forEach(finding => {
        const category = typeof finding.type === "string" ? finding.type : "unknown";
        const count = Number.isFinite(finding.count) && finding.count > 0
            ? finding.count
            : 0;

        todayData.categories[category] =
            (todayData.categories[category] || 0) + count;
    });

    // Track high-risk analyses
    if (risk && (risk.level === "High" || risk.level === "Critical")) {
        todayData.highRiskInteractions += 1;
    }

    // Store the score, not personal information
    if (risk && Number.isFinite(risk.score)) {
        todayData.riskScores.push(risk.score);
    }

    // Keep only the most recent 50 scores for the day
    if (todayData.riskScores.length > 50) {
        todayData.riskScores =
            todayData.riskScores.slice(-50);
    }

    await chrome.storage.local.set({
        exposureTimeline: timeline
    });

    console.log("LockLens timeline updated:", todayData);
}

async function getExposureTimeline() {
    const data = await chrome.storage.local.get(["exposureTimeline"]);
    return data.exposureTimeline || {};
}
