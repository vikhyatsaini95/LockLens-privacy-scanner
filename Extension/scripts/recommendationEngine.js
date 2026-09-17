// ============================================================
// LockLens - Recommendation Engine 2.0
// ============================================================
//
// Privacy-first recommendation system.
//
// IMPORTANT:
// Recommendations are generated ONLY from:
// - detected categories
// - risk score
// - risk level
//
// The engine NEVER receives:
// - typed values
// - passwords
// - email addresses
// - phone numbers
// - URLs
// - browsing history
// - page content
//
// ============================================================

(() => {

    "use strict";


    const VERSION = "2.0.0";


    // ========================================================
    // CATEGORY INFORMATION
    // ========================================================

    const CATEGORY_INFO = {

        name: {

            title: "Name",

            sensitivity: "Low",

            advice:
                "Consider whether sharing your name is necessary for this service."

        },


        email: {

            title: "Email",

            sensitivity: "Medium",

            advice:
                "Check whether this service actually requires your email address."

        },


        phone: {

            title: "Phone",

            sensitivity: "Medium",

            advice:
                "Consider whether providing your phone number is necessary."

        },


        address: {

            title: "Address",

            sensitivity: "High",

            advice:
                "Confirm why address information is required before providing it."

        },


        date: {

            title: "Personal Date",

            sensitivity: "Medium",

            advice:
                "Consider whether the personal date being requested is necessary."

        },


        password: {

            title: "Password",

            sensitivity: "High",

            advice:
                "Verify that you are using the intended service before entering credentials."

        },


        payment: {

            title: "Payment Information",

            sensitivity: "High",

            advice:
                "Verify why payment information is required and that the service is intended."

        },


        government_id: {

            title: "Government ID",

            sensitivity: "Critical",

            advice:
                "Government identity information is highly sensitive. Verify the purpose before providing it."

        },


        location: {

            title: "Location",

            sensitivity: "High",

            advice:
                "Check whether location information is necessary for the service."

        },


        username: {

            title: "Username",

            sensitivity: "Low",

            advice:
                "Consider whether your username could reveal information about your online identity."

        }

    };


    // ========================================================
    // PRIORITY ORDER
    // ========================================================

    const PRIORITY = {

        critical: 4,

        high: 3,

        medium: 2,

        low: 1

    };


    // ========================================================
    // NORMALIZE CATEGORIES
    // ========================================================

    function normalizeCategories(
        categories = []
    ) {

        return [
            ...new Set(

                categories

                    .filter(Boolean)

                    .map(
                        category =>
                            String(category)
                                .toLowerCase()
                                .trim()
                    )

            )

        ];

    }


    // ========================================================
    // CATEGORY RECOMMENDATIONS
    // ========================================================

    function generateCategoryRecommendations(
        categories
    ) {

        return categories

            .filter(
                category =>
                    CATEGORY_INFO[category]
            )

            .map(
                category => {

                    const info =
                        CATEGORY_INFO[category];


                    return {

                        id:
                            `category-${category}`,

                        type:
                            "category",

                        priority:
                            PRIORITY[
                                info.sensitivity
                                    .toLowerCase()
                            ] || 1,

                        title:
                            `${info.title} detected`,

                        reason:
                            `LockLens detected a ${info.title.toLowerCase()}-related privacy signal.`,

                        recommendation:
                            info.advice

                    };

                }
            );

    }


    // ========================================================
    // COMBINATION RECOMMENDATIONS
    // ========================================================
    //
    // These make LockLens more intelligent than simply
    // displaying generic advice for each field.
    //
    // ========================================================

    function generateCombinationRecommendations(
        categories
    ) {

        const recommendations = [];


        const has = category =>
            categories.includes(category);


        // ----------------------------------------------------
        // Identity combination
        // ----------------------------------------------------

        if (
            has("name") &&
            has("email") &&
            has("phone")
        ) {

            recommendations.push({

                id:
                    "identity-contact-cluster",

                type:
                    "combination",

                priority:
                    3,

                title:
                    "Multiple identity and contact details",

                reason:
                    "Name, email, and phone information are being requested together.",

                recommendation:
                    "Consider whether all three contact identifiers are necessary. Providing fewer identifiers can reduce unnecessary exposure."

            });

        }


        // ----------------------------------------------------
        // Address + contact
        // ----------------------------------------------------

        if (
            has("address") &&
            (
                has("email") ||
                has("phone")
            )
        ) {

            recommendations.push({

                id:
                    "address-contact-cluster",

                type:
                    "combination",

                priority:
                    3,

                title:
                    "Address combined with contact information",

                reason:
                    "Address information is being requested alongside contact information.",

                recommendation:
                    "Check whether the service needs both your physical address and contact details."

            });

        }


        // ----------------------------------------------------
        // Password + personal information
        // ----------------------------------------------------

        if (
            has("password") &&
            (
                has("email") ||
                has("phone") ||
                has("name")
            )
        ) {

            recommendations.push({

                id:
                    "credential-identity-cluster",

                type:
                    "combination",

                priority:
                    3,

                title:
                    "Credentials combined with identity information",

                reason:
                    "An authentication field appears alongside identity or contact fields.",

                recommendation:
                    "Verify that you are interacting with the intended service before providing credentials."

            });

        }


        // ----------------------------------------------------
        // Password + payment
        // ----------------------------------------------------

        if (
            has("password") &&
            has("payment")
        ) {

            recommendations.push({

                id:
                    "credential-payment-cluster",

                type:
                    "combination",

                priority:
                    4,

                title:
                    "Credentials and payment information",

                reason:
                    "Authentication and payment-related fields are present together.",

                recommendation:
                    "Review the purpose of both requests and verify the service before proceeding."

            });

        }


        // ----------------------------------------------------
        // Government ID + other identity
        // ----------------------------------------------------

        if (
            has("government_id") &&
            (
                has("name") ||
                has("address") ||
                has("date") ||
                has("phone")
            )
        ) {

            recommendations.push({

                id:
                    "government-identity-cluster",

                type:
                    "combination",

                priority:
                    4,

                title:
                    "Government identity information",

                reason:
                    "A government-ID-related field appears alongside other identifying information.",

                recommendation:
                    "Verify why each requested identity detail is necessary before providing it."

            });

        }


        // ----------------------------------------------------
        // Location + identity
        // ----------------------------------------------------

        if (
            has("location") &&
            (
                has("name") ||
                has("email") ||
                has("phone") ||
                has("address")
            )
        ) {

            recommendations.push({

                id:
                    "location-identity-cluster",

                type:
                    "combination",

                priority:
                    3,

                title:
                    "Location combined with identity information",

                reason:
                    "Location-related information appears alongside identifying or contact information.",

                recommendation:
                    "Consider whether the service needs location information in addition to your identity details."

            });

        }


        // ----------------------------------------------------
        // Broad collection
        // ----------------------------------------------------

        if (
            categories.length >= 5
        ) {

            recommendations.push({

                id:
                    "broad-data-collection",

                type:
                    "combination",

                priority:
                    4,

                title:
                    "Broad range of information requested",

                reason:
                    "LockLens detected five or more privacy-related categories.",

                recommendation:
                    "Review each requested category individually and consider whether every field is necessary."

            });

        }


        return recommendations;

    }


    // ========================================================
    // RISK-BASED RECOMMENDATIONS
    // ========================================================

    function generateRiskRecommendations(
        score,
        level
    ) {

        const recommendations = [];


        // ----------------------------------------------------
        // Low
        // ----------------------------------------------------

        if (
            level === "Low"
        ) {

            recommendations.push({

                id:
                    "low-risk-review",

                type:
                    "risk",

                priority:
                    1,

                title:
                    "Low exposure",

                reason:
                    `The calculated exposure score is ${score}/100.`,

                recommendation:
                    "No immediate action is indicated by the LockLens score. Continue reviewing unnecessary data requests."

            });

        }


        // ----------------------------------------------------
        // Medium
        // ----------------------------------------------------

        if (
            level === "Medium"
        ) {

            recommendations.push({

                id:
                    "medium-risk-review",

                type:
                    "risk",

                priority:
                    2,

                title:
                    "Review requested information",

                reason:
                    `The calculated exposure score is ${score}/100.`,

                recommendation:
                    "Review which requested information is actually necessary before continuing."

            });

        }


        // ----------------------------------------------------
        // High
        // ----------------------------------------------------

        if (
            level === "High"
        ) {

            recommendations.push({

                id:
                    "high-risk-review",

                type:
                    "risk",

                priority:
                    3,

                title:
                    "High privacy exposure",

                reason:
                    `The calculated exposure score is ${score}/100.`,

                recommendation:
                    "Pause and review the requested information carefully. Consider whether some fields can be left unprovided."

            });

        }


        // ----------------------------------------------------
        // Critical
        // ----------------------------------------------------

        if (
            level === "Critical"
        ) {

            recommendations.push({

                id:
                    "critical-risk-review",

                type:
                    "risk",

                priority:
                    4,

                title:
                    "Critical privacy exposure",

                reason:
                    `The calculated exposure score is ${score}/100.`,

                recommendation:
                    "Pause before proceeding and verify the purpose of the requested information, especially highly sensitive categories."

            });

        }


        return recommendations;

    }


    // ========================================================
    // DATA MINIMIZATION RECOMMENDATIONS
    // ========================================================

    function generateMinimizationRecommendations(
        categories
    ) {

        const recommendations = [];


        // ----------------------------------------------------
        // Contact minimization
        // ----------------------------------------------------

        const contactCount =
            [
                "email",
                "phone"
            ]
                .filter(
                    category =>
                        categories.includes(category)
                )
                .length;


        if (
            contactCount >= 2
        ) {

            recommendations.push({

                id:
                    "minimize-contact",

                type:
                    "minimization",

                priority:
                    2,

                title:
                    "Minimize contact identifiers",

                reason:
                    "More than one contact identifier appears to be requested.",

                recommendation:
                    "Consider whether the service needs multiple ways to contact or identify you."

            });

        }


        // ----------------------------------------------------
        // Address minimization
        // ----------------------------------------------------

        if (
            categories.includes("address")
        ) {

            recommendations.push({

                id:
                    "minimize-address",

                type:
                    "minimization",

                priority:
                    3,

                title:
                    "Review address necessity",

                reason:
                    "Address information is among the more sensitive categories detected.",

                recommendation:
                    "Consider whether the full address is required or whether a less detailed location would satisfy the service."

            });

        }


        // ----------------------------------------------------
        // Location minimization
        // ----------------------------------------------------

        if (
            categories.includes("location")
        ) {

            recommendations.push({

                id:
                    "minimize-location",

                type:
                    "minimization",

                priority:
                    3,

                title:
                    "Review location access",

                reason:
                    "Location information can reveal contextual information about a user.",

                recommendation:
                    "Consider whether location information is necessary for the feature you are using."

            });

        }


        // ----------------------------------------------------
        // Government ID
        // ----------------------------------------------------

        if (
            categories.includes(
                "government_id"
            )
        ) {

            recommendations.push({

                id:
                    "minimize-government-id",

                type:
                    "minimization",

                priority:
                    4,

                title:
                    "Verify government-ID necessity",

                reason:
                    "Government identity information is highly sensitive.",

                recommendation:
                    "Verify the purpose of the request before providing government identity information."

            });

        }


        return recommendations;

    }


    // ========================================================
    // REMOVE DUPLICATES
    // ========================================================

    function deduplicateRecommendations(
        recommendations
    ) {

        const map =
            new Map();


        recommendations.forEach(
            recommendation => {

                if (
                    !recommendation ||
                    !recommendation.id
                ) {
                    return;
                }


                if (
                    !map.has(
                        recommendation.id
                    )
                ) {

                    map.set(
                        recommendation.id,
                        recommendation
                    );

                }

            }
        );


        return Array.from(
            map.values()
        );

    }


    // ========================================================
    // SORT BY PRIORITY
    // ========================================================

    function sortRecommendations(
        recommendations
    ) {

        return [...recommendations].sort(
            (a, b) =>
                b.priority -
                a.priority
        );

    }


    // ========================================================
    // MAIN RECOMMENDATION FUNCTION
    // ========================================================

    function generateRecommendations(
        findings = [],
        risk = {}
    ) {

        if (!Array.isArray(findings)) {
            findings = [];
        }

        if (!risk || typeof risk !== "object") {
            risk = {};
        }

        // ----------------------------------------------------
        // Get unique categories
        // ----------------------------------------------------

        let categories =
            findings
                .map(
                    finding =>
                        finding?.category
                );


        // If risk engine already supplied categories,
        // use them as an additional source.

        if (
            Array.isArray(
                risk.categories
            )
        ) {

            categories = [
                ...categories,
                ...risk.categories
            ];

        }


        categories =
            normalizeCategories(
                categories
            );


        const score =
            Number(
                risk.score
            ) || 0;


        const level =
            risk.level ||
            "Low";


        // ----------------------------------------------------
        // Generate all recommendation groups
        // ----------------------------------------------------

        const categoryRecommendations =
            generateCategoryRecommendations(
                categories
            );


        const combinationRecommendations =
            generateCombinationRecommendations(
                categories
            );


        const riskRecommendations =
            generateRiskRecommendations(
                score,
                level
            );


        const minimizationRecommendations =
            generateMinimizationRecommendations(
                categories
            );


        // ----------------------------------------------------
        // Combine
        // ----------------------------------------------------

        let recommendations = [

            ...categoryRecommendations,

            ...combinationRecommendations,

            ...riskRecommendations,

            ...minimizationRecommendations

        ];


        // ----------------------------------------------------
        // Remove duplicates
        // ----------------------------------------------------

        recommendations =
            deduplicateRecommendations(
                recommendations
            );


        // ----------------------------------------------------
        // Sort
        // ----------------------------------------------------

        recommendations =
            sortRecommendations(
                recommendations
            );


        return {

            version:
                VERSION,

            categories,

            riskScore:
                score,

            riskLevel:
                level,

            totalRecommendations:
                recommendations.length,

            recommendations

        };

    }


    // ========================================================
    // GET TOP RECOMMENDATIONS
    // ========================================================

    function getTopRecommendations(
        result,
        limit = 5
    ) {

        if (
            !result ||
            !Array.isArray(
                result.recommendations
            )
        ) {

            return [];

        }


        return result.recommendations
            .slice(0, limit);

    }


    // ========================================================
    // EXPORT
    // ========================================================

    window.LockLensRecommendations = {

        version:
            VERSION,

        categoryInfo:
            CATEGORY_INFO,

        generateRecommendations,

        getTopRecommendations,

        generateCategoryRecommendations,

        generateCombinationRecommendations,

        generateRiskRecommendations,

        generateMinimizationRecommendations

    };

})();
