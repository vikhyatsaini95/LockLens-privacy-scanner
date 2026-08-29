function calculateRisk(findings) {
    let score = 0;
    const recommendations = [];

    findings.forEach((finding) => {
        score += finding.points || 10;

        if (finding.type === "email") {
            recommendations.push(
                "Review where your email address is publicly visible and avoid sharing it unnecessarily."
            );
        }

        if (finding.type === "phone") {
            recommendations.push(
                "Avoid exposing phone numbers publicly and review privacy settings on connected services."
            );
        }

        if (finding.type === "date") {
            recommendations.push(
                "Review whether personal dates are necessary to display publicly."
            );
        }
    });

    score = Math.min(score, 100);

    let level;
    if (score <= 20) level = "Low";
    else if (score <= 50) level = "Medium";
    else if (score <= 75) level = "High";
    else level = "Critical";

    if (findings.length === 0) {
        recommendations.push(
            "No supported exposure categories were detected on this page. Continue reviewing your privacy settings."
        );
    }

    recommendations.push(
        "LockLens analyzes supported page content locally and does not store raw page content."
    );

    return {
        score,
        level,
        recommendations
    };
}