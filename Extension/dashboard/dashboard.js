// ============================================================
// LockLens - Privacy Command Center
// Dashboard Controller 2.0
// ============================================================
//
// Reads ONLY local LockLens metadata.
//
// Never displays or retrieves:
// - typed personal values
// - passwords
// - URLs
// - domains
// - page content
//
// ============================================================

(() => {

    "use strict";


    // ========================================================
    // CONSTANTS
    // ========================================================

    const CATEGORY_INFO = {

        name: {
            label: "Name",
            icon: "👤",
            points: 5
        },

        email: {
            label: "Email",
            icon: "📧",
            points: 10
        },

        phone: {
            label: "Phone",
            icon: "📱",
            points: 15
        },

        address: {
            label: "Address",
            icon: "🏠",
            points: 20
        },

        date: {
            label: "Personal Date",
            icon: "🎂",
            points: 10
        },

        password: {
            label: "Password",
            icon: "🔑",
            points: 10
        },

        payment: {
            label: "Payment",
            icon: "💳",
            points: 20
        },

        government_id: {
            label: "Government ID",
            icon: "🪪",
            points: 25
        },

        location: {
            label: "Location",
            icon: "📍",
            points: 15
        },

        username: {
            label: "Username",
            icon: "🌐",
            points: 5
        }

    };


    // ========================================================
    // HELPER
    // ========================================================

    const $ = (id) =>
        document.getElementById(id);


    function safeText(value) {

        if (
            value === null ||
            value === undefined
        ) {

            return "";

        }

        return String(value);

    }


    function clampScore(score) {

        const number =
            Number(score);

        if (
            !Number.isFinite(number)
        ) {

            return 0;

        }

        return Math.max(
            0,
            Math.min(
                100,
                number
            )
        );

    }


    function formatTime(timestamp) {

        if (!timestamp) {

            return "--:--";

        }


        const date =
            new Date(timestamp);


        if (
            Number.isNaN(
                date.getTime()
            )
        ) {

            return "--:--";

        }


        return date.toLocaleTimeString(
            [],
            {
                hour: "2-digit",
                minute: "2-digit"
            }
        );

    }


    function formatDateTime(timestamp) {

        if (!timestamp) {

            return "No scan yet";

        }


        const date =
            new Date(timestamp);


        if (
            Number.isNaN(
                date.getTime()
            )
        ) {

            return "No scan yet";

        }


        return date.toLocaleString(
            [],
            {
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit"
            }
        );

    }


    function getRiskClass(level) {

        return safeText(level)
            .toLowerCase()
            .replace(/\s+/g, "-");

    }


    function getRiskMessage(
        score,
        level
    ) {

        if (level === "Critical") {

            return "Multiple or highly sensitive privacy signals were detected. Review the request carefully before proceeding.";

        }

        if (level === "High") {

            return "Several privacy-sensitive signals were detected. Review which information is actually necessary.";

        }

        if (level === "Medium") {

            return "Some privacy-related information was detected. Consider whether each requested category is necessary.";

        }

        if (level === "Low") {

            return "The detected exposure is currently low. Continue practicing data minimization.";

        }

        return "Start scanning pages to build your privacy exposure profile.";

    }


    // ========================================================
    // LOAD STORAGE
    // ========================================================

    async function loadStorage() {

        return await chrome.storage.local.get(
            [
                "lockLensFindings",
                "lockLensRisk",
                "lockLensRecommendations",
                "lockLensLastScan",
                "lockLensExposureEvents",
                "privacyGuardEnabled",
                "lockLensGuardLastResult",

                // Legacy timeline support.
                "exposureTimeline"
            ]
        );

    }


    // ========================================================
    // RENDER RISK
    // ========================================================

    function renderRisk(
        risk,
        lastScan
    ) {

        const score =
            clampScore(
                risk?.score
            );


        const level =
            safeText(
                risk?.level
            ) || "Not analyzed";


        $("score").textContent =
            score;


        $("riskLevel").textContent =
            level;


        $("riskExplanation").textContent =
            risk?.explanation ||
            getRiskMessage(
                score,
                level
            );


        $("lastScan").textContent =
            lastScan
                ? formatDateTime(lastScan)
                : "No scan yet";


        requestAnimationFrame(
            () => {

                $("riskRing")
                    .style
                    .setProperty(
                        "--progress",
                        score
                    );

            }
        );

    }


    // ========================================================
    // RENDER CURRENT FINDINGS
    // ========================================================

    function renderFindings(
        findings
    ) {

        const container =
            $("findings");


        container.replaceChildren();


        if (
            !Array.isArray(findings) ||
            findings.length === 0
        ) {

            const empty =
                document.createElement("div");

            empty.className =
                "empty";

            empty.textContent =
                "No supported privacy exposure categories detected in the latest scan.";

            container.appendChild(
                empty
            );

            return;

        }


        findings.forEach(
            (finding, index) => {

                const category =
                    safeText(
                        finding.category
                    );


                const info =
                    CATEGORY_INFO[category] ||
                    {
                        label: category || "Unknown category",
                        icon: "🔎",
                        points: 0
                    };


                const card =
                    document.createElement(
                        "article"
                    );

                card.className =
                    "finding-card";


                card.style.animationDelay =
                    `${index * 50}ms`;


                const icon =
                    document.createElement(
                        "div"
                    );

                icon.className =
                    "finding-icon";

                icon.textContent =
                    info.icon;


                const title =
                    document.createElement(
                        "h3"
                    );

                title.textContent =
                    info.label;


                const description =
                    document.createElement(
                        "p"
                    );

                description.textContent =
                    safeText(
                        finding.description
                    ) ||
                    `LockLens detected a ${info.label.toLowerCase()} privacy signal.`;


                const score =
                    document.createElement(
                        "span"
                    );

                score.className =
                    "finding-score";

                score.textContent =
                    `Risk weight +${info.points}`;


                card.append(
                    icon,
                    title,
                    description,
                    score
                );


                container.appendChild(
                    card
                );

            }
        );

    }


    // ========================================================
    // RENDER PRIVACY GUARD
    // ========================================================

    function renderGuard(
        enabled,
        result
    ) {

        const status =
            $("dashboardGuardStatus");


        if (enabled) {

            status.textContent =
                "Status: Active";

            status.style.color =
                "var(--green)";

        } else {

            status.textContent =
                "Status: Inactive";

            status.style.color =
                "var(--muted)";

        }


        const assessment =
            $("guardAssessment");


        if (!result) {

            assessment.textContent =
                enabled
                    ? "Privacy Guard is active. No recent page assessment is available."
                    : "Enable Privacy Guard to receive proactive privacy warnings.";

        } else {

            const level =
                safeText(
                    result.level
                );


            const categories =
                Array.isArray(
                    result.categories
                )
                    ? result.categories
                    : [];


            assessment.textContent =
                categories.length > 0
                    ? `${level} information request detected across ${categories.length} privacy categories.`
                    : "No privacy categories detected.";

        }


        const categoryContainer =
            $("guardCategories");


        categoryContainer.replaceChildren();


        const categories =
            Array.isArray(
                result?.categories
            )
                ? result.categories
                : [];


        if (
            categories.length === 0
        ) {

            const empty =
                document.createElement(
                    "span"
                );

            empty.className =
                "muted";

            empty.textContent =
                "No categories detected.";

            categoryContainer.appendChild(
                empty
            );

            return;

        }


        categories.forEach(
            category => {

                const item =
                    document.createElement(
                        "span"
                    );

                item.className =
                    "guard-category";

                item.textContent =
                    safeText(
                        category
                    );

                categoryContainer.appendChild(
                    item
                );

            }
        );

    }


    // ========================================================
    // GET EVENT DATA
    // ========================================================

    function normalizeEvents(
        events
    ) {

        if (
            !Array.isArray(events)
        ) {

            return [];

        }


        return events
            .filter(
                event =>
                    event &&
                    event.timestamp
            )
            .map(
                event => ({

                    id:
                        safeText(
                            event.id
                        ),

                    timestamp:
                        safeText(
                            event.timestamp
                        ),

                    categories:
                        Array.isArray(
                            event.categories
                        )
                            ? event.categories
                            : [],

                    categoryCount:
                        Number(
                            event.categoryCount
                        ) || 0,

                    riskScore:
                        clampScore(
                            event.riskScore
                        ),

                    riskLevel:
                        safeText(
                            event.riskLevel
                        ) || "Low"

                })
            )
            .sort(
                (a, b) =>
                    new Date(
                        b.timestamp
                    ) -
                    new Date(
                        a.timestamp
                    )
            );

    }


    // ========================================================
    // LEGACY TIMELINE CONVERSION
    // ========================================================
    //
    // Allows older LockLens data to continue displaying.
    //
    // ========================================================

    function convertLegacyTimeline(
        timeline
    ) {

        if (
            !timeline ||
            typeof timeline !== "object"
        ) {

            return [];

        }


        const events = [];


        Object.entries(
            timeline
        ).forEach(
            ([date, data]) => {

                if (
                    !data ||
                    typeof data !== "object"
                ) {

                    return;

                }


                const scores =
                    Array.isArray(
                        data.riskScores
                    )
                        ? data.riskScores
                        : [];


                scores.forEach(
                    (score, index) => {

                        const categories =
                            data.categories &&
                            typeof data.categories === "object"
                                ? Object.keys(
                                    data.categories
                                )
                                : [];


                        events.push({

                            id:
                                `legacy-${date}-${index}`,

                            timestamp:
                                `${date}T12:00:00`,

                            categories,

                            categoryCount:
                                categories.length,

                            riskScore:
                                clampScore(
                                    score
                                ),

                            riskLevel:
                                getLevelFromScore(
                                    score
                                )

                        });

                    }
                );

            }
        );


        return events;

    }


    function getLevelFromScore(
        score
    ) {

        const value =
            clampScore(score);


        if (value <= 20) {

            return "Low";

        }

        if (value <= 50) {

            return "Medium";

        }

        if (value <= 75) {

            return "High";

        }

        return "Critical";

    }


    // ========================================================
    // GET TODAY EVENTS
    // ========================================================

    function getTodayEvents(
        events
    ) {

        const now =
            new Date();


        const year =
            now.getFullYear();

        const month =
            now.getMonth();

        const day =
            now.getDate();


        return events.filter(
            event => {

                const date =
                    new Date(
                        event.timestamp
                    );


                return (
                    date.getFullYear() === year &&
                    date.getMonth() === month &&
                    date.getDate() === day
                );

            }
        );

    }


    // ========================================================
    // RENDER TIMELINE
    // ========================================================

    function renderTimeline(
        events
    ) {

        const history =
            $("timelineHistory");


        history.replaceChildren();


        const sorted =
            normalizeEvents(
                events
            );


        const recent =
            sorted.slice(
                0,
                12
            );


        if (
            recent.length === 0
        ) {

            const empty =
                document.createElement(
                    "div"
                );

            empty.className =
                "empty";

            empty.textContent =
                "No privacy activity recorded yet.";

            history.appendChild(
                empty
            );

            return;

        }


        recent.forEach(
            event => {

                const row =
                    document.createElement(
                        "div"
                    );

                row.className =
                    "history-row";


                const time =
                    document.createElement(
                        "span"
                    );

                time.className =
                    "history-time";

                time.textContent =
                    formatTime(
                        event.timestamp
                    );


                const categories =
                    document.createElement(
                        "span"
                    );

                categories.className =
                    "history-categories";


                const labels =
                    event.categories
                        .map(
                            category =>
                                CATEGORY_INFO[
                                    category
                                ]?.label ||
                                category
                        );


                categories.textContent =
                    labels.length
                        ? labels.join(
                            " • "
                        )
                        : "No categories";


                const risk =
                    document.createElement(
                        "span"
                    );

                risk.className =
                    `history-risk risk-${getRiskClass(event.riskLevel)}`;


                risk.textContent =
                    `${event.riskLevel} ${event.riskScore}`;


                row.append(
                    time,
                    categories,
                    risk
                );


                history.appendChild(
                    row
                );

            }
        );

    }


    // ========================================================
    // RENDER TIMELINE STATS
    // ========================================================

    function renderTimelineStats(
        events
    ) {

        const today =
            getTodayEvents(
                events
            );


        const categorySet =
            new Set();


        today.forEach(
            event => {

                event.categories
                    .forEach(
                        category =>
                            categorySet.add(
                                category
                            )
                    );

            }
        );


        const highRisk =
            today.filter(
                event =>
                    event.riskLevel === "High" ||
                    event.riskLevel === "Critical"
            ).length;


        $("pagesAnalyzed").textContent =
            today.length;


        $("categoriesDetected").textContent =
            categorySet.size;


        $("highRiskInteractions").textContent =
            highRisk;


        $("timelineStatus").textContent =
            today.length === 0
                ? "No activity"
                : `${today.length} event${today.length === 1 ? "" : "s"} today`;

    }


    // ========================================================
    // CALCULATE EVENT SUMMARY
    // ========================================================

    function calculateSummary(
        events
    ) {

        const summary = {

            totalEvents:
                events.length,

            highRisk:
                0,

            critical:
                0,

            averageRisk:
                0,

            highestRisk:
                0,

            categories:
                {}

        };


        if (
            events.length === 0
        ) {

            return summary;

        }


        let totalRisk =
            0;


        events.forEach(
            event => {

                const score =
                    clampScore(
                        event.riskScore
                    );


                totalRisk +=
                    score;


                summary.highestRisk =
                    Math.max(
                        summary.highestRisk,
                        score
                    );


                if (
                    event.riskLevel === "High"
                ) {

                    summary.highRisk++;

                }


                if (
                    event.riskLevel === "Critical"
                ) {

                    summary.critical++;

                }


                event.categories
                    .forEach(
                        category => {

                            summary.categories[
                                category
                            ] =
                                (
                                    summary.categories[
                                        category
                                    ] || 0
                                ) + 1;

                        }
                    );

            }
        );


        summary.averageRisk =
            Math.round(
                totalRisk /
                events.length
            );


        return summary;

    }


    // ========================================================
    // RENDER QUICK STATS
    // ========================================================

    function renderQuickStats(
        summary
    ) {

        $("totalEvents").textContent =
            summary.totalEvents;


        $("uniqueCategories").textContent =
            Object.keys(
                summary.categories
            ).length;


        $("highRiskEvents").textContent =
            summary.highRisk +
            summary.critical;


        $("averageRisk").textContent =
            summary.averageRisk;


        $("overviewAverage").textContent =
            `${summary.averageRisk}/100`;


        $("overviewHighest").textContent =
            `${summary.highestRisk}/100`;


        $("overviewHigh").textContent =
            summary.highRisk;


        $("overviewCritical").textContent =
            summary.critical;


        $("riskMessage").textContent =
            summary.totalEvents === 0
                ? "Start scanning pages to build your privacy exposure profile."
                : `LockLens has recorded ${summary.totalEvents} privacy exposure event${summary.totalEvents === 1 ? "" : "s"} locally.`;

    }


    // ========================================================
    // CATEGORY CHART
    // ========================================================

    function renderCategoryChart(
        categoryCounts
    ) {

        const container =
            $("categoryChart");


        container.replaceChildren();


        const entries =
            Object.entries(
                categoryCounts
            )
            .sort(
                ([, a], [, b]) =>
                    b - a
            );


        if (
            entries.length === 0
        ) {

            const empty =
                document.createElement(
                    "div"
                );

            empty.className =
                "empty";

            empty.textContent =
                "Exposure analytics will appear after your first scan.";

            container.appendChild(
                empty
            );

            return;

        }


        const max =
            Math.max(
                ...entries.map(
                    ([, count]) =>
                        count
                )
            );


        entries.forEach(
            ([category, count]) => {

                const row =
                    document.createElement(
                        "div"
                    );

                row.className =
                    "category-row";


                const name =
                    document.createElement(
                        "span"
                    );

                name.className =
                    "category-name";

                name.textContent =
                    CATEGORY_INFO[
                        category
                    ]?.label ||
                    category;


                const track =
                    document.createElement(
                        "div"
                    );

                track.className =
                    "bar-track";


                const fill =
                    document.createElement(
                        "div"
                    );

                fill.className =
                    "bar-fill";


                const percentage =
                    Math.max(
                        5,
                        Math.round(
                            count /
                            max *
                            100
                        )
                    );


                fill.style.width =
                    `${percentage}%`;


                track.appendChild(
                    fill
                );


                const number =
                    document.createElement(
                        "span"
                    );

                number.className =
                    "category-number";

                number.textContent =
                    count;


                row.append(
                    name,
                    track,
                    number
                );


                container.appendChild(
                    row
                );

            }
        );

    }


    // ========================================================
    // RECOMMENDATIONS
    // ========================================================

    function renderRecommendations(
        recommendationResult
    ) {

        const container =
            $("recommendations");


        container.replaceChildren();


        const recommendations =
            Array.isArray(
                recommendationResult?.recommendations
            )
                ? recommendationResult.recommendations
                : [];


        $("recommendationSummary").textContent =
            recommendations.length === 0
                ? "No recommendations available yet."
                : `${recommendations.length} explainable recommendation${recommendations.length === 1 ? "" : "s"} generated from your privacy signals.`;


        if (
            recommendations.length === 0
        ) {

            const empty =
                document.createElement(
                    "div"
                );

            empty.className =
                "empty";

            empty.textContent =
                "Analyze a page to receive privacy recommendations.";

            container.appendChild(
                empty
            );

            return;

        }


        recommendations
            .slice(
                0,
                8
            )
            .forEach(
                recommendation => {

                    const card =
                        document.createElement(
                            "article"
                        );

                    const priority =
                        Number(
                            recommendation.priority
                        ) || 1;


                    card.className =
                        `recommendation-card priority-${priority}`;


                    const title =
                        document.createElement(
                            "h3"
                        );

                    title.className =
                        "recommendation-title";

                    title.textContent =
                        safeText(
                            recommendation.title
                        );


                    const reason =
                        document.createElement(
                            "p"
                        );

                    reason.className =
                        "recommendation-reason";

                    reason.textContent =
                        safeText(
                            recommendation.reason
                        );


                    const text =
                        document.createElement(
                            "p"
                        );

                    text.className =
                        "recommendation-text";

                    text.textContent =
                        safeText(
                            recommendation.recommendation
                        );


                    card.append(
                        title,
                        reason,
                        text
                    );


                    container.appendChild(
                        card
                    );

                }
            );

    }


    // ========================================================
    // CLEAR LOCAL DATA
    // ========================================================

    async function clearLocalData() {

        const confirmed =
            window.confirm(
                "Clear LockLens local scan results, recommendations and exposure activity?"
            );


        if (!confirmed) {

            return;

        }


        await chrome.storage.local.remove(
            [
                "lockLensFindings",
                "lockLensRisk",
                "lockLensRecommendations",
                "lockLensLastScan",
                "lockLensExposureEvents",
                "exposureTimeline",
                "lockLensGuardLastResult"
            ]
        );


        window.location.reload();

    }


    // ========================================================
    // MAIN RENDER
    // ========================================================

    async function renderDashboard() {

        try {

            const data =
                await loadStorage();


            // ----------------------------------------------
            // Current scan
            // ----------------------------------------------

            const findings =
                Array.isArray(
                    data.lockLensFindings
                )
                    ? data.lockLensFindings
                    : [];


            const risk =
                data.lockLensRisk &&
                typeof data.lockLensRisk === "object"
                    ? data.lockLensRisk
                    : {};


            const lastScan =
                data.lockLensLastScan ||
                null;


            renderRisk(
                risk,
                lastScan
            );


            renderFindings(
                findings
            );


            // ----------------------------------------------
            // Privacy Guard
            // ----------------------------------------------

            renderGuard(
                data.privacyGuardEnabled !== false,
                data.lockLensGuardLastResult
            );


            // ----------------------------------------------
            // Timeline
            // ----------------------------------------------

            let events =
                normalizeEvents(
                    data.lockLensExposureEvents
                );


            // If there are no new events,
            // display old timeline data.

            if (
                events.length === 0
            ) {

                events =
                    convertLegacyTimeline(
                        data.exposureTimeline
                    );

            }


            const summary =
                calculateSummary(
                    events
                );


            renderQuickStats(
                summary
            );


            renderTimelineStats(
                events
            );


            renderTimeline(
                events
            );


            renderCategoryChart(
                summary.categories
            );


            // ----------------------------------------------
            // Recommendations
            // ----------------------------------------------

            renderRecommendations(
                data.lockLensRecommendations
            );


        } catch (error) {

            console.error(
                "LockLens dashboard error:",
                error
            );

        }

    }


    // ========================================================
    // INITIALIZE
    // ========================================================

    document.addEventListener(
        "DOMContentLoaded",
        async () => {

            $("clearDataButton")
                ?.addEventListener(
                    "click",
                    clearLocalData
                );


            await renderDashboard();


            // Update dashboard automatically whenever
            // LockLens local storage changes.

            chrome.storage.local.onChanged.addListener(
                async (
                    changes,
                    areaName
                ) => {

                    if (
                        areaName !== "local"
                    ) {

                        return;

                    }


                    const relevantKeys = [

                        "lockLensFindings",

                        "lockLensRisk",

                        "lockLensRecommendations",

                        "lockLensLastScan",

                        "lockLensExposureEvents",

                        "exposureTimeline",

                        "privacyGuardEnabled",

                        "lockLensGuardLastResult"

                    ];


                    const changed =
                        relevantKeys.some(
                            key =>
                                Boolean(
                                    changes[key]
                                )
                        );


                    if (changed) {

                        await renderDashboard();

                    }

                }
            );

        }
    );

})();
