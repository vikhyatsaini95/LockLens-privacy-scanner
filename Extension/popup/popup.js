/* =========================================================
   LockLens Popup Controller
   Step 18 - Complete Integration
   ========================================================= */

(() => {
    "use strict";

    /* =========================================================
       STATE
       ========================================================= */

    let currentFindings = [];
    let currentPageRisk = null;
    let currentUnifiedRisk = null;
    let currentURLRisk = null;
    let currentEmailRisk = null;
    let currentRecommendations = null;
    let currentExplanation = null;
    let currentPrivacyLabel = null;
    let currentDecisionPath = null;

    /* =========================================================
       DOM HELPERS
       ========================================================= */

    function $(id) {
        return document.getElementById(id);
    }

    function setText(id, value) {
        const element = $(id);

        if (element) {
            element.textContent = value ?? "";
        }
    }

    function escapeHTML(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function showMessage(message, type = "info") {
        const statusMessage = $("statusMessage");

        if (!statusMessage) {
            return;
        }

        statusMessage.textContent = message;

        statusMessage.className = `status-message ${type}`;
    }

    function setStatus(active, message) {
        const dot = $("statusDot");

        if (dot) {
            dot.className = active
                ? "status-dot active"
                : "status-dot";
        }

        setText("statusMessage", message);
    }

    /* =========================================================
       CHROME STORAGE HELPERS
       ========================================================= */

    function storageGet(keys) {
        return new Promise((resolve) => {
            if (
                typeof chrome === "undefined" ||
                !chrome.storage ||
                !chrome.storage.local
            ) {
                resolve({});
                return;
            }

            chrome.storage.local.get(keys, (result) => {
                if (chrome.runtime?.lastError) {
                    console.warn(
                        "LockLens storage get error:",
                        chrome.runtime.lastError.message
                    );

                    resolve({});
                    return;
                }

                resolve(result || {});
            });
        });
    }

    function storageSet(data) {
        return new Promise((resolve) => {
            if (
                typeof chrome === "undefined" ||
                !chrome.storage ||
                !chrome.storage.local
            ) {
                resolve(false);
                return;
            }

            chrome.storage.local.set(data, () => {
                if (chrome.runtime?.lastError) {
                    console.warn(
                        "LockLens storage set error:",
                        chrome.runtime.lastError.message
                    );

                    resolve(false);
                    return;
                }

                resolve(true);
            });
        });
    }

    function storageRemove(keys) {
        return new Promise((resolve) => {
            if (
                typeof chrome === "undefined" ||
                !chrome.storage ||
                !chrome.storage.local
            ) {
                resolve(false);
                return;
            }

            chrome.storage.local.remove(keys, () => {
                if (chrome.runtime?.lastError) {
                    console.warn(
                        "LockLens storage remove error:",
                        chrome.runtime.lastError.message
                    );

                    resolve(false);
                    return;
                }

                resolve(true);
            });
        });
    }

    /* =========================================================
       TAB HELPERS
       ========================================================= */

    function getCurrentTab() {
        return new Promise((resolve) => {
            if (
                typeof chrome === "undefined" ||
                !chrome.tabs
            ) {
                resolve(null);
                return;
            }

            chrome.tabs.query(
                {
                    active: true,
                    currentWindow: true
                },
                (tabs) => {
                    if (chrome.runtime?.lastError) {
                        console.warn(
                            "LockLens tab query error:",
                            chrome.runtime.lastError.message
                        );

                        resolve(null);
                        return;
                    }

                    resolve(tabs && tabs.length > 0 ? tabs[0] : null);
                }
            );
        });
    }

    /* =========================================================
       SCRIPT INJECTION
       ========================================================= */

    async function injectScanner(tabId) {
        if (
            typeof chrome === "undefined" ||
            !chrome.scripting ||
            !chrome.scripting.executeScript
        ) {
            throw new Error(
                "Chrome scripting API is unavailable."
            );
        }

        await new Promise((resolve, reject) => {
            chrome.scripting.executeScript(
                {
                    target: {
                        tabId: tabId
                    },
                    files: [
                        "scripts/scanner.js"
                    ]
                },
                () => {
                    if (chrome.runtime?.lastError) {
                        reject(
                            new Error(
                                chrome.runtime.lastError.message
                            )
                        );
                        return;
                    }

                    resolve();
                }
            );
        });
    }

    /* =========================================================
       RUN SCANNER
       ========================================================= */

    async function runScanner(tab) {
        if (!tab || !tab.id) {
            throw new Error(
                "No active browser tab was found."
            );
        }

        await injectScanner(tab.id);

        const result = await new Promise(
            (resolve, reject) => {
                chrome.scripting.executeScript(
                    {
                        target: {
                            tabId: tab.id
                        },
                        func: () => {
                            try {
                                if (
                                    !window.LockLensScanner ||
                                    typeof window.LockLensScanner
                                        .performFullScan !== "function"
                                ) {
                                    return {
                                        success: false,
                                        error:
                                            "LockLensScanner is not available on this page."
                                    };
                                }

                                const findings =
                                    window.LockLensScanner.performFullScan(
                                        document
                                    );

                                return {
                                    success: true,
                                    findings:
                                        Array.isArray(findings)
                                            ? findings
                                            : []
                                };
                            } catch (error) {
                                return {
                                    success: false,
                                    error:
                                        error?.message ||
                                        "Scanner execution failed."
                                };
                            }
                        }
                    },
                    (results) => {
                        if (chrome.runtime?.lastError) {
                            reject(
                                new Error(
                                    chrome.runtime.lastError.message
                                )
                            );
                            return;
                        }

                        if (
                            !results ||
                            !results.length
                        ) {
                            reject(
                                new Error(
                                    "Scanner returned no result."
                                )
                            );
                            return;
                        }

                        resolve(
                            results[0].result
                        );
                    }
                );
            }
        );

        if (!result?.success) {
            throw new Error(
                result?.error ||
                "Unable to scan this page."
            );
        }

        return Array.isArray(result.findings)
            ? result.findings
            : [];
    }

    /* =========================================================
       FINDING NORMALIZATION
       ========================================================= */

    function normalizeFindings(findings) {
        if (!Array.isArray(findings)) {
            return [];
        }

        return findings
            .map((finding) => {
                if (typeof finding === "string") {
                    return {
                        category: finding
                    };
                }

                if (!finding || typeof finding !== "object") {
                    return null;
                }

                return {
                    ...finding,
                    category:
                        finding.category ||
                        finding.type ||
                        finding.name ||
                        "unknown"
                };
            })
            .filter(Boolean);
    }

    /* =========================================================
       PAGE RISK
       ========================================================= */

    function calculatePageRisk(findings) {
        if (
            !window.LockLensRiskEngine ||
            typeof window.LockLensRiskEngine
                .calculatePageRisk !== "function"
        ) {
            console.warn(
                "LockLensRiskEngine.calculatePageRisk unavailable."
            );

            return {
                score: 0,
                level: "Low",
                categories: [],
                findingCount: findings.length
            };
        }

        return window.LockLensRiskEngine.calculatePageRisk(
            findings
        );
    }

    /* =========================================================
       URL RISK
       ========================================================= */

    function calculateURLRisk(tab) {
        if (
            !tab ||
            !tab.url ||
            !window.LockLensURLInspector ||
            typeof window.LockLensURLInspector
                .analyzeURL !== "function"
        ) {
            return null;
        }

        try {
            return window.LockLensURLInspector.analyzeURL(
                tab.url
            );
        } catch (error) {
            console.warn(
                "LockLens URL analysis failed:",
                error
            );

            return null;
        }
    }

    /* =========================================================
       UNIFIED RISK
       ========================================================= */

    function calculateUnifiedRisk({
        findings,
        urlRisk,
        emailRisk
    }) {
        if (
            !window.LockLensRiskEngine ||
            typeof window.LockLensRiskEngine
                .calculateUnifiedRisk !== "function"
        ) {
            return currentPageRisk;
        }

        try {
            return window.LockLensRiskEngine.calculateUnifiedRisk(
                {
                    findings: findings,
                    urlRisk: urlRisk,
                    emailRisk: emailRisk
                }
            );
        } catch (error) {
            console.warn(
                "Unified risk calculation failed:",
                error
            );

            return currentPageRisk;
        }
    }

    /* =========================================================
       RENDER MAIN RISK
       ========================================================= */

    function renderRisk(risk) {
        if (!risk) {
            setText("riskScore", "0");
            setText("riskLevel", "Low");
            setText(
                "riskSummary",
                "No risk assessment available yet."
            );
            return;
        }

        const score = Number(risk.score) || 0;
        const level = risk.level || "Low";

        setText(
            "riskScore",
            String(Math.round(score))
        );

        setText(
            "riskLevel",
            level
        );

        let summary =
            "No significant privacy signals detected.";

        if (level === "Medium") {
            summary =
                "Some privacy signals were detected. Review the requested information.";
        }

        if (level === "High") {
            summary =
                "Several privacy-sensitive signals were detected. Review before continuing.";
        }

        if (level === "Critical") {
            summary =
                "Multiple high-sensitivity privacy signals were detected. Review carefully before continuing.";
        }

        setText(
            "riskSummary",
            summary
        );
    }

    /* =========================================================
       PRIVACY NUTRITION LABEL
       ========================================================= */

    function generatePrivacyLabel() {
        if (
            !window.LockLensPrivacyLabel ||
            typeof window.LockLensPrivacyLabel
                .generateLabel !== "function"
        ) {
            return null;
        }

        try {
            return window.LockLensPrivacyLabel.generateLabel(
                {
                    findings: currentFindings,
                    risk: currentUnifiedRisk,
                    urlRisk: currentURLRisk,
                    emailRisk: currentEmailRisk
                }
            );
        } catch (error) {
            console.warn(
                "Privacy label generation failed:",
                error
            );

            return null;
        }
    }

    function renderPrivacyLabel(label) {
        if (!label) {
            return;
        }

        const score =
            label.risk?.score ??
            currentUnifiedRisk?.score ??
            0;

        const exposure =
            label.exposureSummary ||
            "No sensitive information detected.";

        setText(
            "nutritionScore",
            String(Math.round(Number(score) || 0))
        );

        setText(
            "nutritionExposure",
            exposure
        );

        const container =
            $("privacyNutritionLabel");

        if (!container) {
            return;
        }

        const groups =
            Array.isArray(label.requestGroups)
                ? label.requestGroups
                : [];

        if (groups.length === 0) {
            return;
        }

        const existing =
            container.querySelector(
                ".popup-nutrition-groups"
            );

        if (existing) {
            existing.remove();
        }

        const wrapper =
            document.createElement("div");

        wrapper.className =
            "popup-nutrition-groups";

        wrapper.innerHTML = groups
            .map((group) => {
                const name =
                    escapeHTML(
                        group.name ||
                        group.group ||
                        "Privacy category"
                    );

                return `
                    <span class="category-pill">
                        ${name}
                    </span>
                `;
            })
            .join("");

        container.appendChild(wrapper);
    }

    /* =========================================================
       EXPLANATION ENGINE
       ========================================================= */

    function generateExplanation() {
        if (
            !window.LockLensExplanation ||
            typeof window.LockLensExplanation
                .generateExplanation !== "function"
        ) {
            return null;
        }

        try {
            return window.LockLensExplanation.generateExplanation(
                currentFindings,
                currentUnifiedRisk,
                currentURLRisk
            );
        } catch (error) {
            console.warn(
                "Explanation generation failed:",
                error
            );

            return null;
        }
    }

    function renderExplanation(explanation) {
        const container =
            $("explanationContent");

        if (!container) {
            return;
        }

        if (!explanation) {
            container.textContent =
                "Explanation will appear after analysis.";
            return;
        }

        if (typeof explanation === "string") {
            container.textContent =
                explanation;
            return;
        }

        const reasons =
            Array.isArray(explanation.reasons)
                ? explanation.reasons
                : Array.isArray(explanation.factors)
                    ? explanation.factors
                    : [];

        const summary =
            explanation.summary ||
            explanation.explanation ||
            explanation.message ||
            "";

        let html = "";

        if (summary) {
            html += `
                <div class="explanation-summary">
                    ${escapeHTML(summary)}
                </div>
            `;
        }

        if (reasons.length > 0) {
            html += `
                <ul class="explanation-list">
                    ${reasons
                        .map(
                            (reason) => `
                            <li>
                                ${escapeHTML(
                                    typeof reason === "string"
                                        ? reason
                                        : reason.message ||
                                          reason.reason ||
                                          reason.title ||
                                          JSON.stringify(reason)
                                )}
                            </li>
                        `
                        )
                        .join("")}
                </ul>
            `;
        }

        if (!html) {
            html = `
                <div class="explanation-summary">
                    Risk score: ${Math.round(
                        Number(
                            currentUnifiedRisk?.score || 0
                        )
                    )}
                </div>
            `;
        }

        container.innerHTML = html;
    }

    /* =========================================================
       DECISION PATH
       ========================================================= */

    function generateDecisionPath() {
        if (
            !window.LockLensPrivacyDecision ||
            typeof window.LockLensPrivacyDecision
                .generateDecisionPath !== "function"
        ) {
            return null;
        }

        try {
            return window.LockLensPrivacyDecision
                .generateDecisionPath({
                    findings: currentFindings,
                    risk: currentUnifiedRisk,
                    urlRisk: currentURLRisk,
                    emailRisk: currentEmailRisk,
                    privacyLabel: currentPrivacyLabel
                });
        } catch (error) {
            console.warn(
                "Privacy Decision Path generation failed:",
                error
            );

            return null;
        }
    }

    function renderDecisionPath(decision) {
        const container =
            $("decisionPathContent");

        if (!container) {
            return;
        }

        if (!decision) {
            container.innerHTML = `
                <div class="decision-card">
                    <div class="decision-question">
                        Privacy decision path is not available yet.
                    </div>
                </div>
            `;

            return;
        }

        const path =
            Array.isArray(decision.path)
                ? decision.path
                : [];

        if (path.length === 0) {
            container.innerHTML = `
                <div class="decision-card">
                    <div class="decision-question">
                        No decision-path questions were generated.
                    </div>
                </div>
            `;

            return;
        }

        container.innerHTML = path
            .map((step, index) => {
                const number =
                    index + 1;

                const title =
                    step.title ||
                    step.name ||
                    `Step ${number}`;

                const question =
                    step.question ||
                    "";

                const answer =
                    step.answer ||
                    step.explanation ||
                    step.description ||
                    "";

                const status =
                    step.status ||
                    step.level ||
                    "";

                const categories =
                    Array.isArray(step.categories)
                        ? step.categories
                        : [];

                const categoryHTML =
                    categories.length > 0
                        ? `
                            <div class="decision-categories">
                                ${categories
                                    .map(
                                        (category) => `
                                            <span class="category-pill">
                                                ${escapeHTML(
                                                    typeof category === "string"
                                                        ? category
                                                        : category.label ||
                                                          category.name ||
                                                          category.category ||
                                                          ""
                                                )}
                                            </span>
                                        `
                                    )
                                    .join("")}
                            </div>
                        `
                        : "";

                return `
                    <div class="decision-card">

                        <div class="decision-number">
                            ${number}
                        </div>

                        <div class="decision-title">
                            ${escapeHTML(title)}
                        </div>

                        ${
                            question
                                ? `
                                    <div class="decision-question">
                                        ${escapeHTML(question)}
                                    </div>
                                `
                                : ""
                        }

                        ${
                            answer
                                ? `
                                    <div class="decision-answer">
                                        ${escapeHTML(answer)}
                                    </div>
                                `
                                : ""
                        }

                        ${categoryHTML}

                        ${
                            status
                                ? `
                                    <div class="decision-status">
                                        ${escapeHTML(status)}
                                    </div>
                                `
                                : ""
                        }

                    </div>
                `;
            })
            .join("");
    }

    /* =========================================================
       URL RISK RENDERING
       ========================================================= */

    function renderURLRisk(urlRisk) {
        const container =
            $("urlRiskContent");

        if (!container) {
            return;
        }

        if (!urlRisk) {
            container.innerHTML = `
                <div class="empty-state">
                    URL risk analysis unavailable.
                </div>
            `;

            return;
        }

        const score =
            Number(urlRisk.score) || 0;

        const level =
            urlRisk.level || "Low";

        const checks =
            urlRisk.checks || {};

        const signals = [];

        if (checks.https === false) {
            signals.push(
                "The page is not using HTTPS."
            );
        }

        if (checks.ipAddress) {
            signals.push(
                "The URL uses an IP address."
            );
        }

        if (checks.manySubdomains) {
            signals.push(
                "The URL contains many subdomains."
            );
        }

        if (checks.longUrl) {
            signals.push(
                "The URL is unusually long."
            );
        }

        if (checks.suspiciousPort) {
            signals.push(
                "A non-standard port was detected."
            );
        }

        if (checks.usernameInUrl) {
            signals.push(
                "Username information appears in the URL."
            );
        }

        if (checks.urlShortener) {
            signals.push(
                "A URL-shortening pattern was detected."
            );
        }

        if (checks.encodedUrl) {
            signals.push(
                "Encoded URL content was detected."
            );
        }

        if (
            Array.isArray(
                checks.suspiciousCharacters
            ) &&
            checks.suspiciousCharacters.length > 0
        ) {
            signals.push(
                "Potentially suspicious URL characters were detected."
            );
        }

        container.innerHTML = `
            <div class="risk-mini-summary">

                <strong>
                    ${Math.round(score)}
                </strong>

                <span>
                    ${escapeHTML(level)}
                </span>

            </div>

            ${
                signals.length > 0
                    ? `
                        <ul class="risk-signal-list">
                            ${signals
                                .map(
                                    (signal) => `
                                    <li>
                                        ${escapeHTML(signal)}
                                    </li>
                                `
                                )
                                .join("")}
                        </ul>
                    `
                    : `
                        <div class="empty-state">
                            No obvious structural URL risk signals were detected.
                        </div>
                    `
            }
        `;
    }

    /* =========================================================
       RECOMMENDATIONS
       ========================================================= */

    function generateRecommendations() {
        if (
            !window.LockLensRecommendations ||
            typeof window.LockLensRecommendations
                .generateRecommendations !== "function"
        ) {
            return null;
        }

        try {
            return window.LockLensRecommendations
                .generateRecommendations(
                    currentFindings,
                    currentUnifiedRisk
                );
        } catch (error) {
            console.warn(
                "Recommendation generation failed:",
                error
            );

            return null;
        }
    }

    /* =========================================================
       TIMELINE
       ========================================================= */

    async function recordTimeline() {
        if (
            !window.LockLensTimeline ||
            typeof window.LockLensTimeline
                .securelyRecordExposure !== "function"
        ) {
            return;
        }

        try {
            await window.LockLensTimeline
                .securelyRecordExposure(
                    currentFindings,
                    currentUnifiedRisk
                );
        } catch (error) {
            console.warn(
                "Timeline recording failed:",
                error
            );
        }
    }

    /* =========================================================
       SAVE SCAN DATA
       ========================================================= */

    async function saveScanData(tab) {
        const timestamp =
            Date.now();

        await storageSet({
            lockLensFindings:
                currentFindings,

            lockLensRisk:
                currentPageRisk,

            lockLensUnifiedRisk:
                currentUnifiedRisk,

            lockLensRecommendations:
                currentRecommendations,

            lockLensExplanation:
                currentExplanation,

            lockLensPrivacyLabel:
                currentPrivacyLabel,

            lockLensPrivacyDecision:
                currentDecisionPath,

            lockLensLastScan:
                timestamp,

            lockLensURLRisk:
                currentURLRisk
                    ? {
                        valid:
                            currentURLRisk.valid,
                        score:
                            currentURLRisk.score,
                        level:
                            currentURLRisk.level,
                        checks:
                            currentURLRisk.checks,
                        recommendations:
                            currentURLRisk.recommendations,
                        limitations:
                            currentURLRisk.limitations
                    }
                    : null
        });
    }

    /* =========================================================
       FULL PAGE ANALYSIS
       ========================================================= */

    async function analyzeCurrentPage() {
        const analyzeButton =
            $("analyzeButton");

        try {
            if (analyzeButton) {
                analyzeButton.disabled = true;
                analyzeButton.textContent =
                    "Analyzing...";
            }

            setStatus(
                true,
                "Analyzing page locally..."
            );

            const tab =
                await getCurrentTab();

            if (!tab) {
                throw new Error(
                    "Unable to access the current browser tab."
                );
            }

            currentFindings =
                normalizeFindings(
                    await runScanner(tab)
                );

            currentPageRisk =
                calculatePageRisk(
                    currentFindings
                );

            currentURLRisk =
                calculateURLRisk(tab);

            currentUnifiedRisk =
                calculateUnifiedRisk({
                    findings:
                        currentFindings,
                    urlRisk:
                        currentURLRisk,
                    emailRisk:
                        currentEmailRisk
                });

            currentRecommendations =
                generateRecommendations();

            currentExplanation =
                generateExplanation();

            currentPrivacyLabel =
                generatePrivacyLabel();

            currentDecisionPath =
                generateDecisionPath();

            renderRisk(
                currentUnifiedRisk
            );

            renderURLRisk(
                currentURLRisk
            );

            renderExplanation(
                currentExplanation
            );

            renderPrivacyLabel(
                currentPrivacyLabel
            );

            renderDecisionPath(
                currentDecisionPath
            );

            await saveScanData(tab);

            await recordTimeline();

            const categoryCount =
                new Set(
                    currentFindings.map(
                        (finding) =>
                            String(
                                finding.category ||
                                ""
                            ).toLowerCase()
                    )
                ).size;

            setStatus(
                true,
                `Analysis complete — ${categoryCount} privacy category(s) detected.`
            );

        } catch (error) {
            console.error(
                "LockLens analysis error:",
                error
            );

            setStatus(
                false,
                error?.message ||
                "Analysis failed."
            );

            renderRisk({
                score: 0,
                level: "Low"
            });

        } finally {
            if (analyzeButton) {
                analyzeButton.disabled = false;
                analyzeButton.textContent =
                    "Analyze This Page";
            }
        }
    }

    /* =========================================================
       PRIVACY GUARD
       ========================================================= */

    async function loadPrivacyGuardState() {
        const result =
            await storageGet([
                "privacyGuardEnabled"
            ]);

        const enabled =
            result.privacyGuardEnabled !== false;

        updatePrivacyGuardUI(
            enabled
        );

        return enabled;
    }

    async function togglePrivacyGuard() {
        const result =
            await storageGet([
                "privacyGuardEnabled"
            ]);

        const enabled =
            result.privacyGuardEnabled !== false;

        const newState =
            !enabled;

        await storageSet({
            privacyGuardEnabled:
                newState
        });

        updatePrivacyGuardUI(
            newState
        );
    }

    function updatePrivacyGuardUI(enabled) {
        const toggle =
            $("privacyGuardToggle");

        const button =
            $("privacyGuardButton");

        if (toggle) {
            if (
                toggle.type === "checkbox"
            ) {
                toggle.checked =
                    enabled;
            }
        }

        if (button) {
            button.textContent =
                enabled
                    ? "Privacy Guard: ON"
                    : "Privacy Guard: OFF";

            button.classList.toggle(
                "active",
                enabled
            );
        }
    }

    /* =========================================================
       EMAIL HEADER ANALYZER
       ========================================================= */

    function getEmailInput() {
        const input =
            $("emailHeadersInput");

        if (!input) {
            return "";
        }

        return input.value.trim();
    }

    async function analyzeEmailHeaders() {
        const input =
            getEmailInput();

        const resultContainer =
            $("emailResult");

        if (!input) {
            if (resultContainer) {
                resultContainer.innerHTML = `
                    <div class="empty-state">
                        Paste dummy/test email headers first.
                    </div>
                `;
            }

            return;
        }

        if (
            !window.LockLensEmailAnalyzer ||
            typeof window.LockLensEmailAnalyzer
                .analyzeHeaders !== "function"
        ) {
            if (resultContainer) {
                resultContainer.innerHTML = `
                    <div class="empty-state">
                        Email Header Analyzer is unavailable.
                    </div>
                `;
            }

            return;
        }

        try {
            if (resultContainer) {
                resultContainer.innerHTML = `
                    <div class="empty-state">
                        Analyzing headers locally...
                    </div>
                `;
            }

            const result =
                window.LockLensEmailAnalyzer
                    .analyzeHeaders(input);

            currentEmailRisk =
                result;

            /*
             * Important:
             * Only anonymous email metadata is stored.
             * Raw email headers are never saved.
             */

            await storageSet({
                lockLensEmailRisk:
                    {
                        score:
                            result.score,
                        level:
                            result.level,
                        spf:
                            result.spf,
                        dkim:
                            result.dkim,
                        dmarc:
                            result.dmarc,
                        fromReturnPathMismatch:
                            result.fromReturnPathMismatch,
                        replyToMismatch:
                            result.replyToMismatch,
                        messageIdDomainMismatch:
                            result.messageIdDomainMismatch,
                        receivedCount:
                            result.receivedCount,
                        recommendations:
                            result.recommendations,
                        limitations:
                            result.limitations,
                        processedLocally:
                            true,
                        rawHeadersStored:
                            false,
                        timestamp:
                            Date.now()
                    }
            });

            currentUnifiedRisk =
                calculateUnifiedRisk({
                    findings:
                        currentFindings,
                    urlRisk:
                        currentURLRisk,
                    emailRisk:
                        currentEmailRisk
                });

            currentRecommendations =
                generateRecommendations();

            currentExplanation =
                generateExplanation();

            currentPrivacyLabel =
                generatePrivacyLabel();

            currentDecisionPath =
                generateDecisionPath();

            renderRisk(
                currentUnifiedRisk
            );

            renderExplanation(
                currentExplanation
            );

            renderPrivacyLabel(
                currentPrivacyLabel
            );

            renderDecisionPath(
                currentDecisionPath
            );

            await storageSet({
                lockLensUnifiedRisk:
                    currentUnifiedRisk,

                lockLensRecommendations:
                    currentRecommendations,

                lockLensExplanation:
                    currentExplanation,

                lockLensPrivacyLabel:
                    currentPrivacyLabel,

                lockLensPrivacyDecision:
                    currentDecisionPath
            });

            renderEmailResult(
                result
            );

        } catch (error) {
            console.error(
                "Email header analysis failed:",
                error
            );

            if (resultContainer) {
                resultContainer.innerHTML = `
                    <div class="empty-state">
                        ${escapeHTML(
                            error?.message ||
                            "Unable to analyze email headers."
                        )}
                    </div>
                `;
            }
        }
    }

    function renderEmailResult(result) {
        const container =
            $("emailResult");

        if (!container) {
            return;
        }

        if (!result) {
            container.innerHTML = "";
            return;
        }

        const score =
            Number(result.score) || 0;

        const level =
            result.level || "Low";

        const checks = [];

        if (result.spf) {
            checks.push(
                `SPF: ${result.spf.status || "unknown"}`
            );
        }

        if (result.dkim) {
            checks.push(
                `DKIM: ${result.dkim.status || "unknown"}`
            );
        }

        if (result.dmarc) {
            checks.push(
                `DMARC: ${result.dmarc.status || "unknown"}`
            );
        }

        if (
            result.fromReturnPathMismatch
        ) {
            checks.push(
                "From / Return-Path mismatch detected"
            );
        }

        if (
            result.replyToMismatch
        ) {
            checks.push(
                "Reply-To mismatch detected"
            );
        }

        if (
            result.messageIdDomainMismatch
        ) {
            checks.push(
                "Message-ID domain mismatch detected"
            );
        }

        if (
            typeof result.receivedCount === "number"
        ) {
            checks.push(
                `Received headers: ${result.receivedCount}`
            );
        }

        container.innerHTML = `
            <div class="email-risk-summary">

                <strong>
                    ${Math.round(score)}
                </strong>

                <span>
                    ${escapeHTML(level)}
                </span>

            </div>

            ${
                checks.length > 0
                    ? `
                        <ul class="email-check-list">
                            ${checks
                                .map(
                                    (check) => `
                                    <li>
                                        ${escapeHTML(check)}
                                    </li>
                                `
                                )
                                .join("")}
                        </ul>
                    `
                    : `
                        <div class="empty-state">
                            No major email authentication signals were detected.
                        </div>
                    `
            }
        `;
    }

    async function clearEmailHeaders() {
        const input =
            $("emailHeadersInput");

        const result =
            $("emailResult");

        if (input) {
            input.value = "";
        }

        if (result) {
            result.innerHTML = "";
        }

        currentEmailRisk =
            null;

        await storageRemove([
            "lockLensEmailRisk"
        ]);

        currentUnifiedRisk =
            calculateUnifiedRisk({
                findings:
                    currentFindings,
                urlRisk:
                    currentURLRisk,
                emailRisk:
                    null
            });

        currentRecommendations =
            generateRecommendations();

        currentExplanation =
            generateExplanation();

        currentPrivacyLabel =
            generatePrivacyLabel();

        currentDecisionPath =
            generateDecisionPath();

        renderRisk(
            currentUnifiedRisk
        );

        renderExplanation(
            currentExplanation
        );

        renderPrivacyLabel(
            currentPrivacyLabel
        );

        renderDecisionPath(
            currentDecisionPath
        );

        await storageSet({
            lockLensUnifiedRisk:
                currentUnifiedRisk,

            lockLensRecommendations:
                currentRecommendations,

            lockLensExplanation:
                currentExplanation,

            lockLensPrivacyLabel:
                currentPrivacyLabel,

            lockLensPrivacyDecision:
                currentDecisionPath
        });
    }

    /* =========================================================
       DASHBOARD
       ========================================================= */

    function openDashboard() {
        if (
            typeof chrome === "undefined" ||
            !chrome.tabs
        ) {
            return;
        }

        chrome.tabs.create({
            url:
                chrome.runtime.getURL(
                    "dashboard/dashboard.html"
                )
        });
    }

    /* =========================================================
       LOAD STORED DATA
       ========================================================= */

    async function loadStoredData() {
        const stored =
            await storageGet([
                "lockLensFindings",
                "lockLensRisk",
                "lockLensUnifiedRisk",
                "lockLensRecommendations",
                "lockLensExplanation",
                "lockLensPrivacyLabel",
                "lockLensPrivacyDecision",
                "lockLensURLRisk",
                "lockLensEmailRisk",
                "lockLensLastScan"
            ]);

        currentFindings =
            Array.isArray(
                stored.lockLensFindings
            )
                ? stored.lockLensFindings
                : [];

        currentPageRisk =
            stored.lockLensRisk ||
            null;

        currentUnifiedRisk =
            stored.lockLensUnifiedRisk ||
            currentPageRisk ||
            null;

        currentRecommendations =
            stored.lockLensRecommendations ||
            null;

        currentExplanation =
            stored.lockLensExplanation ||
            null;

        currentPrivacyLabel =
            stored.lockLensPrivacyLabel ||
            null;

        currentDecisionPath =
            stored.lockLensPrivacyDecision ||
            null;

        currentURLRisk =
            stored.lockLensURLRisk ||
            null;

        currentEmailRisk =
            stored.lockLensEmailRisk ||
            null;

        renderRisk(
            currentUnifiedRisk
        );

        renderURLRisk(
            currentURLRisk
        );

        renderExplanation(
            currentExplanation
        );

        renderPrivacyLabel(
            currentPrivacyLabel
        );

        renderDecisionPath(
            currentDecisionPath
        );

        if (currentEmailRisk) {
            renderEmailResult(
                currentEmailRisk
            );
        }

        return stored;
    }

    /* =========================================================
       EVENT LISTENERS
       ========================================================= */

    function attachEventListeners() {
        const analyzeButton =
            $("analyzeButton");

        if (analyzeButton) {
            analyzeButton.addEventListener(
                "click",
                analyzeCurrentPage
            );
        }

        const guardButton =
            $("privacyGuardButton");

        if (guardButton) {
            guardButton.addEventListener(
                "click",
                togglePrivacyGuard
            );
        }

        const guardToggle =
            $("privacyGuardToggle");

        if (guardToggle) {
            guardToggle.addEventListener(
                "change",
                async () => {
                    await storageSet({
                        privacyGuardEnabled:
                            guardToggle.checked
                    });

                    updatePrivacyGuardUI(
                        guardToggle.checked
                    );
                }
            );
        }

        const emailButton =
            $("analyzeEmailButton");

        if (emailButton) {
            emailButton.addEventListener(
                "click",
                analyzeEmailHeaders
            );
        }

        const clearEmailButton =
            $("clearEmailButton");

        if (clearEmailButton) {
            clearEmailButton.addEventListener(
                "click",
                clearEmailHeaders
            );
        }

        const dashboardButton =
            $("dashboardButton");

        if (dashboardButton) {
            dashboardButton.addEventListener(
                "click",
                openDashboard
            );
        }

        const openDashboardButton =
            $("openDashboardButton");

        if (openDashboardButton) {
            openDashboardButton.addEventListener(
                "click",
                openDashboard
            );
        }
    }

    /* =========================================================
       INITIALIZATION
       ========================================================= */

    async function initializePopup() {
        try {
            setStatus(
                true,
                "LockLens ready — analysis runs locally."
            );

            attachEventListeners();

            await loadPrivacyGuardState();

            await loadStoredData();

            /*
             * Automatically refresh URL risk using the
             * current tab without storing the raw URL.
             */

            const tab =
                await getCurrentTab();

            if (
                tab &&
                tab.url &&
                window.LockLensURLInspector
            ) {
                try {
                    currentURLRisk =
                        calculateURLRisk(tab);

                    if (currentURLRisk) {
                        await storageSet({
                            lockLensURLRisk:
                                {
                                    valid:
                                        currentURLRisk.valid,
                                    score:
                                        currentURLRisk.score,
                                    level:
                                        currentURLRisk.level,
                                    checks:
                                        currentURLRisk.checks,
                                    recommendations:
                                        currentURLRisk.recommendations,
                                    limitations:
                                        currentURLRisk.limitations
                                }
                        });

                        renderURLRisk(
                            currentURLRisk
                        );
                    }
                } catch (error) {
                    console.warn(
                        "Initial URL analysis failed:",
                        error
                    );
                }
            }

        } catch (error) {
            console.error(
                "LockLens popup initialization failed:",
                error
            );

            setStatus(
                false,
                "LockLens initialization failed."
            );
        }
    }

    /* =========================================================
       START
       ========================================================= */

    if (
        document.readyState ===
        "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",
            initializePopup
        );
    } else {
        initializePopup();
    }

})();
