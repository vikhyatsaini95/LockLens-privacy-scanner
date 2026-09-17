// ============================================================
// LockLens - Comprehensive Privacy Exposure Scanner
// ============================================================
// Privacy principle:
// - Never read typed sensitive values
// - Never capture passwords
// - Never capture keystrokes
// - Never transmit raw personal data
// - Analyze only visible page signals + form metadata
// ============================================================

const LOCKLENS_VERSION = "2.0.0";

/**
 * Privacy categories supported by LockLens.
 */
const PRIVACY_CATEGORIES = {
    NAME: "name",
    EMAIL: "email",
    PHONE: "phone",
    ADDRESS: "address",
    DATE: "date",
    PASSWORD: "password",
    PAYMENT: "payment",
    GOVERNMENT_ID: "government_id",
    LOCATION: "location",
    USERNAME: "username"
};


/**
 * Convert a value into a safe searchable string.
 *
 * We only inspect metadata supplied to this function.
 */
function normalizeText(value) {
    if (!value) return "";

    return String(value)
        .toLowerCase()
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}


/**
 * Create a finding.
 */
function createFinding(category, points, source, confidence, description) {
    return {
        category,
        points,
        source,
        confidence,
        description
    };
}


/**
 * ============================================================
 * PAGE CONTENT SCANNER
 * ============================================================
 *
 * Scans visible page text for privacy-related patterns.
 *
 * IMPORTANT:
 * This does not scan browser history, cookies, storage,
 * passwords, or user-entered form values.
 */
function scanPageContent(text) {

    const findings = [];

    if (!text || typeof text !== "string") {
        return findings;
    }

    // Limit processing size for performance.
    const pageText = text.slice(0, 500000);

    // --------------------------------------------------------
    // Email
    // --------------------------------------------------------

    const emailRegex =
        /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

    if (emailRegex.test(pageText)) {

        findings.push(
            createFinding(
                PRIVACY_CATEGORIES.EMAIL,
                10,
                "page_content",
                "high",
                "An email-address pattern is visible on the page."
            )
        );
    }


    // --------------------------------------------------------
    // Phone
    // --------------------------------------------------------

    const phoneRegex =
        /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3}[\s.-]?\d{4}\b/g;

    if (phoneRegex.test(pageText)) {

        findings.push(
            createFinding(
                PRIVACY_CATEGORIES.PHONE,
                15,
                "page_content",
                "medium",
                "A phone-number pattern is visible on the page."
            )
        );
    }


    // --------------------------------------------------------
    // Date
    // --------------------------------------------------------

    const dateRegex =
        /\b(?:\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}[\/-]\d{1,2}[\/-]\d{1,2})\b/g;

    if (dateRegex.test(pageText)) {

        findings.push(
            createFinding(
                PRIVACY_CATEGORIES.DATE,
                10,
                "page_content",
                "medium",
                "A date pattern is visible on the page."
            )
        );
    }


    // --------------------------------------------------------
    // Address-related language
    // --------------------------------------------------------

    const addressKeywords = [
        "street address",
        "home address",
        "residential address",
        "billing address",
        "shipping address",
        "postal address",
        "address"
    ];

    if (containsKeyword(pageText, addressKeywords)) {

        findings.push(
            createFinding(
                PRIVACY_CATEGORIES.ADDRESS,
                20,
                "page_content",
                "medium",
                "The page contains language requesting address information."
            )
        );
    }


    // --------------------------------------------------------
    // Name-related language
    // --------------------------------------------------------

    const nameKeywords = [
        "full name",
        "first name",
        "last name",
        "your name",
        "name"
    ];

    if (containsKeyword(pageText, nameKeywords)) {

        findings.push(
            createFinding(
                PRIVACY_CATEGORIES.NAME,
                5,
                "page_content",
                "low",
                "The page contains language requesting name information."
            )
        );
    }


    // --------------------------------------------------------
    // Username
    // --------------------------------------------------------

    const usernameKeywords = [
        "username",
        "user name",
        "screen name",
        "handle"
    ];

    if (containsKeyword(pageText, usernameKeywords)) {

        findings.push(
            createFinding(
                PRIVACY_CATEGORIES.USERNAME,
                5,
                "page_content",
                "medium",
                "The page contains language associated with usernames."
            )
        );
    }


    // --------------------------------------------------------
    // Location
    // --------------------------------------------------------

    const locationKeywords = [
        "location",
        "current location",
        "home location",
        "live location",
        "gps location"
    ];

    if (containsKeyword(pageText, locationKeywords)) {

        findings.push(
            createFinding(
                PRIVACY_CATEGORIES.LOCATION,
                15,
                "page_content",
                "medium",
                "The page contains language associated with location information."
            )
        );
    }


    // --------------------------------------------------------
    // Payment
    // --------------------------------------------------------

    const paymentKeywords = [
        "credit card",
        "debit card",
        "card number",
        "cvv",
        "billing information",
        "payment information"
    ];

    if (containsKeyword(pageText, paymentKeywords)) {

        findings.push(
            createFinding(
                PRIVACY_CATEGORIES.PAYMENT,
                20,
                "page_content",
                "high",
                "The page contains payment-information indicators."
            )
        );
    }


    // --------------------------------------------------------
    // Government ID
    // --------------------------------------------------------

    const governmentIdKeywords = [
        "government id",
        "national id",
        "identity number",
        "passport number",
        "driver license",
        "driving licence",
        "aadhaar",
        "pan number"
    ];

    if (containsKeyword(pageText, governmentIdKeywords)) {

        findings.push(
            createFinding(
                PRIVACY_CATEGORIES.GOVERNMENT_ID,
                25,
                "page_content",
                "high",
                "The page contains government-identity information indicators."
            )
        );
    }


    return findings;
}


/**
 * ============================================================
 * FORM STRUCTURE SCANNER
 * ============================================================
 *
 * IMPORTANT:
 * We inspect only:
 *
 * name
 * id
 * placeholder
 * aria-label
 * autocomplete
 * type
 *
 * We DO NOT inspect:
 *
 * field.value
 * password contents
 * keystrokes
 */
function scanFormStructure(root = document) {

    const findings = [];

    const fields = root.querySelectorAll(
        "input, textarea, select"
    );


    fields.forEach((field) => {

        const metadata = [
            field.getAttribute("name"),
            field.getAttribute("id"),
            field.getAttribute("placeholder"),
            field.getAttribute("aria-label"),
            field.getAttribute("autocomplete"),
            field.getAttribute("type")
        ]
            .filter(Boolean)
            .map(normalizeText)
            .join(" ");


        if (!metadata) {
            return;
        }


        // ----------------------------------------------------
        // Password
        // ----------------------------------------------------

        if (
            field.type === "password" ||
            containsKeyword(metadata, [
                "password",
                "passcode",
                "pin"
            ])
        ) {

            findings.push(
                createFinding(
                    PRIVACY_CATEGORIES.PASSWORD,
                    10,
                    "form_structure",
                    "high",
                    "A password or authentication field is present. LockLens never reads its value."
                )
            );

            return;
        }


        // ----------------------------------------------------
        // Government ID
        // ----------------------------------------------------

        if (
            containsKeyword(metadata, [
                "aadhaar",
                "pan",
                "passport",
                "national id",
                "government id",
                "identity number",
                "license number",
                "licence number"
            ])
        ) {

            findings.push(
                createFinding(
                    PRIVACY_CATEGORIES.GOVERNMENT_ID,
                    25,
                    "form_structure",
                    "high",
                    "A government-identity field is present."
                )
            );
        }


        // ----------------------------------------------------
        // Payment
        // ----------------------------------------------------

        if (
            containsKeyword(metadata, [
                "card number",
                "credit card",
                "debit card",
                "cvv",
                "cvc",
                "expiry",
                "expiration",
                "payment"
            ])
        ) {

            findings.push(
                createFinding(
                    PRIVACY_CATEGORIES.PAYMENT,
                    20,
                    "form_structure",
                    "high",
                    "A payment-information field is present."
                )
            );
        }


        // ----------------------------------------------------
        // Email
        // ----------------------------------------------------

        if (
            field.type === "email" ||
            containsKeyword(metadata, [
                "email",
                "e mail"
            ])
        ) {

            findings.push(
                createFinding(
                    PRIVACY_CATEGORIES.EMAIL,
                    10,
                    "form_structure",
                    "high",
                    "An email field is present."
                )
            );
        }


        // ----------------------------------------------------
        // Phone
        // ----------------------------------------------------

        if (
            field.type === "tel" ||
            containsKeyword(metadata, [
                "phone",
                "mobile",
                "telephone",
                "contact number"
            ])
        ) {

            findings.push(
                createFinding(
                    PRIVACY_CATEGORIES.PHONE,
                    15,
                    "form_structure",
                    "high",
                    "A phone-number field is present."
                )
            );
        }


        // ----------------------------------------------------
        // Address
        // ----------------------------------------------------

        if (
            containsKeyword(metadata, [
                "address",
                "street",
                "postal",
                "postcode",
                "zip code",
                "pincode",
                "city",
                "state"
            ])
        ) {

            findings.push(
                createFinding(
                    PRIVACY_CATEGORIES.ADDRESS,
                    20,
                    "form_structure",
                    "medium",
                    "An address-related field is present."
                )
            );
        }


        // ----------------------------------------------------
        // Name
        // ----------------------------------------------------

        if (
            containsKeyword(metadata, [
                "full name",
                "first name",
                "last name",
                "given name",
                "family name"
            ])
        ) {

            findings.push(
                createFinding(
                    PRIVACY_CATEGORIES.NAME,
                    5,
                    "form_structure",
                    "medium",
                    "A name field is present."
                )
            );
        }


        // ----------------------------------------------------
        // Username
        // ----------------------------------------------------

        if (
            containsKeyword(metadata, [
                "username",
                "user name",
                "screen name",
                "handle"
            ])
        ) {

            findings.push(
                createFinding(
                    PRIVACY_CATEGORIES.USERNAME,
                    5,
                    "form_structure",
                    "medium",
                    "A username field is present."
                )
            );
        }


        // ----------------------------------------------------
        // Location
        // ----------------------------------------------------

        if (
            containsKeyword(metadata, [
                "location",
                "latitude",
                "longitude",
                "gps",
                "geolocation"
            ])
        ) {

            findings.push(
                createFinding(
                    PRIVACY_CATEGORIES.LOCATION,
                    15,
                    "form_structure",
                    "medium",
                    "A location-related field is present."
                )
            );
        }


        // ----------------------------------------------------
        // Date
        // ----------------------------------------------------

        if (
            field.type === "date" ||
            containsKeyword(metadata, [
                "date of birth",
                "dob",
                "birth date",
                "birthday"
            ])
        ) {

            findings.push(
                createFinding(
                    PRIVACY_CATEGORIES.DATE,
                    10,
                    "form_structure",
                    "high",
                    "A personal-date field is present."
                )
            );
        }

    });


    return findings;
}


/**
 * ============================================================
 * HELPER
 * ============================================================
 */
function containsKeyword(text, keywords) {

    const normalized = normalizeText(text);

    return keywords.some((keyword) =>
        normalized.includes(normalizeText(keyword))
    );
}


/**
 * ============================================================
 * COMPLETE PAGE SCAN
 * ============================================================
 *
 * Combines:
 *
 * 1. Visible page analysis
 * 2. Form metadata analysis
 */
function performFullScan(root = document) {

    const pageText =
        root.body?.innerText || "";

    const pageFindings =
        scanPageContent(pageText);

    const formFindings =
        scanFormStructure(root);

    return [
        ...pageFindings,
        ...formFindings
    ];
}


/**
 * ============================================================
 * DEDUPLICATION
 * ============================================================
 *
 * A category should not be counted multiple times merely
 * because the page contains several fields of the same type.
 *
 * Example:
 *
 * email field
 * + another email field
 *
 * = one EMAIL category finding.
 */
function deduplicateFindings(findings) {

    const map = new Map();

    findings.forEach((finding) => {

        const existing =
            map.get(finding.category);

        if (!existing) {

            map.set(
                finding.category,
                {
                    ...finding
                }
            );

            return;
        }


        // Keep the stronger source.
        if (
            finding.confidence === "high" &&
            existing.confidence !== "high"
        ) {

            existing.confidence =
                finding.confidence;

            existing.description =
                finding.description;
        }


        // If either source is form_structure,
        // preserve the stronger explanation.
        if (
            finding.source === "form_structure"
        ) {

            existing.source =
                "page_and_form";
        }

    });


    return Array.from(map.values());
}


/**
 * ============================================================
 * EXPORT
 * ============================================================
 *
 * Makes the scanner available to other LockLens scripts.
 */
if (typeof window !== "undefined") {

    window.LockLensScanner = {

        version: LOCKLENS_VERSION,

        categories: PRIVACY_CATEGORIES,

        scanPageContent,

        scanFormStructure,

        performFullScan,

        deduplicateFindings

    };
}