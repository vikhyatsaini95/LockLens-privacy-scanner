/* =========================================================
   LockLens - Privacy Nutrition Label Engine
   Step 16.3 - Privacy Category Intelligence
   Version: 1.1.0-prototype

   Privacy principles:
   - Metadata only
   - No typed values
   - No passwords
   - No raw email headers
   - No raw page content
   - No raw URLs stored
========================================================= */

(() => {
    "use strict";

    const VERSION = "1.1.0-prototype";

    const CATEGORY_INFO = {
        name: {
            label: "Name",
            group: "Identity",
            sensitivity: 1,
            description: "Basic identity information."
        },

        email: {
            label: "Email Address",
            group: "Contact",
            sensitivity: 2,
            description: "Contact and account-identification information."
        },

        phone: {
            label: "Phone Number",
            group: "Contact",
            sensitivity: 3,
            description: "Direct contact information."
        },

        address: {
            label: "Address",
            group: "Location",
            sensitivity: 4,
            description: "Physical location or residential information."
        },

        date: {
            label: "Personal Date",
            group: "Personal Information",
            sensitivity: 2,
            description: "Potentially identifying date information."
        },

        password: {
            label: "Password",
            group: "Authentication",
            sensitivity: 5,
            description: "Authentication-related information."
        },

        payment: {
            label: "Payment Information",
            group: "Financial",
            sensitivity: 5,
            description: "Financial or payment-related information."
        },

        government_id: {
            label: "Government ID",
            group: "Identity",
            sensitivity: 5,
            description: "Official identity-document information."
        },

        location: {
            label: "Location",
            group: "Location",
            sensitivity: 4,
            description: "Location-related information."
        },

        username: {
            label: "Username",
            group: "Account",
            sensitivity: 2,
            description: "Account identification information."
        }
    };

    const GROUP_DEFINITIONS = {
        Identity: {
            description:
                "Information that may directly identify or distinguish a person.",
            categories: ["name", "government_id"]
        },

        Contact: {
            description:
                "Information that can be used to contact or communicate with a person.",
            categories: ["email", "phone"]
        },

        Authentication: {
            description:
                "Information associated with account authentication.",
            categories: ["password"]
        },

        Financial: {
            description:
                "Information associated with payments or financial activity.",
            categories: ["payment"]
        },

        Location: {
            description:
                "Information that may reveal a physical or geographic location.",
            categories: ["address", "location"]
        },

        "Personal Information": {
            description:
                "Other personal information that may contribute to identification.",
            categories: ["date"]
        },

        Account: {
            description:
                "Information associated with an online account or profile.",
            categories: ["username"]
        }
    };

    function normalizeCategories(categories) {
        if (!Array.isArray(categories)) {
            return [];
        }

        return [...new Set(
            categories
                .map(category => String(category).trim().toLowerCase())
                .filter(Boolean)
        )];
    }

    function getRiskLevel(score) {
        const value = Math.max(0, Math.min(100, Number(score) || 0));

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

    function getSensitivityLevel(score) {
        const value = Number(score) || 0;

        if (value <= 1) {
            return "Low";
        }

        if (value <= 2) {
            return "Moderate";
        }

        if (value <= 3) {
            return "Elevated";
        }

        if (value <= 4) {
            return "High";
        }

        return "Critical";
    }

    function buildCategoryIntelligence(categories) {
        const normalized = normalizeCategories(categories);

        return Object.entries(GROUP_DEFINITIONS)
            .map(([groupName, definition]) => {
                const detectedCategories = definition.categories.filter(
                    category => normalized.includes(category)
                );

                if (detectedCategories.length === 0) {
                    return null;
                }

                const sensitivityValues = detectedCategories.map(
                    category => CATEGORY_INFO[category]?.sensitivity || 1
                );

                const sensitivity = Math.max(...sensitivityValues);

                const labels = detectedCategories.map(
                    category =>
                        CATEGORY_INFO[category]?.label || category
                );

                return {
                    name: groupName,

                    description: definition.description,

                    detected: true,

                    categories: detectedCategories,

                    categoryCount: detectedCategories.length,

                    sensitivity,

                    sensitivityScore: Math.round(
                        (sensitivity / 5) * 100
                    ),

                    sensitivityLevel:
                        getSensitivityLevel(sensitivity),

                    labels
                };
            })
            .filter(Boolean);
    }

    function calculateOverallSensitivity(categories) {
        const normalized = normalizeCategories(categories);

        if (!normalized.length) {
            return {
                score: 0,
                level: "Low"
            };
        }

        const values = normalized
            .map(category => CATEGORY_INFO[category]?.sensitivity || 1);

        const highest = Math.max(...values);

        const score = Math.round((highest / 5) * 100);

        return {
            score,
            level: getSensitivityLevel(highest)
        };
    }

    function calculateDataMinimization(categories) {
        const normalized = normalizeCategories(categories);

        const highSensitivityCategories = normalized.filter(category => {
            const sensitivity =
                CATEGORY_INFO[category]?.sensitivity || 1;

            return sensitivity >= 4;
        });

        if (highSensitivityCategories.length === 0) {
            return {
                level: "Good",
                message:
                    "No highly sensitive information categories were detected."
            };
        }

        if (highSensitivityCategories.length === 1) {
            return {
                level: "Review",
                message:
                    "One highly sensitive information category appears to be requested. Consider whether it is necessary."
            };
        }

        return {
            level: "High Attention",
            message:
                "Multiple highly sensitive information categories appear to be requested. Review whether each requested category is necessary."
        };
    }

    function buildRequestGroups(categories) {
        const normalized = normalizeCategories(categories);

        return Object.entries(GROUP_DEFINITIONS)
            .map(([groupName, definition]) => {
                const detected = definition.categories.filter(
                    category => normalized.includes(category)
                );

                if (!detected.length) {
                    return null;
                }

                return {
                    name: groupName,
                    categories: detected,
                    count: detected.length
                };
            })
            .filter(Boolean);
    }

    function buildSecuritySignals(urlRisk, emailRisk) {
        const signals = [];

        if (urlRisk) {
            if (urlRisk.checks?.https === false) {
                signals.push({
                    type: "warning",
                    title: "HTTPS not detected",
                    message:
                        "The analyzed URL does not appear to use HTTPS."
                });
            }

            if (urlRisk.checks?.ipAddress) {
                signals.push({
                    type: "warning",
                    title: "IP address URL",
                    message:
                        "The URL uses an IP address instead of a conventional domain."
                });
            }

            if (urlRisk.checks?.longUrl) {
                signals.push({
                    type: "info",
                    title: "Long URL",
                    message:
                        "The URL contains an unusually large amount of text."
                });
            }

            if (urlRisk.checks?.manySubdomains) {
                signals.push({
                    type: "warning",
                    title: "Multiple subdomains",
                    message:
                        "The URL contains several subdomain levels."
                });
            }

            if (urlRisk.checks?.usernameInUrl) {
                signals.push({
                    type: "warning",
                    title: "Username in URL",
                    message:
                        "The URL contains user-information syntax."
                });
            }
        }

        if (emailRisk) {
            if (emailRisk.spf?.status === "fail") {
                signals.push({
                    type: "warning",
                    title: "SPF failure",
                    message:
                        "The supplied email headers indicate an SPF failure."
                });
            }

            if (emailRisk.dkim?.status === "fail") {
                signals.push({
                    type: "warning",
                    title: "DKIM failure",
                    message:
                        "The supplied email headers indicate a DKIM failure."
                });
            }

            if (emailRisk.dmarc?.status === "fail") {
                signals.push({
                    type: "warning",
                    title: "DMARC failure",
                    message:
                        "The supplied email headers indicate a DMARC failure."
                });
            }
        }

        return signals;
    }

    function buildActions(categories, risk) {
        const normalized = normalizeCategories(categories);
        const actions = [];

        if (normalized.includes("password")) {
            actions.push(
                "Use a unique password and avoid sharing passwords unnecessarily."
            );
        }

        if (normalized.includes("payment")) {
            actions.push(
                "Check why payment information is required before continuing."
            );
        }

        if (normalized.includes("government_id")) {
            actions.push(
                "Verify that providing government ID information is necessary."
            );
        }

        if (
            normalized.includes("phone") ||
            normalized.includes("email")
        ) {
            actions.push(
                "Consider whether the requested contact information is necessary."
            );
        }

        if (
            normalized.includes("address") ||
            normalized.includes("location")
        ) {
            actions.push(
                "Review whether the requested location information is necessary."
            );
        }

        if (Number(risk?.score) >= 51) {
            actions.push(
                "Review the detected privacy signals before continuing."
            );
        }

        if (!actions.length) {
            actions.push(
                "Review the requested information and provide only what is necessary."
            );
        }

        return [...new Set(actions)];
    }

    function generateLabel({
        findings = [],
        risk = null,
        urlRisk = null,
        emailRisk = null
    } = {}) {
        const categories = normalizeCategories(
            findings.map(item => item?.category)
        );

        const riskScore = Number(
            risk?.score ?? risk?.page?.score ?? 0
        );

        const riskLevel =
            risk?.level || getRiskLevel(riskScore);

        const sensitivity =
            calculateOverallSensitivity(categories);

        const categoryIntelligence =
            buildCategoryIntelligence(categories);

        const requestGroups =
            buildRequestGroups(categories);

        const dataMinimization =
            calculateDataMinimization(categories);

        const securitySignals =
            buildSecuritySignals(urlRisk, emailRisk);

        const actions =
            buildActions(categories, {
                score: riskScore,
                level: riskLevel
            });

        let summary;

        if (!categories.length) {
            summary =
                "No supported sensitive information categories were detected from the available page metadata.";
        } else {
            summary =
                `${categories.length} information categor${categories.length === 1 ? "y" : "ies"} detected across ${categoryIntelligence.length} privacy domain${categoryIntelligence.length === 1 ? "" : "s"}.`;
        }

        return {
            version: VERSION,

            timestamp: Date.now(),

            processedLocally: true,

            rawDataStored: false,

            categories,

            categoryIntelligence,

            requestGroups,

            risk: {
                score: riskScore,
                level: riskLevel
            },

            sensitivity,

            exposureSummary: summary,

            dataMinimization,

            securitySignals,

            actions,

            privacyNotes: [
                "LockLens analyzes metadata and detected categories locally.",
                "LockLens does not intentionally store typed passwords or sensitive field values.",
                "Raw email headers are not stored by the nutrition label.",
                "The nutrition label describes detected categories rather than the actual values entered by a user."
            ],

            sources: {
                page: Boolean(findings.length),
                url: Boolean(urlRisk),
                email: Boolean(emailRisk)
            }
        };
    }

    async function saveLabel(label) {
        if (
            typeof chrome === "undefined" ||
            !chrome.storage?.local
        ) {
            return false;
        }

        await chrome.storage.local.set({
            lockLensPrivacyLabel: label
        });

        return true;
    }

    async function loadLabel() {
        if (
            typeof chrome === "undefined" ||
            !chrome.storage?.local
        ) {
            return null;
        }

        const result =
            await chrome.storage.local.get(
                "lockLensPrivacyLabel"
            );

        return result.lockLensPrivacyLabel || null;
    }

    window.LockLensPrivacyLabel = {
        version: VERSION,

        generateLabel,

        saveLabel,

        loadLabel,

        getRiskLevel,

        getCategoryIntelligence:
            buildCategoryIntelligence
    };
})();