// ============================================================
// LockLens - Explainable Risk Engine
// ============================================================

const LOCKLENS_RISK_VERSION = "2.0.0";


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


const CATEGORY_RECOMMENDATIONS = {

    name:
        "Share your name only when it is necessary for the service.",

    email:
        "Check whether this service really needs your email address.",

    phone:
        "Avoid sharing your phone number unless it is required.",

    address:
        "Confirm why the service needs your address before providing it.",

    date:
        "Avoid sharing personal dates unless they are necessary.",

    password:
        "Make sure you are on the intended service before entering credentials.",

    payment:
        "Check that payment information is necessary and that you trust the service.",

    government_id:
        "Government identity information is highly sensitive. Verify the purpose before providing it.",

    location:
        "Review why the service needs your location and whether access is necessary.",

    username:
        "Consider whether this username can reveal information about your online identity."

};


/**
 * Calculate LockLens risk.
 */
function calculateRisk(findings = []) {

    if (!Array.isArray(findings)) {
        findings = [];
    }

    const uniqueFindings =
        deduplicateRiskFindings(findings);


    let score = 0;

    const categories = [];


    uniqueFindings.forEach((finding) => {

        const weight =
            CATEGORY_WEIGHTS[finding.category] || 0;

        score += weight;

        categories.push(finding.category);

    });


    const uniqueCategories =
        [...new Set(categories)];


    // --------------------------------------------------------
    // Context bonus
    // --------------------------------------------------------

    if (uniqueCategories.length >= 4) {

        score += 10;

    } else if (uniqueCategories.length >= 2) {

        score += 5;

    }


    score =
        Math.min(score, 100);


    const level =
        getRiskLevel(score);


    const recommendations =
        generateRecommendations(uniqueCategories);


    return {

        version: LOCKLENS_RISK_VERSION,

        score,

        level,

        categories: uniqueCategories,

        findingCount: uniqueFindings.length,

        recommendations,

        explanation:
            generateExplanation(
                score,
                level,
                uniqueCategories
            )

    };

}


/**
 * Prevent duplicate category scoring.
 */
function deduplicateRiskFindings(findings) {

    const map = new Map();

    if (!Array.isArray(findings)) {
        return [];
    }

    findings.forEach((finding) => {

        if (!finding?.category) {
            return;
        }

        if (!map.has(finding.category)) {

            map.set(
                finding.category,
                finding
            );

        }

    });

    return Array.from(map.values());
}


/**
 * Risk classification.
 */
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


/**
 * Generate recommendations.
 */
function generateRecommendations(categories) {

    return categories
        .map(
            category =>
                CATEGORY_RECOMMENDATIONS[category]
        )
        .filter(Boolean);

}


/**
 * Explain why the score exists.
 */
function generateExplanation(
    score,
    level,
    categories
) {

    if (categories.length === 0) {

        return "No supported privacy exposure signals were detected.";

    }


    return (
        `LockLens detected ${categories.length} `
        + `privacy-related categor${
            categories.length === 1 ? "y" : "ies"
        }. `
        + `The calculated exposure level is ${level} `
        + `with a score of ${score}/100.`
    );

}


/**
 * Export.
 */
if (typeof window !== "undefined") {

    window.LockLensRiskEngine = {

        version: LOCKLENS_RISK_VERSION,

        categoryWeights:
            CATEGORY_WEIGHTS,

        calculateRisk,

        getRiskLevel,

        generateRecommendations

    };

}
