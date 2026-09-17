// ============================================================
// LockLens - Privacy Guard 2.0
// File: scripts/privacyGuard.js
//
// Privacy principles:
// - Never reads input.value
// - Never reads passwords
// - Never captures keystrokes
// - Never stores typed values
// - Never stores website/domain information
// - Only analyzes form metadata
// ============================================================

(() => {
    "use strict";

    // ============================================================
    // CONFIGURATION
    // ============================================================

    const STORAGE_KEY = "privacyGuardEnabled";
    const RESULT_KEY = "lockLensGuardLastResult";
    const WARNING_ID = "locklens-privacy-warning";

    let guardEnabled = true;
    let observer = null;
    let scanTimer = null;


    // ============================================================
    // DETECT SENSITIVE CATEGORIES
    // ============================================================

    function detectSensitiveCategories(element) {

        const categories = new Set();

        if (!element) {
            return categories;
        }

        // --------------------------------------------------------
        // IMPORTANT:
        // We ONLY inspect metadata.
        //
        // Never use:
        // element.value
        // element.textContent for form values
        // keydown/keyup/input listeners
        // --------------------------------------------------------

        const type = (
            element.getAttribute("type") || ""
        ).toLowerCase().trim();

        const name = (
            element.getAttribute("name") || ""
        ).toLowerCase().trim();

        const id = (
            element.getAttribute("id") || ""
        ).toLowerCase().trim();

        const placeholder = (
            element.getAttribute("placeholder") || ""
        ).toLowerCase().trim();

        const ariaLabel = (
            element.getAttribute("aria-label") || ""
        ).toLowerCase().trim();

        const autocomplete = (
            element.getAttribute("autocomplete") || ""
        ).toLowerCase().trim();

        const title = (
            element.getAttribute("title") || ""
        ).toLowerCase().trim();

        const metadata = [
            name,
            id,
            placeholder,
            ariaLabel,
            autocomplete,
            title
        ].join(" ");


        // ========================================================
        // NAME
        // ========================================================

        if (
            autocomplete.includes("name") ||
            /\b(name|first-name|first_name|last-name|last_name|fullname|full-name|full_name)\b/
                .test(metadata)
        ) {
            categories.add("Name");
        }


        // ========================================================
        // EMAIL
        // ========================================================

        if (
            type === "email" ||
            autocomplete.includes("email") ||
            /\b(email|e-mail|email-address|email_address)\b/
                .test(metadata)
        ) {
            categories.add("Email address");
        }


        // ========================================================
        // PHONE
        // ========================================================

        if (
            type === "tel" ||
            autocomplete.includes("tel") ||
            /\b(phone|mobile|telephone|contact-number|contact_number)\b/
                .test(metadata)
        ) {
            categories.add("Phone number");
        }


        // ========================================================
        // ADDRESS
        // ========================================================

        if (
            autocomplete.includes("street-address") ||
            autocomplete.includes("address-line") ||
            /\b(address|street|street-address|postcode|postal|zip|zipcode|zip-code|city|state|province)\b/
                .test(metadata)
        ) {
            categories.add("Address");
        }


        // ========================================================
        // PERSONAL DATE
        // ========================================================

        if (
            type === "date" ||
            autocomplete.includes("bday") ||
            autocomplete.includes("birth") ||
            /\b(dob|date-of-birth|date_of_birth|birth-date|birth_date|birthday|birthdate)\b/
                .test(metadata)
        ) {
            categories.add("Personal date");
        }


        // ========================================================
        // PASSWORD
        // ========================================================

        if (
            type === "password" ||
            autocomplete.includes("password") ||
            /\b(password|passwd|passcode|pwd)\b/
                .test(metadata)
        ) {
            categories.add("Password");
        }


        // ========================================================
        // PAYMENT
        // ========================================================

        if (
            autocomplete.includes("cc-number") ||
            autocomplete.includes("cc-exp") ||
            autocomplete.includes("cc-csc") ||
            /\b(card-number|card_number|credit-card|credit_card|cvv|cvc|card)\b/
                .test(metadata)
        ) {
            categories.add("Payment information");
        }


        // ========================================================
        // GOVERNMENT ID
        // ========================================================

        if (
            autocomplete.includes("government-id") ||
            /\b(aadhaar|pan|passport|government-id|government_id|national-id|national_id|driving-license|driving_license)\b/
                .test(metadata)
        ) {
            categories.add("Government ID");
        }


        // ========================================================
        // LOCATION
        // ========================================================

        if (
            autocomplete.includes("location") ||
            /\b(location|gps|latitude|longitude)\b/
                .test(metadata)
        ) {
            categories.add("Location");
        }


        // ========================================================
        // USERNAME
        // ========================================================

        if (
            autocomplete.includes("username") ||
            /\b(username|user-name|user_name|login-id|login_id|netid)\b/
                .test(metadata)
        ) {
            categories.add("Username");
        }


        return categories;
    }


    // ============================================================
    // SCAN PAGE
    // ============================================================

    function scanPage() {

        const categories = new Set();

        const fields = document.querySelectorAll(
            "input, textarea, select"
        );

        fields.forEach((field) => {

            const detected =
                detectSensitiveCategories(field);

            detected.forEach((category) => {
                categories.add(category);
            });

        });

        return Array.from(categories);
    }


    // ============================================================
    // RISK LEVEL
    // ============================================================

    function calculateGuardLevel(categories) {

        if (!categories || categories.length === 0) {
            return "Low";
        }

        const highRiskCategories = [
            "Password",
            "Payment information",
            "Government ID"
        ];

        const containsHighRisk =
            categories.some(category =>
                highRiskCategories.includes(category)
            );

        if (
            containsHighRisk ||
            categories.length >= 4
        ) {
            return "High";
        }

        if (categories.length >= 2) {
            return "Moderate";
        }

        return "Low";
    }


    // ============================================================
    // RISK DESCRIPTION
    // ============================================================

    function getRiskDescription(level) {

        switch (level) {

            case "High":
                return "This form appears to request highly sensitive information.";

            case "Moderate":
                return "This form appears to request multiple types of personal information.";

            case "Low":
                return "This form appears to request limited personal information.";

            default:
                return "No significant privacy signal was detected.";
        }
    }


    // ============================================================
    // SAVE LOCAL RESULT
    // ============================================================

    async function saveGuardResult(categories, level) {

        try {

            await chrome.storage.local.set({

                [RESULT_KEY]: {

                    categories: categories,

                    level: level,

                    timestamp: Date.now()

                }

            });

        } catch (error) {

            console.error(
                "LockLens Privacy Guard storage error:",
                error
            );

        }
    }


    // ============================================================
    // CREATE PRIVACY POPUP
    // ============================================================

    function createWarning(categories, level) {

        removeWarning();

        if (!guardEnabled) {
            return;
        }

        if (
            !categories ||
            categories.length === 0
        ) {
            return;
        }


        // --------------------------------------------------------
        // Overlay
        // --------------------------------------------------------

        const overlay =
            document.createElement("div");

        overlay.id = WARNING_ID;

        overlay.className =
            "locklens-guard-overlay";

        overlay.setAttribute(
            "role",
            "dialog"
        );

        overlay.setAttribute(
            "aria-modal",
            "true"
        );

        overlay.setAttribute(
            "aria-label",
            "LockLens Privacy Warning"
        );


        // --------------------------------------------------------
        // Card
        // --------------------------------------------------------

        const card =
            document.createElement("div");

        card.className =
            "locklens-guard-card";


        // --------------------------------------------------------
        // Header
        // --------------------------------------------------------

        const header =
            document.createElement("div");

        header.className =
            "locklens-guard-header";


        const titleArea =
            document.createElement("div");

        titleArea.className =
            "locklens-guard-title-area";


        const icon =
            document.createElement("div");

        icon.className =
            "locklens-guard-icon";

        icon.textContent = "🔒";


        const title =
            document.createElement("div");

        title.className =
            "locklens-guard-title";

        title.textContent =
            "LockLens Privacy Guard";


        const subtitle =
            document.createElement("div");

        subtitle.className =
            "locklens-guard-subtitle";

        subtitle.textContent =
            "Sensitive information request detected";


        titleArea.appendChild(title);
        titleArea.appendChild(subtitle);

        header.appendChild(icon);
        header.appendChild(titleArea);


        // --------------------------------------------------------
        // Close button
        // --------------------------------------------------------

        const closeButton =
            document.createElement("button");

        closeButton.type = "button";

        closeButton.className =
            "locklens-guard-close";

        closeButton.setAttribute(
            "aria-label",
            "Close privacy warning"
        );

        closeButton.textContent = "×";


        closeButton.addEventListener(
            "click",
            (event) => {

                event.preventDefault();

                event.stopPropagation();

                removeWarning();

            }
        );


        header.appendChild(closeButton);

        card.appendChild(header);


        // --------------------------------------------------------
        // Risk badge
        // --------------------------------------------------------

        const riskBadge =
            document.createElement("div");

        riskBadge.className =
            `locklens-guard-risk risk-${level.toLowerCase()}`;

        riskBadge.textContent =
            `● ${level} RISK`;

        card.appendChild(riskBadge);


        // --------------------------------------------------------
        // Explanation
        // --------------------------------------------------------

        const explanation =
            document.createElement("p");

        explanation.className =
            "locklens-guard-explanation";

        explanation.textContent =
            getRiskDescription(level);

        card.appendChild(explanation);


        // --------------------------------------------------------
        // Detected categories
        // --------------------------------------------------------

        const section =
            document.createElement("div");

        section.className =
            "locklens-guard-section";


        const sectionTitle =
            document.createElement("div");

        sectionTitle.className =
            "locklens-guard-section-title";

        sectionTitle.textContent =
            "Information categories detected";


        section.appendChild(sectionTitle);


        const categoriesContainer =
            document.createElement("div");

        categoriesContainer.className =
            "locklens-guard-categories";


        categories.forEach(category => {

            const badge =
                document.createElement("span");

            badge.className =
                "locklens-guard-category";

            badge.textContent =
                category;

            categoriesContainer.appendChild(badge);

        });


        section.appendChild(
            categoriesContainer
        );

        card.appendChild(section);


        // --------------------------------------------------------
        // Privacy explanation
        // --------------------------------------------------------

        const privacyBox =
            document.createElement("div");

        privacyBox.className =
            "locklens-guard-privacy";


        const privacyTitle =
            document.createElement("strong");

        privacyTitle.textContent =
            "🔐 Your data stays private";


        const privacyText =
            document.createElement("p");

        privacyText.textContent =
            "LockLens analyzes form structure and metadata only. It does not read, collect, or store the information you type.";


        privacyBox.appendChild(
            privacyTitle
        );

        privacyBox.appendChild(
            privacyText
        );

        card.appendChild(privacyBox);


        // --------------------------------------------------------
        // Action
        // --------------------------------------------------------

        const action =
            document.createElement("button");

        action.type = "button";

        action.className =
            "locklens-guard-understand";

        action.textContent =
            "I Understand";


        action.addEventListener(
            "click",
            (event) => {

                event.preventDefault();

                event.stopPropagation();

                removeWarning();

            }
        );


        card.appendChild(action);


        // --------------------------------------------------------
        // Add card to overlay
        // --------------------------------------------------------

        overlay.appendChild(card);


        // --------------------------------------------------------
        // Add to page
        // --------------------------------------------------------

        if (document.body) {

            document.body.appendChild(
                overlay
            );

        } else {

            document.documentElement.appendChild(
                overlay
            );

        }
    }


    // ============================================================
    // REMOVE POPUP
    // ============================================================

    function removeWarning() {

        const existing =
            document.getElementById(
                WARNING_ID
            );

        if (existing) {
            existing.remove();
        }
    }


    // ============================================================
    // RUN PRIVACY GUARD
    // ============================================================

    async function runPrivacyGuard() {

        if (!guardEnabled) {

            removeWarning();

            return;
        }


        const categories =
            scanPage();


        const level =
            calculateGuardLevel(
                categories
            );


        await saveGuardResult(
            categories,
            level
        );


        if (
            categories.length > 0
        ) {

            createWarning(
                categories,
                level
            );

        } else {

            removeWarning();

        }
    }


    // ============================================================
    // DEBOUNCED SCAN
    // ============================================================

    function scheduleScan() {

        clearTimeout(scanTimer);

        scanTimer = setTimeout(() => {

            runPrivacyGuard();

        }, 300);
    }


    // ============================================================
    // OBSERVE DYNAMIC FORMS
    // ============================================================

    function startObserver() {

        if (observer) {
            return;
        }

        if (!document.documentElement) {
            return;
        }


        observer =
            new MutationObserver(
                (mutations) => {

                    let formAdded =
                        false;


                    for (
                        const mutation
                        of mutations
                    ) {

                        if (
                            mutation.type !==
                            "childList"
                        ) {
                            continue;
                        }


                        for (
                            const node
                            of mutation.addedNodes
                        ) {

                            if (
                                node.nodeType !==
                                Node.ELEMENT_NODE
                            ) {
                                continue;
                            }


                            if (
                                node.matches?.(
                                    "input, textarea, select, form"
                                ) ||
                                node.querySelector?.(
                                    "input, textarea, select, form"
                                )
                            ) {

                                formAdded =
                                    true;

                                break;
                            }
                        }


                        if (formAdded) {
                            break;
                        }
                    }


                    if (formAdded) {
                        scheduleScan();
                    }

                }
            );


        observer.observe(
            document.documentElement,
            {
                childList: true,
                subtree: true
            }
        );
    }


    // ============================================================
    // STORAGE LISTENER
    // ============================================================

    function setupStorageListener() {

        if (
            !chrome.storage ||
            !chrome.storage.onChanged
        ) {
            return;
        }


        chrome.storage.onChanged.addListener(
            (
                changes,
                areaName
            ) => {

                if (
                    areaName !==
                    "local"
                ) {
                    return;
                }


                if (
                    !changes[STORAGE_KEY]
                ) {
                    return;
                }


                guardEnabled =
                    changes[
                        STORAGE_KEY
                    ].newValue !== false;


                if (guardEnabled) {

                    runPrivacyGuard();

                    startObserver();

                } else {

                    removeWarning();

                }

            }
        );
    }


    // ============================================================
    // LOAD GUARD STATE
    // ============================================================

    async function loadGuardState() {

        try {

            const result =
                await chrome.storage.local.get(
                    STORAGE_KEY
                );


            guardEnabled =
                result[
                    STORAGE_KEY
                ] !== false;


        } catch (error) {

            console.error(
                "LockLens Privacy Guard state error:",
                error
            );

            guardEnabled = true;
        }
    }


    // ============================================================
    // INITIALIZE
    // ============================================================

    async function initialize() {

        await loadGuardState();

        setupStorageListener();


        if (!guardEnabled) {

            removeWarning();

            return;
        }


        // Initial scan
        await runPrivacyGuard();


        // Dynamic forms
        startObserver();

    }


    // ============================================================
    // START
    // ============================================================

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            initialize,
            {
                once: true
            }
        );

    } else {

        initialize();

    }

})();