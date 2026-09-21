/* =========================================================
   LockLens - Privacy Decision Engine
   Step 17
   Version: 1.0.0-prototype

   Purpose:
   Convert detected privacy signals into a simple,
   explainable decision path.

   Privacy principles:
   - Uses metadata only
   - Does not read typed values
   - Does not store passwords
   - Does not store raw URLs
   - Does not make decisions on behalf of the user
========================================================= */

(() => {
    "use strict";

    const VERSION = "1.0.0-prototype";

    const CATEGORY_LABELS = {
        name: "Name",
        email: "Email Address",
        phone: "Phone Number",
        address: "Address",
        date: "Personal Date",
        password: "Password",
        payment: "Payment Information",
        government_id: "Government ID",
        location: "Location",
        username: "Username"
    };

    const CATEGORY_GROUPS = {
        name: "Identity",
        government_id: "Identity",

        email: "Contact",
        phone: "Contact",

        password: "Authentication",

        payment: "Financial",

        address: "Location",
        location: "Location",

        date: "Personal Information",

        username: "Account"
    };


    function normalizeCategories(categories) {
        if (!Array.isArray(categories)) {
            return [];
        }

        return [...new Set(
            categories
                .map(item =>
                    String(item)
                        .trim()
                        .toLowerCase()
                )
                .filter(Boolean)
        )];
    }


    function getRiskScore(risk) {
        if (!risk) {
            return 0;
        }

        return Math.max(
            0,
            Math.min(
                100,
                Number(risk.score) || 0
            )
        );
    }


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


    function getHighestSensitivity(categories) {

        const sensitivityMap = {
            password: 5,
            payment: 5,
            government_id: 5,

            address: 4,
            location: 4,

            phone: 3,

            email: 2,
            date: 2,
            username: 2,

            name: 1
        };

        const values = categories.map(
            category =>
                sensitivityMap[category] || 1
        );

        return values.length
            ? Math.max(...values)
            : 0;
    }


    function getGroups(categories) {

        return [
            ...new Set(
                categories
                    .map(
                        category =>
                            CATEGORY_GROUPS[category]
                    )
                    .filter(Boolean)
            )
        ];
    }


    function buildDetectedInformation(categories) {

        return categories.map(category => ({
            category,

            label:
                CATEGORY_LABELS[category] ||
                category,

            group:
                CATEGORY_GROUPS[category] ||
                "Other"
        }));
    }


    function buildDecisionPath({
        categories,
        risk,
        urlRisk,
        emailRisk
    }) {

        const score =
            getRiskScore(risk);

        const level =
            risk?.level ||
            getRiskLevel(score);

        const highestSensitivity =
            getHighestSensitivity(categories);

        const groups =
            getGroups(categories);


        const path = [];


        /* -------------------------------------------------
           STEP 1
        ------------------------------------------------- */

        if (categories.length) {

            path.push({
                step: 1,

                title:
                    "Sensitive information detected",

                question:
                    "What type of information appears to be involved?",

                answer:
                    `${categories.length} information categor${
                        categories.length === 1
                            ? "y"
                            : "ies"
                    } detected.`,

                status: "detected",

                details:
                    buildDetectedInformation(
                        categories
                    )
            });

        } else {

            path.push({
                step: 1,

                title:
                    "No supported sensitive category detected",

                question:
                    "Did LockLens detect a supported sensitive information category?",

                answer:
                    "No supported category was detected from the available metadata.",

                status: "clear",

                details: []
            });
        }


        /* -------------------------------------------------
           STEP 2
        ------------------------------------------------- */

        path.push({
            step: 2,

            title:
                "Understand the privacy domain",

            question:
                "Which privacy areas are involved?",

            answer:
                groups.length
                    ? groups.join(", ")
                    : "No specific privacy domain identified.",

            status:
                groups.length
                    ? "review"
                    : "clear",

            details:
                groups
        });


        /* -------------------------------------------------
           STEP 3
        ------------------------------------------------- */

        let necessityMessage;

        if (!categories.length) {

            necessityMessage =
                "No sensitive category was detected, so there is no specific data request to review.";

        } else if (
            categories.includes("password") ||
            categories.includes("payment") ||
            categories.includes("government_id")
        ) {

            necessityMessage =
                "Consider whether the highly sensitive information requested is necessary for the service.";

        } else if (
            categories.includes("address") ||
            categories.includes("location") ||
            categories.includes("phone")
        ) {

            necessityMessage =
                "Consider whether the requested personal information is necessary for the current task.";

        } else {

            necessityMessage =
                "Consider whether every requested information category is necessary.";
        }


        path.push({
            step: 3,

            title:
                "Consider necessity",

            question:
                "Is the requested information necessary?",

            answer:
                necessityMessage,

            status:
                categories.length
                    ? "decision"
                    : "clear",

            details: {
                userDecisionRequired: true
            }
        });


        /* -------------------------------------------------
           STEP 4
        ------------------------------------------------- */

        const securitySignals = [];


        if (urlRisk) {

            if (urlRisk.checks?.https === false) {
                securitySignals.push(
                    "HTTPS was not detected."
                );
            }

            if (urlRisk.checks?.ipAddress) {
                securitySignals.push(
                    "The URL uses an IP address."
                );
            }

            if (urlRisk.checks?.manySubdomains) {
                securitySignals.push(
                    "Multiple subdomain levels were detected."
                );
            }

            if (urlRisk.checks?.longUrl) {
                securitySignals.push(
                    "The URL is unusually long."
                );
            }

            if (urlRisk.checks?.usernameInUrl) {
                securitySignals.push(
                    "Username syntax was detected in the URL."
                );
            }
        }


        if (emailRisk) {

            if (emailRisk.spf?.status === "fail") {
                securitySignals.push(
                    "SPF failure detected in supplied email headers."
                );
            }

            if (emailRisk.dkim?.status === "fail") {
                securitySignals.push(
                    "DKIM failure detected in supplied email headers."
                );
            }

            if (emailRisk.dmarc?.status === "fail") {
                securitySignals.push(
                    "DMARC failure detected in supplied email headers."
                );
            }
        }


        path.push({
            step: 4,

            title:
                "Review security signals",

            question:
                "Are there additional technical warning signals?",

            answer:
                securitySignals.length
                    ? `${securitySignals.length} additional signal${
                        securitySignals.length === 1
                            ? ""
                            : "s"
                    } detected.`
                    : "No additional technical warning signals detected.",

            status:
                securitySignals.length
                    ? "warning"
                    : "clear",

            details:
                securitySignals
        });


        /* -------------------------------------------------
           STEP 5
        ------------------------------------------------- */

        let action;

        if (!categories.length) {

            action = {
                type: "continue",
                title:
                    "Continue with normal privacy awareness",
                message:
                    "No supported sensitive information category was detected."
            };

        } else if (
            score >= 76 ||
            highestSensitivity >= 5
        ) {

            action = {
                type: "high-attention",
                title:
                    "Review carefully before continuing",
                message:
                    "Highly sensitive information appears to be involved. Verify why it is needed before deciding what to provide."
            };

        } else if (
            score >= 51 ||
            highestSensitivity >= 4
        ) {

            action = {
                type: "review",
                title:
                    "Review the request",
                message:
                    "The available signals indicate elevated privacy exposure. Consider whether the requested information is necessary."
            };

        } else {

            action = {
                type: "continue-carefully",
                title:
                    "Continue with awareness",
                message:
                    "Some personal information appears to be involved. Provide only information that is necessary."
            };
        }


        path.push({
            step: 5,

            title:
                "Privacy decision",

            question:
                "What should the user consider next?",

            answer:
                action.message,

            status:
                action.type,

            details:
                action
        });


        return {
            version: VERSION,

            generatedLocally: true,

            timestamp: Date.now(),

            risk: {
                score,

                level
            },

            categories,

            groups,

            highestSensitivity,

            securitySignals,

            recommendedAction:
                action,

            path
        };
    }


    function generateDecisionPath({
        findings = [],
        risk = null,
        urlRisk = null,
        emailRisk = null,
        privacyLabel = null
    } = {}) {

        let categories =
            normalizeCategories(
                findings.map(
                    item => item?.category
                )
            );


        /*
         * If findings are unavailable but the
         * Privacy Nutrition Label exists,
         * use its category metadata.
         */

        if (
            !categories.length &&
            privacyLabel &&
            Array.isArray(
                privacyLabel.categories
            )
        ) {

            categories =
                normalizeCategories(
                    privacyLabel.categories
                );
        }


        return buildDecisionPath({
            categories,
            risk,
            urlRisk,
            emailRisk
        });
    }


    window.LockLensPrivacyDecision = {

        version: VERSION,

        generateDecisionPath,

        getRiskLevel,

        getGroups,

        getCategoryLabel:
            category =>
                CATEGORY_LABELS[
                    String(category)
                        .toLowerCase()
                ] ||
                category
    };

})();