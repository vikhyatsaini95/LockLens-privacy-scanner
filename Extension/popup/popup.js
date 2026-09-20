(() => {
    "use strict";

    const RESTRICTED_PROTOCOLS = [
        "chrome:",
        "edge:",
        "about:",
        "chrome-extension:",
        "brave:"
    ];

    const elements = {
        analyzeButton:
            document.getElementById("analyzePage"),

        privacyGuardButton:
            document.getElementById("privacyGuardButton"),

        dashboardButton:
            document.getElementById("dashboardButton"),

        status:
            document.getElementById("status"),

        scannerStatus:
            document.getElementById("scannerStatus"),

        urlPanel:
            document.getElementById("urlRiskPanel"),

        urlScore:
            document.getElementById("urlRiskScore"),

        urlLevel:
            document.getElementById("urlRiskLevel"),

        urlChecks:
            document.getElementById("urlRiskChecks"),

        urlRecommendations:
            document.getElementById(
                "urlRiskRecommendations"
            ),

        explanationPanel:
            document.getElementById(
                "explanationPanel"
            ),

        explanationSummary:
            document.getElementById(
                "explanationSummary"
            ),

        explanationReasons:
            document.getElementById(
                "explanationReasons"
            ),

        explanationActions:
            document.getElementById(
                "explanationActions"
            )
    };

    document.addEventListener(
        "DOMContentLoaded",
        init
    );

    async function init() {
        try {
            await loadPrivacyGuardState();
            await loadPreviousResults();

            if (elements.analyzeButton) {
                elements.analyzeButton.addEventListener(
                    "click",
                    analyzeCurrentPage
                );
            }

            if (elements.privacyGuardButton) {
                elements.privacyGuardButton.addEventListener(
                    "click",
                    togglePrivacyGuard
                );
            }

            if (elements.dashboardButton) {
                elements.dashboardButton.addEventListener(
                    "click",
                    openDashboard
                );
            }

            setScannerStatus("Ready");
        } catch (error) {
            console.error(
                "LockLens initialization error:",
                error
            );

            setStatus(
                "Initialization error."
            );
        }
    }

    // =====================================================
    // ACTIVE TAB
    // =====================================================

    async function getActiveTab() {
        const tabs =
            await chrome.tabs.query({
                active: true,
                currentWindow: true
            });

        return tabs[0];
    }

    function isRestrictedPage(url) {
        if (!url) {
            return true;
        }

        try {
            const parsed = new URL(url);

            return RESTRICTED_PROTOCOLS.includes(
                parsed.protocol
            );
        } catch {
            return true;
        }
    }

    // =====================================================
    // MAIN ANALYSIS
    // =====================================================

    async function analyzeCurrentPage() {
        if (!elements.analyzeButton) {
            return;
        }

        elements.analyzeButton.disabled = true;

        setStatus(
            "Analyzing page..."
        );

        setScannerStatus(
            "Scanning"
        );

        try {
            const tab =
                await getActiveTab();

            if (!tab || !tab.id) {
                throw new Error(
                    "Active tab could not be found."
                );
            }

            // ---------------------------------------------
            // URL ANALYSIS
            // ---------------------------------------------

            await analyzeURL(tab.url);

            if (isRestrictedPage(tab.url)) {
                setStatus(
                    "This page cannot be analyzed. Open a normal HTTP/HTTPS webpage."
                );

                setScannerStatus(
                    "Unavailable"
                );

                return;
            }

            // ---------------------------------------------
            // CHECK SCANNER
            // ---------------------------------------------

            let scannerAvailable = false;

            try {
                const result =
                    await chrome.scripting.executeScript({
                        target: {
                            tabId: tab.id
                        },

                        func: () => {
                            return Boolean(
                                window.LockLensScanner
                            );
                        }
                    });

                scannerAvailable =
                    Boolean(
                        result?.[0]?.result
                    );
            } catch (error) {
                console.warn(
                    "Scanner check failed:",
                    error
                );
            }

            // ---------------------------------------------
            // INJECT SCANNER IF REQUIRED
            // ---------------------------------------------

            if (!scannerAvailable) {
                await chrome.scripting.executeScript({
                    target: {
                        tabId: tab.id
                    },

                    files: [
                        "scripts/scanner.js"
                    ]
                });
            }

            // ---------------------------------------------
            // RUN SCANNER
            // ---------------------------------------------

            const scanResult =
                await chrome.scripting.executeScript({
                    target: {
                        tabId: tab.id
                    },

                    func: () => {
                        if (
                            !window.LockLensScanner ||
                            typeof
                                window.LockLensScanner
                                    .performFullScan !==
                                "function"
                        ) {
                            throw new Error(
                                "LockLens scanner is not available."
                            );
                        }

                        const rawFindings =
                            window.LockLensScanner
                                .performFullScan(
                                    document
                                );

                        if (
                            typeof
                                window.LockLensScanner
                                    .deduplicateFindings ===
                                "function"
                        ) {
                            return window.LockLensScanner
                                .deduplicateFindings(
                                    rawFindings
                                );
                        }

                        return rawFindings;
                    }
                });

            const findings =
                scanResult?.[0]?.result || [];

            // ---------------------------------------------
            // RISK ENGINE
            // ---------------------------------------------

            let risk;

            if (
                window.LockLensRiskEngine &&
                typeof
                    window.LockLensRiskEngine
                        .calculateRisk ===
                        "function"
            ) {
                risk =
                    window.LockLensRiskEngine
                        .calculateRisk(
                            findings
                        );
            } else {
                risk =
                    calculateFallbackRisk(
                        findings
                    );
            }

            // ---------------------------------------------
            // RECOMMENDATIONS
            // ---------------------------------------------

            let recommendations = null;

            if (
                window.LockLensRecommendations &&
                typeof
                    window.LockLensRecommendations
                        .generateRecommendations ===
                        "function"
            ) {
                recommendations =
                    window.LockLensRecommendations
                        .generateRecommendations(
                            findings,
                            risk
                        );
            }

            // ---------------------------------------------
            // GET URL METADATA
            // ---------------------------------------------

            const urlData =
                await chrome.storage.local.get(
                    "lockLensURLRisk"
                );

            const urlRisk =
                urlData.lockLensURLRisk ||
                null;

            // ---------------------------------------------
            // EXPLANATION ENGINE
            // ---------------------------------------------

            let explanation = null;

            if (
                window.LockLensExplanation &&
                typeof
                    window.LockLensExplanation
                        .generateExplanation ===
                        "function"
            ) {
                explanation =
                    window.LockLensExplanation
                        .generateExplanation(
                            findings,
                            risk,
                            urlRisk
                        );
            }

            // ---------------------------------------------
            // SAVE RESULTS
            // ---------------------------------------------

            await chrome.storage.local.set({
                lockLensFindings:
                    findings,

                lockLensRisk:
                    risk,

                lockLensRecommendations:
                    recommendations,

                lockLensExplanation:
                    explanation,

                lockLensLastScan: {
                    timestamp:
                        Date.now(),

                    findingCount:
                        findings.length
                }
            });

            // ---------------------------------------------
            // TIMELINE
            // ---------------------------------------------

            if (
                window.LockLensTimeline &&
                typeof
                    window.LockLensTimeline
                        .securelyRecordExposure ===
                        "function"
            ) {
                try {
                    await window.LockLensTimeline
                        .securelyRecordExposure(
                            findings,
                            risk
                        );
                } catch (error) {
                    console.warn(
                        "Timeline recording failed:",
                        error
                    );
                }
            }

            // ---------------------------------------------
            // DISPLAY EXPLANATION
            // ---------------------------------------------

            renderExplanation(
                explanation
            );

            setStatus(
                findings.length > 0
                    ? `Analysis complete. ${findings.length} exposure signal(s) detected.`
                    : "Analysis complete. No exposure signals detected."
            );

            setScannerStatus(
                "Complete"
            );
        } catch (error) {
            console.error(
                "Page analysis failed:",
                error
            );

            setStatus(
                "Analysis failed: " +
                    (
                        error.message ||
                        "Unknown error."
                    )
            );

            setScannerStatus(
                "Error"
            );
        } finally {
            elements.analyzeButton.disabled =
                false;
        }
    }

    // =====================================================
    // URL RISK
    // =====================================================

    async function analyzeURL(url) {
        if (!elements.urlPanel) {
            return;
        }

        try {
            if (
                !window.LockLensURLInspector ||
                typeof
                    window.LockLensURLInspector
                        .analyzeURL !==
                        "function"
            ) {
                return;
            }

            const result =
                window.LockLensURLInspector
                    .analyzeURL(url);

            renderURLRisk(result);

            /*
             * IMPORTANT:
             * The actual URL is never stored.
             */

            const anonymousURLRisk =
                result
                    ? {
                          score:
                              result.score,

                          level:
                              result.level,

                          checks: {
                              https:
                                  Boolean(
                                      result.checks?.https
                                  ),

                              ipAddress:
                                  Boolean(
                                      result.checks?.ipAddress
                                  ),

                              longUrl:
                                  Boolean(
                                      result.checks?.longUrl
                                  ),

                              manySubdomains:
                                  Boolean(
                                      result.checks?.manySubdomains
                                  ),

                              suspiciousCharacters:
                                  Array.isArray(
                                      result.checks
                                          ?.suspiciousCharacters
                                  )
                                      ? result.checks
                                            .suspiciousCharacters
                                            .length
                                      : 0,

                              suspiciousPort:
                                  Boolean(
                                      result.checks
                                          ?.suspiciousPort
                                  ),

                              usernameInUrl:
                                  Boolean(
                                      result.checks
                                          ?.usernameInUrl
                                  ),

                              urlShortener:
                                  Boolean(
                                      result.checks
                                          ?.urlShortener
                                  ),

                              encodedUrl:
                                  Boolean(
                                      result.checks
                                          ?.encodedUrl
                                  )
                          },

                          timestamp:
                              Date.now()
                      }
                    : null;

            await chrome.storage.local.set({
                lockLensURLRisk:
                    anonymousURLRisk
            });
        } catch (error) {
            console.error(
                "URL analysis failed:",
                error
            );

            await chrome.storage.local.set({
                lockLensURLRisk:
                    null
            });
        }
    }

    function renderURLRisk(result) {
        if (!elements.urlPanel) {
            return;
        }

        elements.urlPanel.style.display =
            "block";

        if (!result) {
            if (elements.urlScore) {
                elements.urlScore.textContent =
                    "—";
            }

            if (elements.urlLevel) {
                elements.urlLevel.textContent =
                    "Unavailable";
            }

            return;
        }

        if (elements.urlScore) {
            elements.urlScore.textContent =
                `${result.score}/100`;
        }

        if (elements.urlLevel) {
            elements.urlLevel.textContent =
                result.level ||
                "Unknown";

            elements.urlLevel.className =
                `url-risk-level ${String(
                    result.level ||
                        "unknown"
                ).toLowerCase()}`;
        }

        if (elements.urlChecks) {
            elements.urlChecks.innerHTML =
                "";

            const checks =
                result.checks || {};

            addURLCheck(
                checks.https,
                "HTTPS",
                "Secure connection",
                "HTTPS not detected"
            );

            addURLCheck(
                !checks.ipAddress,
                "IP Address",
                "Domain name used",
                "IP address used"
            );

            addURLCheck(
                !checks.longUrl,
                "URL Length",
                "Normal length",
                "Unusually long URL"
            );

            addURLCheck(
                !checks.manySubdomains,
                "Subdomains",
                "Normal structure",
                "Many subdomains"
            );

            addURLCheck(
                !(
                    Array.isArray(
                        checks.suspiciousCharacters
                    ) &&
                    checks.suspiciousCharacters
                        .length > 0
                ),
                "Characters",
                "No suspicious characters",
                "Suspicious characters detected"
            );

            addURLCheck(
                !checks.suspiciousPort,
                "Port",
                "No unusual port",
                "Unusual port detected"
            );

            addURLCheck(
                !checks.usernameInUrl,
                "Username",
                "No username in URL",
                "Username embedded in URL"
            );

            addURLCheck(
                !checks.urlShortener,
                "URL Shortener",
                "No common shortener",
                "Shortened URL detected"
            );

            addURLCheck(
                !checks.encodedUrl,
                "Encoding",
                "No unusual encoding",
                "Encoded URL content detected"
            );
        }

        if (
            elements.urlRecommendations
        ) {
            elements.urlRecommendations.innerHTML =
                "";

            (
                result.recommendations ||
                []
            ).forEach(
                (recommendation) => {
                    const div =
                        document.createElement(
                            "div"
                        );

                    div.className =
                        "url-recommendation";

                    div.textContent =
                        recommendation;

                    elements.urlRecommendations
                        .appendChild(div);
                }
            );
        }
    }

    function addURLCheck(
        passed,
        title,
        successText,
        warningText
    ) {
        if (!elements.urlChecks) {
            return;
        }

        const div =
            document.createElement(
                "div"
            );

        div.className =
            `url-check ${
                passed
                    ? "pass"
                    : "warning"
            }`;

        div.innerHTML = `
            <span class="url-check-icon">
                ${passed ? "✓" : "⚠"}
            </span>

            <div>
                <strong>
                    ${escapeHTML(title)}
                </strong>

                <small>
                    ${escapeHTML(
                        passed
                            ? successText
                            : warningText
                    )}
                </small>
            </div>
        `;

        elements.urlChecks.appendChild(
            div
        );
    }

    // =====================================================
    // EXPLANATION
    // =====================================================

    function renderExplanation(
        explanation
    ) {
        if (
            !elements.explanationPanel
        ) {
            return;
        }

        if (!explanation) {
            elements.explanationPanel.style.display =
                "none";

            return;
        }

        elements.explanationPanel.style.display =
            "block";

        if (
            elements.explanationSummary
        ) {
            elements.explanationSummary.textContent =
                explanation.summary ||
                "No explanation available.";
        }

        if (
            elements.explanationReasons
        ) {
            elements.explanationReasons.innerHTML =
                "";

            const title =
                document.createElement(
                    "div"
                );

            title.className =
                "explanation-title";

            title.textContent =
                "WHY WAS THIS RISK DETECTED?";

            elements.explanationReasons
                .appendChild(title);

            (
                explanation.reasons ||
                []
            ).forEach(
                (reason) => {
                    const item =
                        document.createElement(
                            "div"
                        );

                    item.className =
                        "explanation-item";

                    item.textContent =
                        reason;

                    elements.explanationReasons
                        .appendChild(item);
                }
            );
        }

        if (
            elements.explanationActions
        ) {
            elements.explanationActions.innerHTML =
                "";

            const title =
                document.createElement(
                    "div"
                );

            title.className =
                "explanation-title";

            title.textContent =
                "WHAT SHOULD I DO?";

            elements.explanationActions
                .appendChild(title);

            (
                explanation.actions ||
                []
            ).forEach(
                (action) => {
                    const item =
                        document.createElement(
                            "div"
                        );

                    item.className =
                        "explanation-item";

                    item.textContent =
                        action;

                    elements.explanationActions
                        .appendChild(item);
                }
            );
        }
    }

    // =====================================================
    // PRIVACY GUARD
    // =====================================================

    async function loadPrivacyGuardState() {
        const data =
            await chrome.storage.local.get(
                "privacyGuardEnabled"
            );

        updatePrivacyGuardButton(
            data.privacyGuardEnabled !== false
        );
    }

    async function togglePrivacyGuard() {
        try {
            const data =
                await chrome.storage.local.get(
                    "privacyGuardEnabled"
                );

            const currentState =
                data.privacyGuardEnabled !== false;

            const newState =
                !currentState;

            await chrome.storage.local.set({
                privacyGuardEnabled:
                    newState
            });

            updatePrivacyGuardButton(
                newState
            );

            setStatus(
                newState
                    ? "Privacy Guard enabled."
                    : "Privacy Guard disabled."
            );
        } catch (error) {
            console.error(
                "Privacy Guard toggle failed:",
                error
            );

            setStatus(
                "Could not change Privacy Guard."
            );
        }
    }

    function updatePrivacyGuardButton(
        enabled
    ) {
        if (
            !elements.privacyGuardButton
        ) {
            return;
        }

        elements.privacyGuardButton.textContent =
            enabled
                ? "Privacy Guard: ON"
                : "Privacy Guard: OFF";

        elements.privacyGuardButton.classList.toggle(
            "active",
            enabled
        );
    }

    // =====================================================
    // LOAD PREVIOUS RESULTS
    // =====================================================

    async function loadPreviousResults() {
        try {
            const data =
                await chrome.storage.local.get([
                    "lockLensRisk",
                    "lockLensURLRisk",
                    "lockLensExplanation"
                ]);

            if (data.lockLensURLRisk) {
                renderStoredURLRisk(
                    data.lockLensURLRisk
                );
            }

            if (data.lockLensExplanation) {
                renderExplanation(
                    data.lockLensExplanation
                );
            }

            if (data.lockLensRisk) {
                setStatus(
                    `Last privacy risk: ${data.lockLensRisk.score}/100 — ${data.lockLensRisk.level}`
                );
            }
        } catch (error) {
            console.warn(
                "Could not load previous results:",
                error
            );
        }
    }

    function renderStoredURLRisk(
        data
    ) {
        if (
            !elements.urlPanel ||
            !data
        ) {
            return;
        }

        elements.urlPanel.style.display =
            "block";

        if (elements.urlScore) {
            elements.urlScore.textContent =
                `${data.score ?? 0}/100`;
        }

        if (elements.urlLevel) {
            elements.urlLevel.textContent =
                data.level ||
                "Unknown";

            elements.urlLevel.className =
                `url-risk-level ${String(
                    data.level ||
                        "unknown"
                ).toLowerCase()}`;
        }

        if (elements.urlChecks) {
            elements.urlChecks.innerHTML =
                "";

            const checks =
                data.checks || {};

            addURLCheck(
                checks.https,
                "HTTPS",
                "Secure connection",
                "HTTPS not detected"
            );

            addURLCheck(
                !checks.ipAddress,
                "IP Address",
                "Domain name used",
                "IP address used"
            );

            addURLCheck(
                !checks.longUrl,
                "URL Length",
                "Normal length",
                "Unusually long URL"
            );

            addURLCheck(
                !checks.manySubdomains,
                "Subdomains",
                "Normal structure",
                "Many subdomains"
            );

            addURLCheck(
                !(
                    typeof
                        checks.suspiciousCharacters ===
                        "number" &&
                    checks.suspiciousCharacters > 0
                ),
                "Characters",
                "No suspicious characters",
                "Suspicious characters detected"
            );

            addURLCheck(
                !checks.suspiciousPort,
                "Port",
                "No unusual port",
                "Unusual port detected"
            );

            addURLCheck(
                !checks.usernameInUrl,
                "Username",
                "No username in URL",
                "Username embedded in URL"
            );

            addURLCheck(
                !checks.urlShortener,
                "URL Shortener",
                "No common shortener",
                "Shortened URL detected"
            );

            addURLCheck(
                !checks.encodedUrl,
                "Encoding",
                "No unusual encoding",
                "Encoded URL content detected"
            );
        }
    }

    // =====================================================
    // DASHBOARD
    // =====================================================

    function openDashboard() {
        chrome.tabs.create({
            url:
                chrome.runtime.getURL(
                    "dashboard/dashboard.html"
                )
        });
    }

    // =====================================================
    // FALLBACK RISK ENGINE
    // =====================================================

    function calculateFallbackRisk(
        findings
    ) {
        const weights = {
            name: 5,
            email: 10,
            phone: 15,
            address: 20,
            date: 10,
            password: 10,
            payment: 20,
            government_id: 25,
            location: 15,
            username: 5
        };

        let score = 0;

        const categories =
            new Set();

        findings.forEach(
            (finding) => {
                const category =
                    String(
                        finding.category ||
                            ""
                    ).toLowerCase();

                if (
                    weights[category] !==
                    undefined
                ) {
                    score +=
                        weights[category];

                    categories.add(
                        category
                    );
                }
            }
        );

        if (
            categories.size >= 2 &&
            categories.size <= 3
        ) {
            score += 5;
        } else if (
            categories.size >= 4
        ) {
            score += 10;
        }

        score =
            Math.min(
                score,
                100
            );

        let level = "Low";

        if (score >= 76) {
            level = "Critical";
        } else if (score >= 51) {
            level = "High";
        } else if (score >= 21) {
            level = "Medium";
        }

        return {
            version: "fallback",
            score,
            level,
            categories:
                Array.from(categories),
            findingCount:
                findings.length
        };
    }

    // =====================================================
    // HELPERS
    // =====================================================

    function setStatus(message) {
        if (elements.status) {
            elements.status.textContent =
                message;
        }
    }

    function setScannerStatus(message) {
        if (elements.scannerStatus) {
            elements.scannerStatus.textContent =
                message;
        }
    }

    function escapeHTML(value) {
        const div =
            document.createElement(
                "div"
            );

        div.textContent =
            String(value ?? "");

        return div.innerHTML;
    }
})();
