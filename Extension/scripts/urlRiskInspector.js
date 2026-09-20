(() => {
    "use strict";

    const URL_SHORTENERS = [
        "bit.ly",
        "tinyurl.com",
        "t.co",
        "goo.gl",
        "is.gd",
        "ow.ly",
        "buff.ly",
        "cutt.ly",
        "rb.gy",
        "shorturl.at"
    ];

    const SUSPICIOUS_CHARACTERS = [
        "@",
        "\\",
        "<",
        ">",
        "{",
        "}",
        "[",
        "]"
    ];

    function analyzeURL(url) {
        if (!url || typeof url !== "string") {
            return {
                valid: false,
                score: 0,
                level: "Unknown",
                checks: {},
                recommendations: [],
                limitations: [
                    "No URL was supplied."
                ]
            };
        }

        let parsedURL;

        try {
            parsedURL = new URL(url);
        } catch {
            return {
                valid: false,
                score: 0,
                level: "Unknown",
                checks: {},
                recommendations: [],
                limitations: [
                    "The supplied URL is not valid."
                ]
            };
        }

        // ---------------------------------------------
        // Structural checks
        // ---------------------------------------------

        const https =
            parsedURL.protocol === "https:";

        const hostname =
            parsedURL.hostname || "";

        const ipAddress =
            isIPAddress(hostname);

        const subdomainParts =
            hostname.split(".").filter(Boolean);

        const subdomainCount =
            Math.max(
                0,
                subdomainParts.length - 2
            );

        const manySubdomains =
            subdomainCount >= 3;

        const suspiciousCharacters =
            SUSPICIOUS_CHARACTERS.filter(
                (character) =>
                    url.includes(character)
            );

        const longUrl =
            url.length > 180;

        const suspiciousPort =
            Boolean(
                parsedURL.port &&
                    !["80", "443"].includes(
                        parsedURL.port
                    )
            );

        const usernameInUrl =
            Boolean(
                parsedURL.username ||
                    parsedURL.password
            );

        const urlShortener =
            URL_SHORTENERS.includes(
                hostname.toLowerCase()
            );

        const encodedUrl =
            hasSuspiciousEncoding(url);

        // ---------------------------------------------
        // Risk score
        // ---------------------------------------------

        let score = 0;

        if (!https) {
            score += 25;
        }

        if (ipAddress) {
            score += 25;
        }

        if (manySubdomains) {
            score += 10;
        }

        if (suspiciousCharacters.length > 0) {
            score += 15;
        }

        if (longUrl) {
            score += 10;
        }

        if (suspiciousPort) {
            score += 10;
        }

        if (usernameInUrl) {
            score += 10;
        }

        if (urlShortener) {
            score += 5;
        }

        if (encodedUrl) {
            score += 5;
        }

        score =
            Math.min(
                100,
                score
            );

        const level =
            getRiskLevel(score);

        // ---------------------------------------------
        // Recommendations
        // ---------------------------------------------

        const recommendations = [];

        if (!https) {
            recommendations.push(
                "Prefer HTTPS websites before entering sensitive information."
            );
        }

        if (ipAddress) {
            recommendations.push(
                "Check the website carefully because the URL uses an IP address instead of a normal domain."
            );
        }

        if (manySubdomains) {
            recommendations.push(
                "Review the domain structure carefully because several subdomain levels are present."
            );
        }

        if (suspiciousCharacters.length > 0) {
            recommendations.push(
                "Inspect the URL carefully because unusual characters were detected."
            );
        }

        if (longUrl) {
            recommendations.push(
                "Be cautious with unusually long URLs and verify the destination before continuing."
            );
        }

        if (suspiciousPort) {
            recommendations.push(
                "Review the destination because the URL uses a non-standard port."
            );
        }

        if (usernameInUrl) {
            recommendations.push(
                "Avoid URLs containing embedded username information unless you recognize the destination."
            );
        }

        if (urlShortener) {
            recommendations.push(
                "Verify the destination before trusting a shortened URL."
            );
        }

        if (encodedUrl) {
            recommendations.push(
                "Review encoded URL components carefully if the destination is unfamiliar."
            );
        }

        if (recommendations.length === 0) {
            recommendations.push(
                "No obvious structural URL warning signals were detected."
            );
        }

        // ---------------------------------------------
        // Limitations
        // ---------------------------------------------

        const limitations = [
            "This prototype performs structural URL analysis only.",
            "It does not claim to verify domain ownership, domain age, or live threat intelligence.",
            "A low structural score does not guarantee that a website is safe."
        ];

        return {
            valid: true,

            // Keep the URL available only in memory.
            // The popup deliberately does not store this value.
            url,

            score,

            level,

            checks: {
                https,

                ipAddress,

                subdomainCount,

                manySubdomains,

                suspiciousCharacters,

                longUrl,

                suspiciousPort,

                usernameInUrl,

                urlShortener,

                encodedUrl
            },

            recommendations,

            limitations
        };
    }

    // ---------------------------------------------
    // IP ADDRESS DETECTION
    // ---------------------------------------------

    function isIPAddress(hostname) {
        // IPv4
        const ipv4 =
            /^(?:\d{1,3}\.){3}\d{1,3}$/;

        if (ipv4.test(hostname)) {
            const parts =
                hostname.split(".").map(
                    Number
                );

            return parts.every(
                (part) =>
                    part >= 0 &&
                    part <= 255
            );
        }

        // IPv6
        return hostname.includes(":");
    }

    // ---------------------------------------------
    // ENCODED URL DETECTION
    // ---------------------------------------------

    function hasSuspiciousEncoding(url) {
        const encodedMatches =
            url.match(/%[0-9A-Fa-f]{2}/g);

        if (!encodedMatches) {
            return false;
        }

        // A small amount of normal URL encoding
        // is not automatically suspicious.
        return encodedMatches.length >= 3;
    }

    // ---------------------------------------------
    // RISK LEVEL
    // ---------------------------------------------

    function getRiskLevel(score) {
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

    // ---------------------------------------------
    // PUBLIC API
    // ---------------------------------------------

    window.LockLensURLInspector = {
        version: "1.0.0-prototype",

        analyzeURL
    };
})();
