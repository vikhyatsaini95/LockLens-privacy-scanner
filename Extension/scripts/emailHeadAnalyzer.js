(() => {
    "use strict";

    // =========================================================
    // LOCKLENS EMAIL HEADER ANALYZER
    // Step 13
    //
    // Privacy:
    // - Raw headers are processed locally.
    // - Raw headers are never stored.
    // - Email addresses are used only during analysis.
    // - No mailbox/API access is performed.
    // =========================================================

    const VERSION = "1.0.0-prototype";

    const RISK_LEVELS = {
        LOW: "Low",
        MEDIUM: "Medium",
        HIGH: "High",
        CRITICAL: "Critical"
    };

    // ---------------------------------------------------------
    // Normalize header names
    // ---------------------------------------------------------

    function normalizeHeaderName(name) {
        return String(name || "")
            .trim()
            .toLowerCase();
    }

    // ---------------------------------------------------------
    // Unfold multiline email headers
    // Example:
    //
    // Received:
    //     from example.com
    //
    // becomes one logical line.
    // ---------------------------------------------------------

    function unfoldHeaders(rawHeaders) {
        return String(rawHeaders || "")
            .replace(/\r\n[ \t]+/g, " ")
            .replace(/\n[ \t]+/g, " ")
            .replace(/\r[ \t]+/g, " ");
    }

    // ---------------------------------------------------------
    // Parse headers
    // ---------------------------------------------------------

    function parseHeaders(rawHeaders) {
        const unfolded = unfoldHeaders(rawHeaders);

        const headers = {};

        const lines = unfolded.split(/\r?\n/);

        lines.forEach((line) => {
            const separator = line.indexOf(":");

            if (separator === -1) {
                return;
            }

            const name = normalizeHeaderName(
                line.slice(0, separator)
            );

            const value = line
                .slice(separator + 1)
                .trim();

            if (!name) {
                return;
            }

            if (!headers[name]) {
                headers[name] = [];
            }

            headers[name].push(value);
        });

        return headers;
    }

    // ---------------------------------------------------------
    // Get first header
    // ---------------------------------------------------------

    function getFirstHeader(headers, name) {
        const values = headers[
            normalizeHeaderName(name)
        ];

        if (!Array.isArray(values)) {
            return "";
        }

        return values[0] || "";
    }

    // ---------------------------------------------------------
    // Extract email address from a header value
    //
    // Example:
    // John <john@example.com>
    //
    // returns:
    // john@example.com
    // ---------------------------------------------------------

    function extractEmail(value) {
        const text = String(value || "");

        const angleMatch = text.match(
            /<\s*([^<>\s]+@[^<>\s]+)\s*>/
        );

        if (angleMatch) {
            return angleMatch[1]
                .trim()
                .toLowerCase();
        }

        const directMatch = text.match(
            /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i
        );

        return directMatch
            ? directMatch[0]
                  .trim()
                  .toLowerCase()
            : "";
    }

    // ---------------------------------------------------------
    // Extract email domain
    // ---------------------------------------------------------

    function extractDomain(email) {
        const value = String(email || "")
            .trim()
            .toLowerCase();

        const index = value.lastIndexOf("@");

        if (index === -1) {
            return "";
        }

        return value
            .slice(index + 1)
            .replace(/[>\s].*$/, "")
            .trim();
    }

    // ---------------------------------------------------------
    // Authentication-Results parser
    //
    // Detects:
    // spf=pass/fail
    // dkim=pass/fail
    // dmarc=pass/fail
    // ---------------------------------------------------------

    function parseAuthenticationResults(headers) {
        const values =
            headers["authentication-results"] || [];

        const combined = values.join(" ");

        const result = {
            spf: "unknown",
            dkim: "unknown",
            dmarc: "unknown"
        };

        const spfMatch = combined.match(
            /\bspf\s*=\s*(pass|fail|softfail|neutral|none|temperror|permerror)\b/i
        );

        const dkimMatch = combined.match(
            /\bdkim\s*=\s*(pass|fail|neutral|none|temperror|permerror)\b/i
        );

        const dmarcMatch = combined.match(
            /\bdmarc\s*=\s*(pass|fail|bestguesspass|none|quarantine|reject|temperror|permerror)\b/i
        );

        if (spfMatch) {
            result.spf =
                spfMatch[1].toLowerCase();
        }

        if (dkimMatch) {
            result.dkim =
                dkimMatch[1].toLowerCase();
        }

        if (dmarcMatch) {
            result.dmarc =
                dmarcMatch[1].toLowerCase();
        }

        return result;
    }

    // ---------------------------------------------------------
    // Domain mismatch helper
    // ---------------------------------------------------------

    function domainsMismatch(domainA, domainB) {
        if (!domainA || !domainB) {
            return false;
        }

        return (
            domainA.toLowerCase() !==
            domainB.toLowerCase()
        );
    }

    // ---------------------------------------------------------
    // Score calculation
    // ---------------------------------------------------------

    function calculateScore(checks) {
        let score = 0;

        // SPF failure
        if (checks.spf === "fail") {
            score += 20;
        }

        // DKIM failure
        if (checks.dkim === "fail") {
            score += 20;
        }

        // DMARC failure
        if (checks.dmarc === "fail") {
            score += 25;
        }

        // From / Return-Path mismatch
        if (checks.fromReturnPathMismatch) {
            score += 15;
        }

        // Reply-To mismatch
        if (checks.replyToMismatch) {
            score += 10;
        }

        // Message-ID domain mismatch
        if (checks.messageIdDomainMismatch) {
            score += 10;
        }

        // No Received chain
        if (checks.receivedChainCount === 0) {
            score += 5;
        }

        return Math.min(score, 100);
    }

    // ---------------------------------------------------------
    // Risk level
    // ---------------------------------------------------------

    function getRiskLevel(score) {
        if (score >= 76) {
            return RISK_LEVELS.CRITICAL;
        }

        if (score >= 51) {
            return RISK_LEVELS.HIGH;
        }

        if (score >= 21) {
            return RISK_LEVELS.MEDIUM;
        }

        return RISK_LEVELS.LOW;
    }

    // ---------------------------------------------------------
    // Recommendations
    // ---------------------------------------------------------

    function generateRecommendations(
        checks,
        score,
        level
    ) {
        const recommendations = [];

        if (checks.spf === "fail") {
            recommendations.push(
                "SPF authentication failed. Treat the sender identity with caution."
            );
        }

        if (checks.dkim === "fail") {
            recommendations.push(
                "DKIM authentication failed. The message signature could not be validated."
            );
        }

        if (checks.dmarc === "fail") {
            recommendations.push(
                "DMARC authentication failed. Verify the sender through an independent trusted channel."
            );
        }

        if (checks.fromReturnPathMismatch) {
            recommendations.push(
                "The From and Return-Path domains differ. Review the sender identity carefully."
            );
        }

        if (checks.replyToMismatch) {
            recommendations.push(
                "Reply-To differs from the apparent sender. Avoid replying until the destination is verified."
            );
        }

        if (checks.messageIdDomainMismatch) {
            recommendations.push(
                "The Message-ID domain differs from the sender domain. This is an additional signal to review."
            );
        }

        if (checks.receivedChainCount === 0) {
            recommendations.push(
                "No Received headers were found. The supplied header set may be incomplete."
            );
        }

        if (recommendations.length === 0) {
            recommendations.push(
                "No major structural authentication warnings were detected in the supplied headers."
            );
        }

        if (
            level === RISK_LEVELS.HIGH ||
            level === RISK_LEVELS.CRITICAL
        ) {
            recommendations.push(
                "Do not rely on the header analysis alone. Verify unexpected messages using a trusted communication channel."
            );
        }

        return recommendations;
    }

    // ---------------------------------------------------------
    // Main analyzer
    // ---------------------------------------------------------

    function analyzeHeaders(rawHeaders) {
        const input = String(rawHeaders || "");

        if (!input.trim()) {
            return {
                valid: false,
                version: VERSION,
                error:
                    "No email headers were provided.",
                processedLocally: true,
                rawHeadersStored: false
            };
        }

        const headers =
            parseHeaders(input);

        const authentication =
            parseAuthenticationResults(
                headers
            );

        const fromValue =
            getFirstHeader(
                headers,
                "from"
            );

        const returnPathValue =
            getFirstHeader(
                headers,
                "return-path"
            );

        const replyToValue =
            getFirstHeader(
                headers,
                "reply-to"
            );

        const messageIdValue =
            getFirstHeader(
                headers,
                "message-id"
            );

        const fromEmail =
            extractEmail(fromValue);

        const returnPathEmail =
            extractEmail(returnPathValue);

        const replyToEmail =
            extractEmail(replyToValue);

        const messageIdEmail =
            extractEmail(messageIdValue);

        const fromDomain =
            extractDomain(fromEmail);

        const returnPathDomain =
            extractDomain(
                returnPathEmail
            );

        const replyToDomain =
            extractDomain(replyToEmail);

        const messageIdDomain =
            extractDomain(messageIdEmail);

        const receivedHeaders =
            headers["received"] || [];

        const checks = {
            spf:
                authentication.spf,

            dkim:
                authentication.dkim,

            dmarc:
                authentication.dmarc,

            fromReturnPathMismatch:
                domainsMismatch(
                    fromDomain,
                    returnPathDomain
                ),

            replyToMismatch:
                domainsMismatch(
                    fromDomain,
                    replyToDomain
                ),

            messageIdDomainMismatch:
                domainsMismatch(
                    fromDomain,
                    messageIdDomain
                ),

            receivedChainCount:
                receivedHeaders.length
        };

        const score =
            calculateScore(checks);

        const level =
            getRiskLevel(score);

        const recommendations =
            generateRecommendations(
                checks,
                score,
                level
            );

        return {
            valid: true,

            version: VERSION,

            score,

            level,

            checks: {
                spf: checks.spf,
                dkim: checks.dkim,
                dmarc: checks.dmarc,

                fromReturnPathMismatch:
                    checks.fromReturnPathMismatch,

                replyToMismatch:
                    checks.replyToMismatch,

                messageIdDomainMismatch:
                    checks.messageIdDomainMismatch,

                receivedChainCount:
                    checks.receivedChainCount
            },

            recommendations,

            limitations: [
                "Header analysis provides signals, not proof that an email is malicious.",
                "The supplied header set may be incomplete.",
                "No external threat-intelligence reputation service is used in this prototype.",
                "The analyzer does not inspect email attachments or message body content."
            ],

            processedLocally: true,

            rawHeadersStored: false,

            analyzedAt: Date.now()
        };
    }

    // ---------------------------------------------------------
    // Public API
    // ---------------------------------------------------------

    window.LockLensEmailAnalyzer = {
        version: VERSION,
        analyzeHeaders
    };
})();