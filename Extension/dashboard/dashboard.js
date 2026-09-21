/* =========================================================
   LockLens Dashboard
   Step 20 - Complete Dashboard Controller
   ========================================================= */

(() => {
    "use strict";

    /* =========================================================
       CONSTANTS
       ========================================================= */

    const STORAGE_KEYS = [
        "lockLensFindings",
        "lockLensRisk",
        "lockLensUnifiedRisk",
        "lockLensRecommendations",
        "lockLensExplanation",
        "lockLensPrivacyLabel",
        "lockLensPrivacyDecision",
        "lockLensURLRisk",
        "lockLensEmailRisk",
        "lockLensLastScan",
        "lockLensGuardLastResult",
        "lockLensExposureEvents",
        "exposureTimeline"
    ];

    /* =========================================================
       HELPERS
       ========================================================= */

    function $(id) {
        return document.getElementById(id);
    }

    function escapeHTML(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function formatDate(timestamp) {
        if (!timestamp) {
            return "Not available";
        }

        try {
            return new Date(timestamp).toLocaleString();
        } catch {
            return "Not available";
        }
    }

    function getRiskClass(level) {
        const normalized =
            String(level || "Low")
                .toLowerCase();

        if (normalized === "critical") {
            return "critical";
        }

        if (normalized === "high") {
            return "high";
        }

        if (normalized === "medium") {
            return "medium";
        }

        return "low";
    }

    function getRiskScore(data) {
        return Math.round(
            Number(
                data?.score ??
                data?.risk?.score ??
                0
            )
        );
    }

    function getRiskLevel(data) {
        return (
            data?.level ||
            data?.risk?.level ||
            "Low"
        );
    }

    function emptyState(message) {
        return `
            <div class="empty-state">
                ${escapeHTML(message)}
            </div>
        `;
    }

    /* =========================================================
       STORAGE
       ========================================================= */

    function getStorage(keys) {
        return new Promise((resolve) => {
            if (
                typeof chrome === "undefined" ||
                !chrome.storage ||
                !chrome.storage.local
            ) {
                resolve({});
                return;
            }

            chrome.storage.local.get(
                keys,
                (result) => {
                    if (chrome.runtime?.lastError) {
                        console.error(
                            "LockLens storage error:",
                            chrome.runtime.lastError.message
                        );

                        resolve({});
                        return;
                    }

                    resolve(result || {});
                }
            );
        });
    }

    /* =========================================================
       RENDER OVERVIEW
       ========================================================= */

    function renderOverview(data) {
        const risk =
            data.lockLensUnifiedRisk ||
            data.lockLensRisk ||
            null;

        const score =
            getRiskScore(risk);

        const level =
            getRiskLevel(risk);

        setText("riskScore", score);
        setText("riskLevel", level);

        const riskScoreElement =
            $("riskScore");

        const riskLevelElement =
            $("riskLevel");

        if (riskScoreElement) {
            riskScoreElement.className =
                `risk-value ${getRiskClass(level)}`;
        }

        if (riskLevelElement) {
            riskLevelElement.className =
                `risk-level ${getRiskClass(level)}`;
        }

        const findings =
            Array.isArray(
                data.lockLensFindings
            )
                ? data.lockLensFindings
                : [];

        setText(
            "findingCount",
            findings.length
        );

        setText(
            "lastScan",
            formatDate(
                data.lockLensLastScan
            )
        );

        const summary =
            $("riskSummary");

        if (summary) {
            if (level === "Critical") {
                summary.textContent =
                    "Multiple high-sensitivity privacy signals were detected.";
            } else if (level === "High") {
                summary.textContent =
                    "Several privacy-sensitive signals were detected.";
            } else if (level === "Medium") {
                summary.textContent =
                    "Some privacy-sensitive signals were detected.";
            } else {
                summary.textContent =
                    "No significant privacy risk signals were detected.";
            }
        }
    }

    /* =========================================================
       TEXT HELPER
       ========================================================= */

    function setText(id, value) {
        const element = $(id);

        if (element) {
            element.textContent =
                value ?? "";
        }
    }

    /* =========================================================
       PRIVACY NUTRITION LABEL
       ========================================================= */

    function renderNutritionLabel(data) {
        const label =
            data.lockLensPrivacyLabel;

        if (!label) {
            const container =
                $("nutritionLabel");

            if (container) {
                container.innerHTML =
                    emptyState(
                        "Analyze a page from the LockLens popup to generate the Privacy Nutrition Label."
                    );
            }

            return;
        }

        const score =
            Number(
                label.risk?.score ?? 0
            );

        const level =
            label.risk?.level ||
            "Low";

        setText(
            "nutritionScore",
            Math.round(score)
        );

        setText(
            "nutritionExposure",
            label.exposureSummary ||
            "No significant exposure detected."
        );

        setText(
            "nutritionSummary",
            label.exposureSummary ||
            "Privacy exposure has been analyzed locally."
        );

        const sensitivity =
            $("nutritionSensitivity");

        if (sensitivity) {
            sensitivity.innerHTML = `
                <div class="nutrition-stat">
                    <strong>
                        ${escapeHTML(
                            label.sensitivity?.level ||
                            "Low"
                        )}
                    </strong>
                    <span>
                        Sensitivity
                    </span>
                </div>

                <div class="nutrition-stat">
                    <strong>
                        ${Math.round(
                            Number(
                                label.sensitivity?.score ||
                                0
                            )
                        )}
                    </strong>
                    <span>
                        Sensitivity Score
                    </span>
                </div>
            `;
        }

        const signals =
            $("nutritionSignals");

        if (signals) {
            const securitySignals =
                Array.isArray(
                    label.securitySignals
                )
                    ? label.securitySignals
                    : [];

            signals.innerHTML =
                securitySignals.length > 0
                    ? securitySignals
                        .map(
                            (signal) => `
                                <div class="nutrition-item">
                                    ${escapeHTML(
                                        typeof signal === "string"
                                            ? signal
                                            : signal.message ||
                                              signal.description ||
                                              signal.name ||
                                              JSON.stringify(signal)
                                    )}
                                </div>
                            `
                        )
                        .join("")
                    : emptyState(
                        "No additional security signals were detected."
                    );
        }

        const actions =
            $("nutritionActions");

        if (actions) {
            const actionList =
                Array.isArray(
                    label.actions
                )
                    ? label.actions
                    : [];

            actions.innerHTML =
                actionList.length > 0
                    ? actionList
                        .map(
                            (action) => `
                                <div class="nutrition-item">
                                    ${escapeHTML(
                                        typeof action === "string"
                                            ? action
                                            : action.message ||
                                              action.title ||
                                              action.description ||
                                              JSON.stringify(action)
                                    )}
                                </div>
                            `
                        )
                        .join("")
                    : emptyState(
                        "No additional actions were generated."
                    );
        }

        const notes =
            $("nutritionPrivacyNotes");

        if (notes) {
            const privacyNotes =
                Array.isArray(
                    label.privacyNotes
                )
                    ? label.privacyNotes
                    : [];

            notes.innerHTML =
                privacyNotes.length > 0
                    ? privacyNotes
                        .map(
                            (note) => `
                                <div class="nutrition-item">
                                    ${escapeHTML(
                                        typeof note === "string"
                                            ? note
                                            : note.message ||
                                              note.description ||
                                              JSON.stringify(note)
                                    )}
                                </div>
                            `
                        )
                        .join("")
                    : emptyState(
                        "Privacy processing information unavailable."
                    );
        }

        setText(
            "nutritionMinimization",
            label.dataMinimization ||
            "LockLens evaluates metadata locally and avoids storing raw personal information."
        );
    }

    /* =========================================================
       CATEGORY INTELLIGENCE
       ========================================================= */

    function renderCategoryIntelligence(data) {
        const container =
            $("categoryIntelligence");

        if (!container) {
            return;
        }

        const label =
            data.lockLensPrivacyLabel;

        const intelligence =
            label?.categoryIntelligence;

        if (
            !intelligence ||
            typeof intelligence !== "object"
        ) {
            container.innerHTML =
                emptyState(
                    "Category intelligence will appear after page analysis."
                );

            return;
        }

        const groups =
            Object.values(
                intelligence
            );

        if (groups.length === 0) {
            container.innerHTML =
                emptyState(
                    "No privacy categories detected."
                );

            return;
        }

        container.innerHTML =
            groups
                .map((group) => {
                    const score =
                        Math.min(
                            100,
                            Math.max(
                                0,
                                Number(
                                    group.sensitivityScore ||
                                    group.sensitivity ||
                                    0
                                ) * 20
                            )
                        );

                    const level =
                        group.sensitivityLevel ||
                        "Low";

                    const categories =
                        Array.isArray(
                            group.categories
                        )
                            ? group.categories
                            : [];

                    return `
                        <div class="category-intelligence-card">

                            <div class="category-intelligence-header">

                                <div>
                                    <h3>
                                        ${escapeHTML(
                                            group.name ||
                                            "Privacy Category"
                                        )}
                                    </h3>

                                    <p>
                                        ${escapeHTML(
                                            group.description ||
                                            ""
                                        )}
                                    </p>
                                </div>

                                <span class="risk-badge ${getRiskClass(level)}">
                                    ${escapeHTML(level)}
                                </span>

                            </div>

                            <div class="category-progress">
                                <div
                                    class="category-progress-bar ${getRiskClass(level)}"
                                    style="width:${score}%"
                                ></div>
                            </div>

                            <div class="category-intelligence-footer">

                                <span>
                                    Sensitivity:
                                    ${Math.round(score)}
                                </span>

                                <span>
                                    Detected:
                                    ${group.detected ? "Yes" : "No"}
                                </span>

                            </div>

                            ${
                                categories.length > 0
                                    ? `
                                        <div class="category-pills">
                                            ${categories
                                                .map(
                                                    (category) => `
                                                        <span class="category-pill">
                                                            ${escapeHTML(
                                                                category
                                                            )}
                                                        </span>
                                                    `
                                                )
                                                .join("")}
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
       RISK SOURCES
       ========================================================= */

    function renderRiskSources(data) {
        const unified =
            data.lockLensUnifiedRisk;

        if (!unified) {
            return;
        }

        const sources =
            unified.sources || {};

        renderSourceCard(
            "pageRisk",
            sources.page
        );

        renderSourceCard(
            "urlRisk",
            sources.url
        );

        renderSourceCard(
            "emailRisk",
            sources.email
        );

        setText(
            "correlationBonus",
            unified.correlationBonus
                ? `+${unified.correlationBonus}`
                : "0"
        );
    }

    function renderSourceCard(id, source) {
        const element =
            $(id);

        if (!element) {
            return;
        }

        if (!source || source.available === false) {
            element.textContent =
                "Not available";

            return;
        }

        const score =
            Number(
                source.score || 0
            );

        const level =
            source.level || "Low";

        element.innerHTML = `
            <strong>
                ${Math.round(score)}
            </strong>

            <span class="risk-badge ${getRiskClass(level)}">
                ${escapeHTML(level)}
            </span>
        `;
    }

    /* =========================================================
       EXPLANATION
       ========================================================= */

    function renderExplanation(data) {
        const container =
            $("explanation");

        if (!container) {
            return;
        }

        const explanation =
            data.lockLensExplanation;

        if (!explanation) {
            container.innerHTML =
                emptyState(
                    "Analyze a page to generate an explanation of the risk score."
                );

            return;
        }

        if (typeof explanation === "string") {
            container.innerHTML = `
                <p>
                    ${escapeHTML(explanation)}
                </p>
            `;

            return;
        }

        const summary =
            explanation.summary ||
            explanation.explanation ||
            explanation.message ||
            "";

        const reasons =
            Array.isArray(
                explanation.reasons
            )
                ? explanation.reasons
                : Array.isArray(
                    explanation.factors
                )
                    ? explanation.factors
                    : [];

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

        container.innerHTML =
            html ||
            emptyState(
                "No additional explanation is available."
            );
    }

    /* =========================================================
       EXPOSURE CATEGORIES
       ========================================================= */

    function renderCategories(data) {
        const container =
            $("categories");

        if (!container) {
            return;
        }

        const findings =
            Array.isArray(
                data.lockLensFindings
            )
                ? data.lockLensFindings
                : [];

        if (findings.length === 0) {
            container.innerHTML =
                emptyState(
                    "No privacy-sensitive categories detected."
                );

            return;
        }

        const counts = {};

        findings.forEach(
            (finding) => {
                const category =
                    String(
                        finding?.category ||
                        finding?.type ||
                        "Unknown"
                    );

                const key =
                    category.toLowerCase();

                counts[key] =
                    (counts[key] || 0) + 1;
            }
        );

        container.innerHTML =
            Object.entries(counts)
                .map(
                    ([category, count]) => `
                        <div class="category-item">

                            <span class="category-pill">
                                ${escapeHTML(category)}
                            </span>

                            <strong>
                                ${count}
                            </strong>

                        </div>
                    `
                )
                .join("");
    }

    /* =========================================================
       URL ASSESSMENT
       ========================================================= */

    function renderURLAssessment(data) {
        const container =
            $("urlAssessment");

        if (!container) {
            return;
        }

        const result =
            data.lockLensURLRisk;

        if (!result) {
            container.innerHTML =
                emptyState(
                    "No URL assessment available."
                );

            return;
        }

        const checks =
            result.checks || {};

        const signals = [];

        if (checks.https === false) {
            signals.push(
                "HTTPS is not detected."
            );
        }

        if (checks.ipAddress) {
            signals.push(
                "The URL uses an IP address."
            );
        }

        if (checks.manySubdomains) {
            signals.push(
                "Many subdomains were detected."
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

        container.innerHTML = `
            <div class="assessment-header">

                <strong>
                    ${Math.round(
                        Number(result.score || 0)
                    )}
                </strong>

                <span class="risk-badge ${getRiskClass(result.level)}">
                    ${escapeHTML(
                        result.level || "Low"
                    )}
                </span>

            </div>

            ${
                signals.length > 0
                    ? `
                        <ul class="assessment-list">
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
                        <p>
                            No obvious structural URL risk signals were detected.
                        </p>
                    `
            }
        `;
    }

    /* =========================================================
       EMAIL ASSESSMENT
       ========================================================= */

    function renderEmailAssessment(data) {
        const container =
            $("emailAssessment");

        if (!container) {
            return;
        }

        const result =
            data.lockLensEmailRisk;

        if (!result) {
            container.innerHTML =
                emptyState(
                    "No email header analysis available."
                );

            return;
        }

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

        container.innerHTML = `
            <div class="assessment-header">

                <strong>
                    ${Math.round(
                        Number(result.score || 0)
                    )}
                </strong>

                <span class="risk-badge ${getRiskClass(result.level)}">
                    ${escapeHTML(
                        result.level || "Low"
                    )}
                </span>

            </div>

            ${
                checks.length > 0
                    ? `
                        <ul class="assessment-list">
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
                        <p>
                            No major email authentication signals were detected.
                        </p>
                    `
            }

            <p class="privacy-note">
                Raw email headers are not stored by LockLens.
            </p>
        `;
    }

    /* =========================================================
       RECOMMENDATIONS
       ========================================================= */

    function renderRecommendations(data) {
        const container =
            $("recommendations");

        if (!container) {
            return;
        }

        const result =
            data.lockLensRecommendations;

        if (!result) {
            container.innerHTML =
                emptyState(
                    "Recommendations will appear after analysis."
                );

            return;
        }

        const recommendations =
            Array.isArray(
                result.recommendations
            )
                ? result.recommendations
                : [];

        if (recommendations.length === 0) {
            container.innerHTML =
                emptyState(
                    "No additional recommendations were generated."
                );

            return;
        }

        container.innerHTML =
            recommendations
                .map(
                    (recommendation) => {
                        const title =
                            typeof recommendation === "string"
                                ? "Recommendation"
                                : recommendation.title ||
                                  recommendation.name ||
                                  "Recommendation";

                        const description =
                            typeof recommendation === "string"
                                ? recommendation
                                : recommendation.description ||
                                  recommendation.message ||
                                  "";

                        return `
                            <div class="recommendation-card">

                                <h3>
                                    ${escapeHTML(title)}
                                </h3>

                                <p>
                                    ${escapeHTML(description)}
                                </p>

                            </div>
                        `;
                    }
                )
                .join("");
    }

    /* =========================================================
       TIMELINE
       ========================================================= */

    function renderTimeline(data) {
        const container =
            $("timeline");

        if (!container) {
            return;
        }

        let events =
            Array.isArray(
                data.lockLensExposureEvents
            )
                ? data.lockLensExposureEvents
                : [];

        /*
         * Backward compatibility with the
         * previous exposureTimeline format.
         */

        if (
            events.length === 0 &&
            data.exposureTimeline
        ) {
            const timeline =
                data.exposureTimeline;

            events =
                Object.entries(timeline)
                    .map(
                        ([date, value]) => ({
                            timestamp:
                                new Date(date)
                                    .getTime(),

                            categories:
                                Object.keys(
                                    value?.categories ||
                                    {}
                                ),

                            riskScore:
                                Array.isArray(
                                    value?.riskScores
                                ) &&
                                value.riskScores.length
                                    ? value.riskScores[
                                        value.riskScores.length - 1
                                    ]
                                    : 0
                        })
                    )
                    .sort(
                        (a, b) =>
                            b.timestamp -
                            a.timestamp
                    );
        }

        if (events.length === 0) {
            container.innerHTML =
                emptyState(
                    "No exposure timeline events recorded yet."
                );

            return;
        }

        container.innerHTML =
            events
                .slice(0, 20)
                .map((event) => {
                    const categories =
                        Array.isArray(
                            event.categories
                        )
                            ? event.categories
                            : [];

                    return `
                        <div class="timeline-item">

                            <div class="timeline-date">
                                ${escapeHTML(
                                    formatDate(
                                        event.timestamp
                                    )
                                )}
                            </div>

                            <div class="timeline-risk">
                                Risk:
                                ${Math.round(
                                    Number(
                                        event.riskScore ||
                                        0
                                    )
                                )}
                            </div>

                            ${
                                categories.length > 0
                                    ? `
                                        <div class="category-pills">
                                            ${categories
                                                .map(
                                                    (category) => `
                                                        <span class="category-pill">
                                                            ${escapeHTML(
                                                                category
                                                            )}
                                                        </span>
                                                    `
                                                )
                                                .join("")}
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
       PRIVACY GUARD
       ========================================================= */

    function renderPrivacyGuard(data) {
        const container =
            $("privacyGuard");

        if (!container) {
            return;
        }

        const guard =
            data.lockLensGuardLastResult;

        const enabled =
            data.privacyGuardEnabled !== false;

        const level =
            guard?.level ||
            "Low";

        const categories =
            Array.isArray(
                guard?.categories
            )
                ? guard.categories
                : [];

        container.innerHTML = `
            <div class="guard-status">

                <span class="risk-badge ${
                    enabled
                        ? "low"
                        : "medium"
                }">
                    ${
                        enabled
                            ? "Active"
                            : "Disabled"
                    }
                </span>

                <span>
                    Privacy Guard
                </span>

            </div>

            <p>
                Last detected level:
                <strong>
                    ${escapeHTML(level)}
                </strong>
            </p>

            ${
                categories.length > 0
                    ? `
                        <div class="category-pills">
                            ${categories
                                .map(
                                    (category) => `
                                        <span class="category-pill">
                                            ${escapeHTML(
                                                category
                                            )}
                                        </span>
                                    `
                                )
                                .join("")}
                        </div>
                    `
                    : `
                        <p>
                            No recent sensitive form categories detected.
                        </p>
                    `
            }
        `;
    }

    /* =========================================================
       PRIVACY DECISION PATH
       ========================================================= */

    function renderDecisionPath(data) {
        const container =
            $("dashboardDecisionPath");

        if (!container) {
            return;
        }

        const decision =
            data.lockLensPrivacyDecision;

        if (!decision) {
            container.innerHTML =
                emptyState(
                    "Analyze a page from the LockLens popup to generate the Privacy Decision Path."
                );

            return;
        }

        const path =
            Array.isArray(
                decision.path
            )
                ? decision.path
                : [];

        if (path.length === 0) {
            container.innerHTML =
                emptyState(
                    "No decision-path steps are currently available."
                );

            return;
        }

        const overallRisk =
            decision.risk || {};

        const categories =
            Array.isArray(
                decision.categories
            )
                ? decision.categories
                : [];

        const groups =
            Array.isArray(
                decision.groups
            )
                ? decision.groups
                : [];

        container.innerHTML = `

            <div class="decision-overview">

                <div class="decision-overview-card">

                    <span>
                        Overall Risk
                    </span>

                    <strong class="risk-badge ${getRiskClass(
                        overallRisk.level
                    )}">
                        ${escapeHTML(
                            overallRisk.level ||
                            "Low"
                        )}
                    </strong>

                    <b>
                        ${Math.round(
                            Number(
                                overallRisk.score ||
                                0
                            )
                        )}
                    </b>

                </div>

                <div class="decision-overview-card">

                    <span>
                        Categories
                    </span>

                    <b>
                        ${categories.length}
                    </b>

                </div>

                <div class="decision-overview-card">

                    <span>
                        Privacy Domains
                    </span>

                    <b>
                        ${groups.length}
                    </b>

                </div>

            </div>

            <div class="dashboard-decision-flow">

                ${path
                    .map(
                        (step, index) => {
                            const title =
                                step.title ||
                                step.name ||
                                `Step ${index + 1}`;

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

                            const stepCategories =
                                Array.isArray(
                                    step.categories
                                )
                                    ? step.categories
                                    : [];

                            return `
                                <div class="dashboard-decision-card">

                                    <div class="dashboard-decision-number">
                                        ${index + 1}
                                    </div>

                                    <div class="dashboard-decision-content">

                                        <h3>
                                            ${escapeHTML(
                                                title
                                            )}
                                        </h3>

                                        ${
                                            question
                                                ? `
                                                    <div class="dashboard-decision-question">
                                                        ${escapeHTML(
                                                            question
                                                        )}
                                                    </div>
                                                `
                                                : ""
                                        }

                                        ${
                                            answer
                                                ? `
                                                    <p>
                                                        ${escapeHTML(
                                                            answer
                                                        )}
                                                    </p>
                                                `
                                                : ""
                                        }

                                        ${
                                            stepCategories.length > 0
                                                ? `
                                                    <div class="category-pills">
                                                        ${stepCategories
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
                                                : ""
                                        }

                                        ${
                                            status
                                                ? `
                                                    <div class="dashboard-decision-status">
                                                        ${escapeHTML(
                                                            status
                                                        )}
                                                    </div>
                                                `
                                                : ""
                                        }

                                    </div>

                                </div>
                            `;
                        }
                    )
                    .join("")}

            </div>

            <div class="decision-guidance">

                <strong>
                    How to use this path
                </strong>

                <p>
                    LockLens presents the detected privacy
                    signals and questions to consider. The
                    final privacy decision remains with the user.
                </p>

            </div>
        `;
    }

    /* =========================================================
       PRIVACY ARCHITECTURE
       ========================================================= */

    function renderPrivacyArchitecture() {
        const container =
            $("privacyArchitecture");

        if (!container) {
            return;
        }

        container.innerHTML = `
            <div class="architecture-flow">

                <div class="architecture-step">
                    <strong>1</strong>
                    <span>Browser</span>
                </div>

                <div class="architecture-arrow">
                    →
                </div>

                <div class="architecture-step">
                    <strong>2</strong>
                    <span>Local Scanner</span>
                </div>

                <div class="architecture-arrow">
                    →
                </div>

                <div class="architecture-step">
                    <strong>3</strong>
                    <span>Risk Engine</span>
                </div>

                <div class="architecture-arrow">
                    →
                </div>

                <div class="architecture-step">
                    <strong>4</strong>
                    <span>Local Dashboard</span>
                </div>

            </div>

            <p class="privacy-note">
                LockLens is designed to perform core privacy
                analysis locally in the browser. Raw personal
                information is not intentionally stored.
            </p>
        `;
    }

    /* =========================================================
       LOCAL DATA
       ========================================================= */

    function renderLocalDataInfo(data) {
        const container =
            $("localData");

        if (!container) {
            return;
        }

        const findings =
            Array.isArray(
                data.lockLensFindings
            )
                ? data.lockLensFindings.length
                : 0;

        const events =
            Array.isArray(
                data.lockLensExposureEvents
            )
                ? data.lockLensExposureEvents.length
                : 0;

        container.innerHTML = `
            <div class="local-data-stat">
                <strong>
                    ${findings}
                </strong>
                <span>
                    Current findings
                </span>
            </div>

            <div class="local-data-stat">
                <strong>
                    ${events}
                </strong>
                <span>
                    Timeline events
                </span>
            </div>

            <p class="privacy-note">
                LockLens stores analysis metadata locally
                for the prototype dashboard.
            </p>
        `;
    }

    /* =========================================================
       CLEAR LOCAL DATA
       ========================================================= */

    async function clearLocalData() {
        const confirmed =
            window.confirm(
                "Clear LockLens local analysis data?"
            );

        if (!confirmed) {
            return;
        }

        try {
            await new Promise(
                (resolve, reject) => {
                    chrome.storage.local.clear(
                        () => {
                            if (
                                chrome.runtime?.lastError
                            ) {
                                reject(
                                    new Error(
                                        chrome.runtime.lastError
                                            .message
                                    )
                                );

                                return;
                            }

                            resolve();
                        }
                    );
                }
            );

            window.location.reload();

        } catch (error) {
            console.error(
                "Unable to clear LockLens data:",
                error
            );

            window.alert(
                "Unable to clear local data."
            );
        }
    }

    /* =========================================================
       NAVIGATION
       ========================================================= */

    function initializeNavigation() {
        const navItems =
            document.querySelectorAll(
                "[data-section]"
            );

        navItems.forEach(
            (item) => {
                item.addEventListener(
                    "click",
                    () => {
                        const sectionId =
                            item.getAttribute(
                                "data-section"
                            );

                        if (!sectionId) {
                            return;
                        }

                        const target =
                            document.getElementById(
                                sectionId
                            );

                        if (target) {
                            target.scrollIntoView({
                                behavior:
                                    "smooth",
                                block:
                                    "start"
                            });
                        }

                        navItems.forEach(
                            (nav) =>
                                nav.classList.remove(
                                    "active"
                                )
                        );

                        item.classList.add(
                            "active"
                        );
                    }
                );
            }
        );
    }

    /* =========================================================
       BUTTONS
       ========================================================= */

    function initializeButtons() {
        const clearButton =
            $("clearLocalData");

        if (clearButton) {
            clearButton.addEventListener(
                "click",
                clearLocalData
            );
        }

        const refreshButton =
            $("refreshDashboard");

        if (refreshButton) {
            refreshButton.addEventListener(
                "click",
                refreshDashboard
            );
        }
    }

    /* =========================================================
       DASHBOARD REFRESH
       ========================================================= */

    async function refreshDashboard() {
        const data =
            await getStorage(
                STORAGE_KEYS
            );

        renderOverview(data);
        renderNutritionLabel(data);
        renderCategoryIntelligence(data);
        renderRiskSources(data);
        renderExplanation(data);
        renderCategories(data);
        renderURLAssessment(data);
        renderEmailAssessment(data);
        renderRecommendations(data);
        renderTimeline(data);
        renderPrivacyGuard(data);
        renderDecisionPath(data);
        renderPrivacyArchitecture();
        renderLocalDataInfo(data);

        return data;
    }

    /* =========================================================
       INITIALIZATION
       ========================================================= */

    async function initializeDashboard() {
        try {
            initializeNavigation();
            initializeButtons();

            await refreshDashboard();

        } catch (error) {
            console.error(
                "LockLens dashboard initialization failed:",
                error
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
            initializeDashboard
        );
    } else {
        initializeDashboard();
    }

})();
