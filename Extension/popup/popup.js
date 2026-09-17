// ============================================================
// LockLens - Popup Controller 2.0
// ============================================================
//
// Responsibilities:
// 1. Scan the active webpage
// 2. Run the LockLens scanner
// 3. Calculate privacy risk
// 4. Save results locally
// 5. Record anonymous exposure timeline data
// 6. Control Privacy Guard
// 7. Open Dashboard
//
// Privacy:
// - No typed values are collected
// - No passwords are collected
// - No URLs/domains are stored in timeline
// - No raw personal data is sent to backend
// ============================================================


document.addEventListener("DOMContentLoaded", () => {

    // ========================================================
    // DOM ELEMENTS
    // ========================================================

    const scanButton =
        document.getElementById("scanButton");

    const dashboardButton =
        document.getElementById("dashboardButton");

    const privacyGuardButton =
        document.getElementById("privacyGuardButton");

    const guardStatus =
        document.getElementById("guardStatus");

    const status =
        document.getElementById("status");


    // ========================================================
    // BASIC STATUS FUNCTION
    // ========================================================

    function setStatus(message, className = "") {

        if (!status) {
            return;
        }

        status.textContent = message;

        status.className = className;

    }


    // ========================================================
    // PRIVACY GUARD UI
    // ========================================================

    function updateGuardUI(enabled) {

        if (guardStatus) {

            guardStatus.textContent = enabled
                ? "Privacy Guard is active on supported pages."
                : "Privacy Guard is currently off.";

        }


        if (privacyGuardButton) {

            privacyGuardButton.setAttribute(
                "aria-pressed",
                String(enabled)
            );

            const label = privacyGuardButton.querySelector("span:nth-child(2)");

            if (label) {
                label.textContent = enabled
                    ? "Disable Privacy Guard"
                    : "Enable Privacy Guard";
            }

        }

    }


    // ========================================================
    // LOAD PRIVACY GUARD STATE
    // ========================================================

    function loadGuardState() {

        chrome.storage.local.get(
            ["privacyGuardEnabled"],
            (result) => {

                const enabled =
                    result.privacyGuardEnabled !== false;

                updateGuardUI(enabled);

            }
        );

    }


    // ========================================================
    // PRIVACY GUARD TOGGLE
    // ========================================================

    if (privacyGuardButton) {

        privacyGuardButton.addEventListener(
            "click",
            () => {

                chrome.storage.local.get(
                    ["privacyGuardEnabled"],
                    (result) => {

                        const currentState =
                            result.privacyGuardEnabled !== false;

                        const newState =
                            !currentState;


                        chrome.storage.local.set(
                            {
                                privacyGuardEnabled:
                                    newState
                            },
                            () => {

                                updateGuardUI(
                                    newState
                                );

                                setStatus(
                                    newState
                                        ? "Privacy Guard enabled."
                                        : "Privacy Guard disabled.",
                                    "is-success"
                                );

                            }
                        );

                    }
                );

            }
        );

    }


    // ========================================================
    // DASHBOARD BUTTON
    // ========================================================

    if (dashboardButton) {

        dashboardButton.addEventListener(
            "click",
            () => {

                chrome.tabs.create({
                    url:
                        chrome.runtime.getURL(
                            "dashboard/dashboard.html"
                        )
                });

            }
        );

    }


    // ========================================================
    // SCAN BUTTON
    // ========================================================

    if (scanButton) {

        scanButton.addEventListener(
            "click",
            async () => {

                try {

                    // ----------------------------------------
                    // STEP 1 — UI
                    // ----------------------------------------

                    scanButton.disabled = true;

                    setStatus(
                        "Scanning page...",
                        "is-loading"
                    );


                    // ----------------------------------------
                    // STEP 2 — GET ACTIVE TAB
                    // ----------------------------------------

                    const tabs =
                        await chrome.tabs.query({
                            active: true,
                            currentWindow: true
                        });


                    if (
                        !tabs ||
                        tabs.length === 0
                    ) {

                        throw new Error(
                            "No active tab found."
                        );

                    }


                    const activeTab =
                        tabs[0];


                    if (!activeTab.id) {

                        throw new Error(
                            "Unable to access active tab."
                        );

                    }


                    // ----------------------------------------
                    // STEP 3 — CHECK RESTRICTED PAGES
                    // ----------------------------------------

                    const restrictedProtocols = [
                        "chrome:",
                        "edge:",
                        "about:",
                        "chrome-extension:",
                        "brave:"
                    ];


                    if (
                        activeTab.url &&
                        restrictedProtocols.some(
                            protocol =>
                                activeTab.url.startsWith(
                                    protocol
                                )
                        )
                    ) {

                        throw new Error(
                            "LockLens cannot scan this browser system page."
                        );

                    }


                    // ----------------------------------------
                    // STEP 4 — LOAD SCANNER INTO PAGE
                    // ----------------------------------------
                    //
                    // scanner.js runs in the webpage context.
                    //
                    // It analyzes:
                    // - visible page signals
                    // - form metadata
                    //
                    // It does NOT read field values.
                    //
                    // ----------------------------------------

                    const scannerState =
                        await chrome.scripting.executeScript({

                            target: {
                                tabId: activeTab.id
                            },

                            func: () => Boolean(window.LockLensScanner)

                        });


                    // Files injected with executeScript share the tab's
                    // extension world. Re-injecting scanner.js would redeclare
                    // its top-level constants and make subsequent scans fail.
                    if (!scannerState?.[0]?.result) {

                        await chrome.scripting.executeScript({

                            target: {
                                tabId: activeTab.id
                            },

                            files: [
                                "scripts/scanner.js"
                            ]

                        });

                    }


                    // ----------------------------------------
                    // STEP 5 — RUN COMPLETE PAGE SCAN
                    // ----------------------------------------

                    const scanResults =
                        await chrome.scripting.executeScript({

                            target: {
                                tabId: activeTab.id
                            },

                            func: () => {

                                if (
                                    !window.LockLensScanner
                                ) {

                                    throw new Error(
                                        "LockLens scanner is unavailable."
                                    );

                                }


                                const rawFindings =
                                    window.LockLensScanner
                                        .performFullScan(
                                            document
                                        );


                                return (
                                    window.LockLensScanner
                                        .deduplicateFindings(
                                            rawFindings
                                        )
                                );

                            }

                        });


                    // ----------------------------------------
                    // STEP 6 — GET FINDINGS
                    // ----------------------------------------

                    const findings =
                        scanResults?.[0]?.result || [];


                    // ----------------------------------------
                    // STEP 7 — CALCULATE RISK
                    // ----------------------------------------

                    if (
                        !window.LockLensRiskEngine
                    ) {

                        throw new Error(
                            "Risk Engine is not loaded in popup."
                        );

                    }


                    const risk =
                        window.LockLensRiskEngine
                            .calculateRisk(
                                findings
                            );
                    let recommendations = null;

                    if (
                        window.LockLensRecommendations
                    ) {
                        recommendations =
                            window.LockLensRecommendations
                                .generateRecommendations(
                                    findings,
                                    risk
                                );

                    }

                    // ----------------------------------------
                    // STEP 8 — SAVE CURRENT RESULT
                    // ----------------------------------------

                    await chrome.storage.local.set({

                        lockLensFindings:
                            findings,

                        lockLensRisk:
                            risk,

                        lockLensRecommendations:
                            recommendations,

                        lockLensLastScan:
                            new Date().toISOString()

                    });


                    // ----------------------------------------
                    // STEP 9 — RECORD TIMELINE EVENT
                    // ----------------------------------------
                    //
                    // Only anonymous metadata is stored.
                    //
                    // No URL.
                    // No domain.
                    // No page title.
                    // No typed values.
                    //
                    // ----------------------------------------

                    if (
                        window.LockLensTimeline &&
                        typeof
                            window.LockLensTimeline
                                .securelyRecordExposure
                            === "function"
                    ) {

                        await
                            window.LockLensTimeline
                                .securelyRecordExposure(
                                    findings,
                                    risk
                                );

                    }


                    // ----------------------------------------
                    // STEP 10 — SHOW RESULT
                    // ----------------------------------------

                    if (
                        findings.length === 0
                    ) {

                        setStatus(
                            "No supported privacy signals detected.",
                            "is-success"
                        );

                    } else {

                        setStatus(
                            `Analysis complete: ${risk.level} risk (${risk.score}/100).`,
                            "is-success"
                        );

                    }


                    // ----------------------------------------
                    // DEBUG INFORMATION
                    // ----------------------------------------

                    console.log(
                        "LockLens Findings:",
                        findings
                    );

                    console.log(
                        "LockLens Risk:",
                        risk
                    );

                } catch (error) {

                    // ----------------------------------------
                    // ERROR HANDLING
                    // ----------------------------------------

                    console.error(
                        "LockLens scan error:",
                        error
                    );


                    setStatus(
                        error.message ||
                        "Unable to scan this page.",
                        "is-error"
                    );

                } finally {

                    scanButton.disabled = false;

                }

            }
        );

    }


    // ========================================================
    // INITIALIZE
    // ========================================================

    loadGuardState();


    setStatus(
        "Ready to scan.",
        ""
    );

});
