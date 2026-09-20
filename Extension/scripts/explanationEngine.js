(() => {
    "use strict";

    const VERSION = "1.0.0-prototype";

    const CATEGORY_EXPLANATIONS = {
        name: {
            title: "Name information",
            explanation:
                "The page appears to request or expose name-related information.",
            action:
                "Only provide your name when it is necessary for the purpose of the website."
        },

        email: {
            title: "Email address",
            explanation:
                "The page appears to request or expose an email address.",
            action:
                "Check why the website needs your email and avoid providing it to unfamiliar services."
        },

        phone: {
            title: "Phone number",
            explanation:
                "The page appears to request or expose phone-number information.",
            action:
                "Provide a phone number only when necessary and when you trust the website."
        },

        address: {
            title: "Address information",
            explanation:
                "The page appears to request or expose address-related information.",
            action:
                "Avoid sharing detailed address information unless it is required for a legitimate purpose."
        },

        date: {
            title: "Personal date",
            explanation:
                "The page appears to request or expose date-related personal information.",
            action:
                "Check whether the date is genuinely necessary before providing it."
        },

        password: {
            title: "Password field",
            explanation:
                "The page contains a password input field.",
            action:
                "Only enter passwords on websites you trust and verify that the connection is secure."
        },

        payment: {
            title: "Payment information",
            explanation:
                "The page appears to contain a payment-information field.",
            action:
                "Verify the website and connection before entering payment information."
        },

        government_id: {
            title: "Government identification",
            explanation:
                "The page appears to request government-identification information.",
            action:
                "Provide identification information only when required by a trusted and legitimate service."
        },

        location: {
            title: "Location information",
            explanation:
                "The page appears to request or expose location-related information.",
            action:
                "Review why location information is needed and limit access where possible."
        },

        username: {
            title: "Username",
            explanation:
                "The page appears to request username information.",
            action:
                "Avoid reusing usernames across services when doing so could reveal additional information about you."
        }
    };

    function generateExplanation(
        findings,
        risk,
        urlRisk
    ) {
        const safeFindings =
            Array.isArray(findings)
                ? findings
                : [];

        const categories =
            extractCategories(
                safeFindings
            );

        const score =
            Number(risk?.score) || 0;

        const level =
            risk?.level ||
            getRiskLevel(score);

        const reasons =
            buildReasons(
                categories,
                score,
                level,
                urlRisk
            );

        const actions =
            buildActions(
                categories,
                level,
                urlRisk
            );

        const categoryDetails =
            categories.map(
                buildCategoryDetail
            );

        return {
            version: VERSION,

            score,

            level,

            categories,

            summary:
                buildSummary(
                    categories,
                    score,
                    level,
                    urlRisk
                ),

            reasons,

            actions,

            categoryDetails,

            generatedLocally: true
        };
    }

    function extractCategories(
        findings
    ) {
        const categorySet =
            new Set();

        findings.forEach(
            (finding) => {
                if (!finding) {
                    return;
                }

                const category =
                    String(
                        finding.category || ""
                    )
                        .trim()
                        .toLowerCase();

                if (category) {
                    categorySet.add(
                        category
                    );
                }
            }
        );

        return Array.from(
            categorySet
        );
    }

    function buildReasons(
        categories,
        score,
        level,
        urlRisk
    ) {
        const reasons = [];

        if (categories.length > 0) {
            reasons.push(
                `LockLens detected ${categories.length} type${
                    categories.length === 1
                        ? ""
                        : "s"
                } of potentially sensitive information.`
            );
        }

        if (score >= 76) {
            reasons.push(
                "The combined exposure signals produce a very high risk score."
            );
        } else if (score >= 51) {
            reasons.push(
                "Several exposure signals combine to create a high privacy risk."
            );
        } else if (score >= 21) {
            reasons.push(
                "The detected information creates a moderate privacy exposure."
            );
        } else {
            reasons.push(
                "Only limited exposure signals were detected."
            );
        }

        if (
            categories.includes(
                "password"
            )
        ) {
            reasons.push(
                "A password field is present on the page."
            );
        }

        if (
            categories.includes(
                "government_id"
            )
        ) {
            reasons.push(
                "Government-identification information appears to be requested."
            );
        }

        if (
            categories.includes(
                "payment"
            )
        ) {
            reasons.push(
                "Payment-related information appears to be requested."
            );
        }

        if (
            urlRisk &&
            typeof urlRisk.score ===
                "number" &&
            urlRisk.score >= 21
        ) {
            reasons.push(
                "The URL also contains structural warning signals."
            );
        }

        return reasons;
    }

    function buildActions(
        categories,
        level,
        urlRisk
    ) {
        const actions = [];

        if (
            level === "High" ||
            level === "Critical"
        ) {
            actions.push(
                "Review the page carefully before providing sensitive information."
            );
        }

        if (
            categories.includes(
                "password"
            )
        ) {
            actions.push(
                "Verify the website address and HTTPS connection before entering a password."
            );
        }

        if (
            categories.includes(
                "payment"
            )
        ) {
            actions.push(
                "Confirm that the website is trusted before entering payment information."
            );
        }

        if (
            categories.includes(
                "government_id"
            )
        ) {
            actions.push(
                "Confirm that the service genuinely requires identification information."
            );
        }

        if (
            categories.includes(
                "email"
            ) ||
            categories.includes(
                "phone"
            )
        ) {
            actions.push(
                "Consider whether sharing contact information is necessary."
            );
        }

        if (
            categories.includes(
                "address"
            )
        ) {
            actions.push(
                "Avoid sharing detailed address information unless required."
            );
        }

        if (
            urlRisk &&
            typeof urlRisk.score ===
                "number" &&
            urlRisk.score >= 21
        ) {
            actions.push(
                "Review the URL warning indicators before continuing."
            );
        }

        if (actions.length === 0) {
            actions.push(
                "Continue to follow normal privacy and security practices."
            );
        }

        return unique(
            actions
        );
    }

    function buildCategoryDetail(
        category
    ) {
        const information =
            CATEGORY_EXPLANATIONS[
                category
            ];

        if (information) {
            return {
                category,
                title:
                    information.title,
                explanation:
                    information.explanation,
                action:
                    information.action
            };
        }

        return {
            category,

            title:
                formatCategory(
                    category
                ),

            explanation:
                "LockLens detected a privacy-related signal in this category.",

            action:
                "Review whether this information is necessary before providing it."
        };
    }

    function buildSummary(
        categories,
        score,
        level,
        urlRisk
    ) {
        let summary =
            `LockLens assessed this page as ${level} risk with a privacy score of ${score}/100.`;

        if (
            categories.length > 0
        ) {
            summary +=
                ` ${categories.length} sensitive information categor${
                    categories.length === 1
                        ? "y"
                        : "ies"
                } contributed to the assessment.`;
        }

        if (
            urlRisk &&
            typeof urlRisk.score ===
                "number"
        ) {
            summary +=
                ` The URL received a separate structural score of ${urlRisk.score}/100.`;
        }

        return summary;
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

    function unique(
        array
    ) {
        return [
            ...new Set(array)
        ];
    }

    window.LockLensExplanation =
        {
            version: VERSION,

            generateExplanation
        };
})();