(function () {
    "use strict";

    const VERSION = "2.0.0-prototype";

    const CATEGORY_WEIGHTS = {
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

    const SOURCE_WEIGHTS = {
        page: 0.50,
        url: 0.25,
        email: 0.25
    };

    function getRiskLevel(score) {
        if (score <= 20) {
            return "Low";
        }

        if (score <= 50) {
            return "Medium";
        }

        if (score <= 75) {
            return "High";
        }

        return "Critical";
    }

    function normalizeCategory(category) {
        return String(category || "")
            .trim()
            .toLowerCase()
            .replace(/\s+/g, "_");
    }

    function calculatePageRisk(findings) {
        const categories = new Set();

        let score = 0;

        for (const finding of findings || []) {
            const category =
                normalizeCategory(
                    finding?.category
                );

            if (!category) {
                continue;
            }

            categories.add(category);

            if (
                Object.prototype.hasOwnProperty.call(
                    CATEGORY_WEIGHTS,
                    category
                )
            ) {
                score += CATEGORY_WEIGHTS[category];
            }
        }

        if (
            categories.size >= 2 &&
            categories.size <= 3
        ) {
            score += 5;
        }

        if (categories.size >= 4) {
            score += 10;
        }

        score = Math.min(score, 100);

        return {
            score,
            level: getRiskLevel(score),
            categories: Array.from(categories),
            findingCount: (findings || []).length
        };
    }

    function normalizeExternalRisk(result) {
        if (!result) {
            return {
                score: 0,
                level: "Low",
                available: false
            };
        }

        const score = Math.max(
            0,
            Math.min(
                100,
                Number(result.score || 0)
            )
        );

        return {
            score,
            level:
                result.level ||
                getRiskLevel(score),
            available: true
        };
    }

    function calculateUnifiedRisk({
        findings = [],
        urlRisk = null,
        emailRisk = null
    } = {}) {

        const pageRisk =
            calculatePageRisk(findings);

        const normalizedURL =
            normalizeExternalRisk(urlRisk);

        const normalizedEmail =
            normalizeExternalRisk(emailRisk);

        /*
         * Only include available sources
         * in the weighted calculation.
         */

        const sources = [];

        sources.push({
            name: "Page Privacy",
            key: "page",
            score: pageRisk.score,
            weight: SOURCE_WEIGHTS.page
        });

        if (normalizedURL.available) {
            sources.push({
                name: "URL Risk",
                key: "url",
                score: normalizedURL.score,
                weight: SOURCE_WEIGHTS.url
            });
        }

        if (normalizedEmail.available) {
            sources.push({
                name: "Email Risk",
                key: "email",
                score: normalizedEmail.score,
                weight: SOURCE_WEIGHTS.email
            });
        }

        /*
         * Re-normalize weights when a source is unavailable.
         */

        const totalWeight =
            sources.reduce(
                (sum, source) =>
                    sum + source.weight,
                0
            );

        let weightedScore = 0;

        for (const source of sources) {
            const normalizedWeight =
                source.weight /
                totalWeight;

            weightedScore +=
                source.score *
                normalizedWeight;
        }

        /*
         * Additional cross-source context.
         *
         * If multiple independent sources
         * indicate elevated risk, add a
         * small correlation bonus.
         */

        let correlationBonus = 0;

        const elevatedSources =
            sources.filter(
                source =>
                    source.score >= 51
            ).length;

        if (elevatedSources >= 2) {
            correlationBonus = 10;
        }

        let overallScore =
            Math.round(
                weightedScore +
                correlationBonus
            );

        overallScore =
            Math.min(
                overallScore,
                100
            );

        const level =
            getRiskLevel(
                overallScore
            );

        return {
            version: VERSION,

            score: overallScore,

            level,

            sources: {
                page: {
                    score:
                        pageRisk.score,
                    level:
                        pageRisk.level,
                    available: true
                },

                url: {
                    score:
                        normalizedURL.score,
                    level:
                        normalizedURL.level,
                    available:
                        normalizedURL.available
                },

                email: {
                    score:
                        normalizedEmail.score,
                    level:
                        normalizedEmail.level,
                    available:
                        normalizedEmail.available
                }
            },

            categories:
                pageRisk.categories,

            findingCount:
                pageRisk.findingCount,

            correlationBonus,

            generatedLocally: true,

            timestamp: Date.now()
        };
    }

    function calculateRisk(findings) {
        return calculatePageRisk(findings);
    }

    window.LockLensRiskEngine = {
        version: VERSION,

        calculateRisk,

        calculatePageRisk,

        calculateUnifiedRisk,

        getRiskLevel
    };
})();