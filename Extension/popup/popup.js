document.addEventListener("DOMContentLoaded", () => {

    // ==========================================
    // GET UI ELEMENTS
    // ==========================================
    const scanButton = document.getElementById("scanButton");
    const dashboardButton = document.getElementById("dashboardButton");
    const privacyGuardButton =
        document.getElementById("privacyGuardButton");

    const guardStatus = document.getElementById("guardStatus");
    const status = document.getElementById("status");
    const shell = document.querySelector(".popup-shell");
    const scanState = document.getElementById("scanState");


    // ==========================================
    // UPDATE STATUS MESSAGE
    // ==========================================
    const setStatus = (message, state = "") => {
        status.textContent = message;
        status.className = `status ${state}`;
    };


    // ==========================================
    // UPDATE PRIVACY GUARD UI
    // ==========================================
    const updateGuardUI = async () => {

        const { privacyGuardEnabled = false } =
            await chrome.storage.local.get("privacyGuardEnabled");

        const enabled = Boolean(privacyGuardEnabled);

        const guardLabel = privacyGuardButton.querySelector("span:nth-child(2)");
        const guardText =
            enabled
                ? "Disable Privacy Guard"
                : "Enable Privacy Guard";
        if (guardLabel) guardLabel.textContent = guardText;
        else privacyGuardButton.textContent = guardText;

        privacyGuardButton.setAttribute(
            "aria-pressed",
            String(enabled)
        );

        guardStatus.textContent =
            enabled
                ? "Privacy Guard is active on supported pages."
                : "Privacy Guard is currently off.";
        guardStatus.classList.toggle("is-active", enabled);
    };


    // ==========================================
    // SCAN CURRENT PAGE
    // ==========================================
    scanButton.addEventListener("click", async () => {

        scanButton.disabled = true;
        shell.classList.add("is-scanning");
        scanState.textContent = "ANALYZING";
        setStatus("Analyzing this page locally...");

        try {

            // --------------------------------------
            // GET ACTIVE TAB
            // --------------------------------------
            const [tab] = await chrome.tabs.query({
                active: true,
                currentWindow: true
            });

            if (!tab?.id) {
                throw new Error("No active tab");
            }


            // --------------------------------------
            // GET VISIBLE PAGE TEXT
            // --------------------------------------
            const [{ result: pageText = "" } = {}] =
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: () => document.body?.innerText || ""
                });


            // --------------------------------------
            // 1. SCAN VISIBLE PAGE CONTENT
            // --------------------------------------
            const textFindings =
                scanPageContent(pageText);


            // --------------------------------------
            // 2. SCAN FORM STRUCTURE
            //
            // IMPORTANT:
            // This checks only field metadata.
            // It NEVER reads field.value or typed data.
            // --------------------------------------
            const [{ result: formFindings = [] } = {}] =
                await chrome.scripting.executeScript({

                    target: { tabId: tab.id },

                    func: () => {

                        const findings = [];

                        const categories = {
                            name: false,
                            email: false,
                            phone: false,
                            address: false,
                            date: false,
                            password: false
                        };


                        // Get form-related fields
                        document
                            .querySelectorAll(
                                "input, textarea, select"
                            )
                            .forEach((field) => {

                                const type =
                                    (field.type || "")
                                        .toLowerCase();

                                const autocomplete =
                                    (field.autocomplete || "")
                                        .toLowerCase();


                                // Only inspect metadata.
                                // NEVER inspect field.value.
                                const metadata = [

                                    field.name,

                                    field.id,

                                    field.placeholder,

                                    field.getAttribute("aria-label"),

                                    autocomplete

                                ]
                                    .filter(Boolean)
                                    .join(" ")
                                    .toLowerCase();


                                // ======================
                                // 👤 NAME
                                // ======================
                                if (
                                    /\b(name|first-name|last-name|fullname)\b/
                                        .test(metadata) ||
                                    autocomplete.includes("name")
                                ) {
                                    categories.name = true;
                                }


                                // ======================
                                // 📧 EMAIL
                                // ======================
                                if (
                                    type === "email" ||
                                    metadata.includes("email")
                                ) {
                                    categories.email = true;
                                }


                                // ======================
                                // 📱 PHONE
                                // ======================
                                if (
                                    type === "tel" ||
                                    /phone|mobile|telephone/
                                        .test(metadata)
                                ) {
                                    categories.phone = true;
                                }


                                // ======================
                                // 🏠 ADDRESS
                                // ======================
                                if (
                                    /address|postcode|postal|zip|city|state/
                                        .test(metadata) ||
                                    autocomplete.includes(
                                        "street-address"
                                    )
                                ) {
                                    categories.address = true;
                                }


                                // ======================
                                // 📅 PERSONAL DATE
                                // ======================
                                if (
                                    type === "date" ||
                                    autocomplete.includes("bday")
                                ) {
                                    categories.date = true;
                                }


                                // ======================
                                // 🔐 PASSWORD FIELD
                                //
                                // Detect presence only.
                                // Never read the password.
                                // ======================
                                if (type === "password") {
                                    categories.password = true;
                                }

                            });


                        // ==================================
                        // CATEGORY WEIGHTS
                        // ==================================
                        const weights = {

                            name: {
                                label: "Name field requested",
                                points: 5
                            },

                            email: {
                                label: "Email field requested",
                                points: 10
                            },

                            phone: {
                                label: "Phone field requested",
                                points: 15
                            },

                            address: {
                                label: "Address field requested",
                                points: 20
                            },

                            date: {
                                label:
                                    "Personal date field requested",
                                points: 10
                            },

                            password: {
                                label: "Password field present",
                                points: 10
                            }

                        };


                        // Convert detected categories
                        // into findings
                        Object.entries(categories)
                            .forEach(([type, found]) => {

                                if (found) {

                                    findings.push({

                                        type,

                                        label: weights[type].label,

                                        points:
                                            weights[type].points,

                                        count: 1,

                                        source: "form"

                                    });
                                }

                            });


                        return findings;
                    }

                });


            // ==========================================
            // 3. MERGE TEXT + FORM FINDINGS
            //
            // Prevent duplicate categories from
            // receiving points twice.
            // ==========================================
            const mergedFindings = {};

            [...textFindings, ...formFindings]
                .forEach((finding) => {

                    if (!mergedFindings[finding.type]) {

                        mergedFindings[finding.type] = {
                            ...finding
                        };

                    } else {

                        // Combine detection counts
                        // but DO NOT double the points.
                        mergedFindings[finding.type].count +=
                            finding.count || 1;

                        mergedFindings[finding.type].source =
                            "page + form";
                    }

                });


            const findings =
                Object.values(mergedFindings);


            // ==========================================
            // 4. CALCULATE RISK
            // ==========================================
            const risk =
                calculateRisk(findings);


            // ==========================================
            // 5. SAVE CURRENT ANALYSIS LOCALLY
            // ==========================================
            await chrome.storage.local.set({

                lockLensFindings: findings,

                lockLensRisk: risk

            });


            // ==========================================
            // 6. UPDATE EXPOSURE TIMELINE
            // ==========================================
            await updateExposureTimeline(
                findings,
                risk
            );


            // ==========================================
            // SHOW RESULT
            // ==========================================
            setStatus(
                `Analysis complete: ${risk.level} risk (${risk.score}/100).`,
                "is-success"
            );

        } catch (error) {

            console.error(
                "LockLens scan error:",
                error
            );

            setStatus(
                "Scan failed. Try a regular webpage and reload the extension.",
                "is-error"
            );

        } finally {

            scanButton.disabled = false;
            shell.classList.remove("is-scanning");
            scanState.textContent = "READY";

        }

    });


    // ==========================================
    // PRIVACY GUARD TOGGLE
    // ==========================================
    privacyGuardButton.addEventListener(
        "click",
        async () => {

            privacyGuardButton.disabled = true;

            try {

                const {
                    privacyGuardEnabled = false
                } = await chrome.storage.local.get(
                    "privacyGuardEnabled"
                );

                await chrome.storage.local.set({
                    privacyGuardEnabled:
                        !privacyGuardEnabled
                });

                await updateGuardUI();

                setStatus(
                    !privacyGuardEnabled
                        ? "Privacy Guard enabled."
                        : "Privacy Guard disabled.",
                    "is-success"
                );

            } finally {

                privacyGuardButton.disabled = false;

            }

        }
    );


    // ==========================================
    // OPEN DASHBOARD
    // ==========================================
    dashboardButton.addEventListener(
        "click",
        () => {

            chrome.tabs.create({
                url: chrome.runtime.getURL(
                    "dashboard/dashboard.html"
                )
            });

        }
    );


    // ==========================================
    // INITIALIZE PRIVACY GUARD STATUS
    // ==========================================
    updateGuardUI();

});
