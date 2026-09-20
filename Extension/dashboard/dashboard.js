(() => {
    "use strict";

    const STORAGE_KEYS = [
        "lockLensFindings",
        "lockLensRisk",
        "lockLensRecommendations",
        "lockLensExplanation",
        "lockLensLastScan",
        "privacyGuardEnabled",
        "lockLensGuardLastResult",
        "lockLensExposureEvents",
        "exposureTimeline",
        "lockLensURLRisk"
    ];

    document.addEventListener(
        "DOMContentLoaded",
        initializeDashboard
    );

    async function initializeDashboard() {
        try {
            await renderDashboard();

            chrome.storage.local.onChanged.addListener(
                async () => {
                    await renderDashboard();
                }
            );

            const clearButton =
                document.getElementById(
                    "clearDataButton"
                );

            if (clearButton) {
                clearButton.addEventListener(
                    "click",
                    clearLocalData
                );
            }
        } catch (error) {
            console.error(
                "Dashboard initialization failed:",
                error
            );
        }
    }

    // =====================================================
    // MAIN DASHBOARD
    // =====================================================

    async function renderDashboard() {
        const data =
            await chrome.storage.local.get(
                STORAGE_KEYS
            );

        renderRisk(
            data.lockLensRisk
        );

        renderLastScan(
            data.lockLensLastScan
        );

        renderURLRisk(
            data.lockLensURLRisk
        );

        renderExplanation(
            data.lockLensExplanation
        );

        renderFindings(
            data.lockLensFindings || []
        );

        renderPrivacyGuard(
            data.privacyGuardEnabled,
            data.lockLensGuardLastResult
        );

        renderTimeline(
            data.lockLensExposureEvents,
            data.exposureTimeline
        );

        renderCategories(
            data.lockLensFindings || []
        );

        renderRecommendations(
            data.lockLensRecommendations
        );
    }

    // =====================================================
    // RISK
    // =====================================================

    function renderRisk(risk) {
        const scoreElement =
            document.getElementById(
                "riskScore"
            );

        const levelElement =
            document.getElementById(
                "riskLevel"
            );

        const categoriesElement =
            document.getElementById(
                "riskCategories"
            );

        if (!risk) {
            if (scoreElement) {
                scoreElement.textContent =
                    "—";
            }

            if (levelElement) {
                levelElement.textContent =
                    "Not analyzed";

                levelElement.className =
                    "risk-unknown";
            }

            if (categoriesElement) {
                categoriesElement.textContent =
                    "No categories detected.";
            }

            return;
        }

        if (scoreElement) {
            scoreElement.textContent =
                `${risk.score ?? 0}/100`;
        }

        if (levelElement) {
            levelElement.textContent =
                risk.level || "Unknown";

            levelElement.className =
                getRiskClass(
                    risk.level
                );
        }

        if (categoriesElement) {
            const categories =
                Array.isArray(
                    risk.categories
                )
                    ? risk.categories
                    : [];

            categoriesElement.textContent =
                categories.length > 0
                    ? `Categories: ${categories
                          .map(
                              formatCategory
                          )
                          .join(", ")}`
                    : "No categories detected.";
        }
    }

    // =====================================================
    // LAST SCAN
    // =====================================================

    function renderLastScan(
        lastScan
    ) {
        const element =
            document.getElementById(
                "lastScanTime"
            );

        if (!element) {
            return;
        }

        if (!lastScan?.timestamp) {
            element.textContent =
                "No scan yet";

            return;
        }

        element.textContent =
            `Last analyzed: ${formatDate(
                lastScan.timestamp
            )}`;
    }

    // =====================================================
    // URL RISK
    // =====================================================

    function renderURLRisk(
        urlRisk
    ) {
        const scoreElement =
            document.getElementById(
                "dashboardURLScore"
            );

        const levelElement =
            document.getElementById(
                "dashboardURLLevel"
            );

        const checksElement =
            document.getElementById(
                "dashboardURLChecks"
            );

        const timeElement =
            document.getElementById(
                "dashboardURLTime"
            );

        if (!urlRisk) {
            if (scoreElement) {
                scoreElement.textContent =
                    "—";
            }

            if (levelElement) {
                levelElement.textContent =
                    "Not analyzed";

                levelElement.className =
                    "risk-unknown";
            }

            if (checksElement) {
                checksElement.innerHTML = `
                    <div class="empty-state">
                        No URL assessment yet.
                    </div>
                `;
            }

            if (timeElement) {
                timeElement.textContent =
                    "No URL assessment yet.";
            }

            return;
        }

        if (scoreElement) {
            scoreElement.textContent =
                `${urlRisk.score ?? 0}/100`;
        }

        if (levelElement) {
            levelElement.textContent =
                urlRisk.level ||
                "Unknown";

            levelElement.className =
                getRiskClass(
                    urlRisk.level
                );
        }

        if (checksElement) {
            checksElement.innerHTML =
                "";

            const checks =
                urlRisk.checks || {};

            addURLCheck(
                checksElement,
                Boolean(
                    checks.https
                ),
                "HTTPS",
                "Secure connection",
                "HTTPS not detected"
            );

            addURLCheck(
                checksElement,
                !Boolean(
                    checks.ipAddress
                ),
                "IP Address",
                "Domain name used",
                "IP address used"
            );

            addURLCheck(
                checksElement,
                !Boolean(
                    checks.longUrl
                ),
                "URL Length",
                "Normal length",
                "Unusually long URL"
            );

            addURLCheck(
                checksElement,
                !Boolean(
                    checks.manySubdomains
                ),
                "Subdomains",
                "Normal structure",
                "Many subdomains"
            );

            addURLCheck(
                checksElement,
                !(
                    typeof
                        checks.suspiciousCharacters ===
                        "number" &&
                    checks.suspiciousCharacters >
                        0
                ),
                "Characters",
                "No suspicious characters",
                "Suspicious characters detected"
            );

            addURLCheck(
                checksElement,
                !Boolean(
                    checks.suspiciousPort
                ),
                "Port",
                "No unusual port",
                "Unusual port detected"
            );

            addURLCheck(
                checksElement,
                !Boolean(
                    checks.usernameInUrl
                ),
                "Username",
                "No username in URL",
                "Username embedded in URL"
            );

            addURLCheck(
                checksElement,
                !Boolean(
                    checks.urlShortener
                ),
                "URL Shortener",
                "No common shortener",
                "Shortened URL detected"
            );

            addURLCheck(
                checksElement,
                !Boolean(
                    checks.encodedUrl
                ),
                "Encoding",
                "No unusual encoding",
                "Encoded URL content detected"
            );
        }

        if (timeElement) {
            timeElement.textContent =
                urlRisk.timestamp
                    ? `Assessment time: ${formatDate(
                          urlRisk.timestamp
                      )}`
                    : "Assessment time unavailable.";
        }
    }

    function addURLCheck(
        container,
        passed,
        title,
        successText,
        warningText
    ) {
        const item =
            document.createElement(
                "div"
            );

        item.className =
            `url-dashboard-check ${
                passed
                    ? "pass"
                    : "warn"
            }`;

        item.innerHTML = `
            <span class="url-dashboard-check-icon">
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

        container.appendChild(
            item
        );
    }

    // =====================================================
    // EXPLAINABLE RISK
    // =====================================================

    function renderExplanation(
        explanation
    ) {
        const container =
            document.getElementById(
                "dashboardExplanation"
            );

        if (!container) {
            return;
        }

        container.innerHTML =
            "";

        if (!explanation) {
            container.innerHTML = `
                <div class="empty-state">
                    Run a LockLens scan to generate
                    an explanation.
                </div>
            `;

            return;
        }

        // ---------------------------------------------
        // SUMMARY
        // ---------------------------------------------

        const summary =
            document.createElement(
                "div"
            );

        summary.className =
            "explanation-summary-dashboard";

        summary.textContent =
            explanation.summary ||
            "No explanation available.";

        container.appendChild(
            summary
        );

        // ---------------------------------------------
        // REASONS
        // ---------------------------------------------

        if (
            Array.isArray(
                explanation.reasons
            ) &&
            explanation.reasons.length
        ) {
            const title =
                document.createElement(
                    "div"
                );

            title.className =
                "explanation-section-title";

            title.textContent =
                "WHY WAS THIS RISK DETECTED?";

            container.appendChild(
                title
            );

            explanation.reasons.forEach(
                (reason) => {
                    const item =
                        document.createElement(
                            "div"
                        );

                    item.className =
                        "explanation-dashboard-item";

                    item.textContent =
                        reason;

                    container.appendChild(
                        item
                    );
                }
            );
        }

        // ---------------------------------------------
        // ACTIONS
        // ---------------------------------------------

        if (
            Array.isArray(
                explanation.actions
            ) &&
            explanation.actions.length
        ) {
            const title =
                document.createElement(
                    "div"
                );

            title.className =
                "explanation-section-title";

            title.textContent =
                "WHAT SHOULD THE USER DO?";

            container.appendChild(
                title
            );

            explanation.actions.forEach(
                (action) => {
                    const item =
                        document.createElement(
                            "div"
                        );

                    item.className =
                        "explanation-dashboard-item";

                    item.textContent =
                        action;

                    container.appendChild(
                        item
                    );
                }
            );
        }

        // ---------------------------------------------
        // CATEGORY DETAILS
        // ---------------------------------------------

        if (
            Array.isArray(
                explanation.categoryDetails
            ) &&
            explanation.categoryDetails
                .length
        ) {
            const title =
                document.createElement(
                    "div"
                );

            title.className =
                "explanation-section-title";

            title.textContent =
                "CATEGORY DETAILS";

            container.appendChild(
                title
            );

            const grid =
                document.createElement(
                    "div"
                );

            grid.className =
                "explanation-category-grid";

            explanation.categoryDetails.forEach(
                (detail) => {
                    const card =
                        document.createElement(
                            "div"
                        );

                    card.className =
                        "explanation-category-card";

                    const titleElement =
                        document.createElement(
                            "strong"
                        );

                    titleElement.textContent =
                        detail.title ||
                        formatCategory(
                            detail.category
                        );

                    const explanationElement =
                        document.createElement(
                            "p"
                        );

                    explanationElement.textContent =
                        detail.explanation ||
                        "";

                    const actionElement =
                        document.createElement(
                            "p"
                        );

                    actionElement.className =
                        "explanation-category-action";

                    actionElement.textContent =
                        `Action: ${
                            detail.action ||
                            "Review whether this information is necessary."
                        }`;

                    card.appendChild(
                        titleElement
                    );

                    card.appendChild(
                        explanationElement
                    );

                    card.appendChild(
                        actionElement
                    );

                    grid.appendChild(
                        card
                    );
                }
            );

            container.appendChild(
                grid
            );
        }
    }

    // =====================================================
    // FINDINGS
    // =====================================================

    function renderFindings(
        findings
    ) {
        const container =
            document.getElementById(
                "findingsList"
            );

        if (!container) {
            return;
        }

        container.innerHTML =
            "";

        if (
            !Array.isArray(
                findings
            ) ||
            findings.length === 0
        ) {
            container.innerHTML = `
                <div class="empty-state">
                    No exposure signals detected.
                </div>
            `;

            return;
        }

        const categoryMap =
            new Map();

        findings.forEach(
            (finding) => {
                const category =
                    String(
                        finding.category ||
                            "unknown"
                    ).toLowerCase();

                categoryMap.set(
                    category,
                    (
                        categoryMap.get(
                            category
                        ) || 0
                    ) + 1
                );
            }
        );

        categoryMap.forEach(
            (
                count,
                category
            ) => {
                const item =
                    document.createElement(
                        "div"
                    );

                item.className =
                    "finding-item";

                const title =
                    document.createElement(
                        "strong"
                    );

                title.textContent =
                    formatCategory(
                        category
                    );

                const description =
                    document.createElement(
                        "span"
                    );

                description.textContent =
                    `${count} exposure signal${
                        count === 1
                            ? ""
                            : "s"
                    }`;

                item.appendChild(
                    title
                );

                item.appendChild(
                    description
                );

                container.appendChild(
                    item
                );
            }
        );
    }

    // =====================================================
    // PRIVACY GUARD
    // =====================================================

    function renderPrivacyGuard(
        enabled,
        lastResult
    ) {
        const status =
            document.getElementById(
                "guardStatus"
            );

        const result =
            document.getElementById(
                "guardLastResult"
            );

        if (status) {
            const isEnabled =
                enabled !== false;

            status.textContent =
                isEnabled
                    ? "Privacy Guard Active"
                    : "Privacy Guard Disabled";

            status.style.color =
                isEnabled
                    ? "#00e6b8"
                    : "#ff8a8a";
        }

        if (result) {
            if (!lastResult) {
                result.textContent =
                    "No recent guard assessment.";

                return;
            }

            const categories =
                Array.isArray(
                    lastResult.categories
                )
                    ? lastResult.categories
                    : [];

            if (categories.length === 0) {
                result.textContent =
                    "Latest assessment: no sensitive form categories detected.";
            } else {
                result.textContent =
                    `Latest assessment: ${categories
                        .map(
                            formatCategory
                        )
                        .join(", ")}`;
            }
        }
    }

    // =====================================================
    // TIMELINE
    // =====================================================

    function renderTimeline(
        events,
        legacyTimeline
    ) {
        const container =
            document.getElementById(
                "timelineContainer"
            );

        if (!container) {
            return;
        }

        container.innerHTML =
            "";

        let normalizedEvents =
            normalizeTimeline(
                events,
                legacyTimeline
            );

        if (
            normalizedEvents.length ===
            0
        ) {
            container.innerHTML = `
                <div class="empty-state">
                    No timeline events yet.
                </div>
            `;

            return;
        }

        normalizedEvents =
            normalizedEvents
                .slice(-20)
                .reverse();

        normalizedEvents.forEach(
            (event) => {
                const item =
                    document.createElement(
                        "div"
                    );

                item.className =
                    "timeline-item";

                const date =
                    document.createElement(
                        "div"
                    );

                date.className =
                    "timeline-date";

                date.textContent =
                    formatDate(
                        event.timestamp
                    );

                const categories =
                    document.createElement(
                        "div"
                    );

                categories.className =
                    "timeline-categories";

                categories.textContent =
                    Array.isArray(
                        event.categories
                    ) &&
                    event.categories
                        .length
                        ? event.categories
                              .map(
                                  formatCategory
                              )
                              .join(", ")
                        : "No categories";

                const risk =
                    document.createElement(
                        "div"
                    );

                risk.className =
                    "timeline-risk";

                risk.textContent =
                    `${event.riskScore ?? 0}/100${
                        event.riskLevel
                            ? ` • ${event.riskLevel}`
                            : ""
                    }`;

                item.appendChild(
                    date
                );

                item.appendChild(
                    categories
                );

                item.appendChild(
                    risk
                );

                container.appendChild(
                    item
                );
            }
        );
    }

    function normalizeTimeline(
        events,
        legacyTimeline
    ) {
        if (
            Array.isArray(events) &&
            events.length > 0
        ) {
            return events.map(
                (event) => ({
                    timestamp:
                        event.timestamp ||
                        Date.now(),

                    categories:
                        Array.isArray(
                            event.categories
                        )
                            ? event.categories
                            : [],

                    riskScore:
                        event.riskScore ??
                        0,

                    riskLevel:
                        event.riskLevel ||
                        ""
                })
            );
        }

        if (
            legacyTimeline &&
            typeof legacyTimeline ===
                "object"
        ) {
            const output = [];

            Object.entries(
                legacyTimeline
            ).forEach(
                (
                    [date, value]
                ) => {
                    const categories =
                        value.categories &&
                        typeof value.categories ===
                            "object"
                            ? Object.keys(
                                  value.categories
                              )
                            : [];

                    const riskScores =
                        Array.isArray(
                            value.riskScores
                        )
                            ? value.riskScores
                            : [];

                    const latestScore =
                        riskScores.length
                            ? riskScores[
                                  riskScores.length -
                                      1
                              ]
                            : 0;

                    output.push({
                        timestamp:
                            new Date(
                                date
                            ).getTime(),

                        categories,

                        riskScore:
                            latestScore,

                        riskLevel:
                            getRiskLevel(
                                latestScore
                            )
                    });
                }
            );

            return output;
        }

        return [];
    }

    // =====================================================
    // CATEGORY CHART
    // =====================================================

    function renderCategories(
        findings
    ) {
        const container =
            document.getElementById(
                "categoryChart"
            );

        if (!container) {
            return;
        }

        container.innerHTML =
            "";

        if (
            !Array.isArray(
                findings
            ) ||
            findings.length === 0
        ) {
            container.innerHTML = `
                <div class="empty-state">
                    No category data available.
                </div>
            `;

            return;
        }

        const counts = {};

        findings.forEach(
            (finding) => {
                const category =
                    String(
                        finding.category ||
                            "unknown"
                    ).toLowerCase();

                counts[category] =
                    (
                        counts[category] ||
                        0
                    ) + 1;
            }
        );

        const entries =
            Object.entries(
                counts
            ).sort(
                (a, b) =>
                    b[1] - a[1]
            );

        const max =
            entries[0]?.[1] || 1;

        entries.forEach(
            (
                [category, count]
            ) => {
                const row =
                    document.createElement(
                        "div"
                    );

                row.className =
                    "category-row";

                const name =
                    document.createElement(
                        "div"
                    );

                name.className =
                    "category-name";

                name.textContent =
                    formatCategory(
                        category
                    );

                const bar =
                    document.createElement(
                        "div"
                    );

                bar.className =
                    "category-bar";

                const fill =
                    document.createElement(
                        "div"
                    );

                fill.className =
                    "category-bar-fill";

                const percentage =
                    Math.max(
                        5,
                        (
                            count /
                            max
                        ) * 100
                    );

                fill.style.width =
                    `${percentage}%`;

                bar.appendChild(
                    fill
                );

                const countElement =
                    document.createElement(
                        "div"
                    );

                countElement.className =
                    "category-count";

                countElement.textContent =
                    count;

                row.appendChild(
                    name
                );

                row.appendChild(
                    bar
                );

                row.appendChild(
                    countElement
                );

                container.appendChild(
                    row
                );
            }
        );
    }

    // =====================================================
    // RECOMMENDATIONS
    // =====================================================

    function renderRecommendations(
        recommendations
    ) {
        const container =
            document.getElementById(
                "recommendationsList"
            );

        if (!container) {
            return;
        }

        container.innerHTML =
            "";

        let items = [];

        if (
            Array.isArray(
                recommendations
            )
        ) {
            items =
                recommendations;
        } else if (
            recommendations &&
            Array.isArray(
                recommendations.recommendations
            )
        ) {
            items =
                recommendations
                    .recommendations;
        }

        if (items.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    No recommendations available.
                </div>
            `;

            return;
        }

        items.forEach(
            (recommendation) => {
                const item =
                    document.createElement(
                        "div"
                    );

                item.className =
                    "recommendation-item";

                if (
                    typeof recommendation ===
                    "string"
                ) {
                    item.textContent =
                        recommendation;
                } else {
                    item.textContent =
                        recommendation.text ||
                        recommendation.message ||
                        recommendation.title ||
                        "Privacy recommendation";
                }

                container.appendChild(
                    item
                );
            }
        );
    }

    // =====================================================
    // CLEAR DATA
    // =====================================================

    async function clearLocalData() {
        const confirmed =
            window.confirm(
                "Clear all locally stored LockLens scan, timeline, guard, URL-risk, and explanation data?"
            );

        if (!confirmed) {
            return;
        }

        try {
            await chrome.storage.local.remove(
                STORAGE_KEYS
            );

            await renderDashboard();

            window.alert(
                "LockLens local data has been cleared."
            );
        } catch (error) {
            console.error(
                "Failed to clear local data:",
                error
            );

            window.alert(
                "Could not clear local data."
            );
        }
    }

    // =====================================================
    // HELPERS
    // =====================================================

    function formatCategory(
        category
    ) {
        return String(
            category || ""
        )
            .replace(
                /_/g,
                " "
            )
            .replace(
                /\b\w/g,
                (char) =>
                    char.toUpperCase()
            );
    }

    function formatDate(
        timestamp
    ) {
        try {
            return new Date(
                timestamp
            ).toLocaleString();
        } catch {
            return "Unknown";
        }
    }

    function getRiskLevel(
        score
    ) {
        if (score >= 76) {
            return "Critical";
        }

        if (score >= 51) {
            return "High";
        }

        if (score >= 21) {
            return "Medium";
        }

        return "Low";
    }

    function getRiskClass(
        level
    ) {
        const normalized =
            String(
                level || "unknown"
            ).toLowerCase();

        if (
            normalized ===
            "critical"
        ) {
            return "risk-critical";
        }

        if (
            normalized ===
            "high"
        ) {
            return "risk-high";
        }

        if (
            normalized ===
            "medium"
        ) {
            return "risk-medium";
        }

        if (
            normalized ===
            "low"
        ) {
            return "risk-low";
        }

        return "risk-unknown";
    }

    function escapeHTML(
        value
    ) {
        const div =
            document.createElement(
                "div"
            );

        div.textContent =
            String(
                value ?? ""
            );

        return div.innerHTML;
    }
})();