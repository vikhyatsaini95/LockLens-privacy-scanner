// ============================================================
// LockLens - Digital Footprint Activity Map 2.0
// ============================================================
//
// PRIVACY-FIRST DESIGN
//
// LockLens stores ONLY anonymous exposure metadata:
//
//   ✓ Timestamp
//   ✓ Detected privacy categories
//   ✓ Category count
//   ✓ Risk score
//   ✓ Risk level
//
// LockLens NEVER stores:
//
//   ✗ URL
//   ✗ Website/domain
//   ✗ Page title
//   ✗ Page content
//   ✗ Email values
//   ✗ Phone numbers
//   ✗ Addresses
//   ✗ Passwords
//   ✗ Typed form values
//   ✗ Keystrokes
//   ✗ Browsing history
//
// ============================================================

(() => {

    "use strict";


    // ========================================================
    // CONFIGURATION
    // ========================================================

    const VERSION = "2.0.0";

    const STORAGE_KEY =
        "lockLensExposureEvents";

    // Maximum number of exposure events stored locally.
    const MAX_EVENTS = 200;


    // ========================================================
    // ALLOWED PRIVACY CATEGORIES
    // ========================================================

    const ALLOWED_CATEGORIES = new Set([

        "name",
        "email",
        "phone",
        "address",
        "date",
        "password",
        "payment",
        "government_id",
        "location",
        "username"

    ]);


    // ========================================================
    // CREATE UNIQUE EVENT ID
    // ========================================================

    function generateEventId() {

        return (
            Date.now().toString(36)
            + "-"
            + Math.random()
                .toString(36)
                .substring(2, 8)
        );

    }


    // ========================================================
    // GET VALID CATEGORIES
    // ========================================================

    function getValidCategories(findings = []) {

        if (!Array.isArray(findings)) {

            return [];

        }


        const categories = findings
            .map(
                finding =>
                    finding?.category
            )
            .filter(
                category =>
                    ALLOWED_CATEGORIES.has(
                        category
                    )
            );


        return [
            ...new Set(categories)
        ];

    }


    // ========================================================
    // CREATE EXPOSURE EVENT
    // ========================================================
    //
    // This function creates the ONLY type of data that
    // LockLens should store in the Digital Footprint Map.
    //
    // ========================================================

    function createExposureEvent(
        findings = [],
        risk = {}
    ) {

        const categories =
            getValidCategories(
                findings
            );


        const score =
            Math.max(
                0,
                Math.min(
                    100,
                    Number(
                        risk?.score
                    ) || 0
                )
            );


        const allowedRiskLevels = [
            "Low",
            "Medium",
            "High",
            "Critical"
        ];


        const riskLevel =
            allowedRiskLevels.includes(
                risk?.level
            )
                ? risk.level
                : "Low";


        return {

            id:
                generateEventId(),

            timestamp:
                new Date().toISOString(),

            categories,

            categoryCount:
                categories.length,

            riskScore:
                score,

            riskLevel

        };

    }


    // ========================================================
    // SANITIZE EVENT
    // ========================================================
    //
    // This is an additional privacy layer.
    //
    // Even if another function accidentally passes extra
    // information, this function creates a clean object
    // containing ONLY approved fields.
    //
    // ========================================================

    function sanitizeEvent(event) {

        if (!event) {

            return null;

        }


        const categories =
            Array.isArray(
                event.categories
            )
                ? [
                    ...new Set(
                        event.categories.filter(
                            category =>
                                ALLOWED_CATEGORIES.has(
                                    category
                                )
                        )
                    )
                ]
                : [];


        const allowedRiskLevels = [
            "Low",
            "Medium",
            "High",
            "Critical"
        ];


        const score =
            Math.max(
                0,
                Math.min(
                    100,
                    Number(
                        event.riskScore
                    ) || 0
                )
            );


        const riskLevel =
            allowedRiskLevels.includes(
                event.riskLevel
            )
                ? event.riskLevel
                : "Low";


        return {

            id:
                typeof event.id === "string"
                    ? event.id
                    : generateEventId(),

            timestamp:
                typeof event.timestamp === "string"
                    ? event.timestamp
                    : new Date().toISOString(),

            categories,

            categoryCount:
                categories.length,

            riskScore:
                score,

            riskLevel

        };

    }


    // ========================================================
    // GET STORED EVENTS
    // ========================================================

    async function getExposureEvents() {

        try {

            const result =
                await chrome.storage.local.get(
                    [STORAGE_KEY]
                );


            if (
                !Array.isArray(
                    result[STORAGE_KEY]
                )
            ) {

                return [];

            }


            // Sanitize existing events as they are read.

            return result[STORAGE_KEY]
                .map(
                    event =>
                        sanitizeEvent(event)
                )
                .filter(Boolean);

        } catch (error) {

            console.error(
                "LockLens: unable to read exposure timeline.",
                error
            );

            return [];

        }

    }


    // ========================================================
    // SAVE EVENTS
    // ========================================================

    async function saveExposureEvents(
        events
    ) {

        try {

            await chrome.storage.local.set({

                [STORAGE_KEY]:
                    events

            });


            return true;

        } catch (error) {

            console.error(
                "LockLens: unable to save exposure timeline.",
                error
            );

            return false;

        }

    }


    // ========================================================
    // RECORD EXPOSURE
    // ========================================================

    async function recordExposure(
        findings = [],
        risk = {}
    ) {

        const categories =
            getValidCategories(
                findings
            );


        // Do not create an event when nothing
        // privacy-related was detected.

        if (
            categories.length === 0
        ) {

            return null;

        }


        const event =
            createExposureEvent(
                findings,
                risk
            );


        const existingEvents =
            await getExposureEvents();


        existingEvents.push(
            event
        );


        // Keep only the latest MAX_EVENTS.

        const trimmedEvents =
            existingEvents.length >
            MAX_EVENTS
                ? existingEvents.slice(
                    existingEvents.length -
                    MAX_EVENTS
                )
                : existingEvents;


        const success =
            await saveExposureEvents(
                trimmedEvents
            );


        if (!success) {

            return null;

        }


        return event;

    }


    // ========================================================
    // SECURE RECORD EXPOSURE
    // ========================================================
    //
    // Preferred public function.
    //
    // The event is created and sanitized before storage.
    //
    // ========================================================

    async function securelyRecordExposure(
        findings = [],
        risk = {}
    ) {

        return await recordExposure(
            findings,
            risk
        );

    }


    // ========================================================
    // SORT EVENTS
    // ========================================================

    function sortNewestFirst(
        events = []
    ) {

        if (!Array.isArray(events)) {

            return [];

        }


        return [...events].sort(
            (a, b) => {

                return (
                    new Date(
                        b.timestamp
                    ).getTime()
                    -
                    new Date(
                        a.timestamp
                    ).getTime()
                );

            }
        );

    }


    // ========================================================
    // GET TODAY'S EVENTS
    // ========================================================

    function getTodayEvents(
        events = []
    ) {

        if (!Array.isArray(events)) {

            return [];

        }


        const now =
            new Date();


        const currentYear =
            now.getFullYear();

        const currentMonth =
            now.getMonth();

        const currentDay =
            now.getDate();


        return events.filter(
            event => {

                const date =
                    new Date(
                        event.timestamp
                    );


                return (

                    date.getFullYear() ===
                        currentYear

                    &&

                    date.getMonth() ===
                        currentMonth

                    &&

                    date.getDate() ===
                        currentDay

                );

            }
        );

    }


    // ========================================================
    // GET EVENTS FOR LAST N DAYS
    // ========================================================

    function getRecentEvents(
        events = [],
        days = 7
    ) {

        if (!Array.isArray(events)) {

            return [];

        }


        const safeDays =
            Math.max(
                1,
                Number(days) || 7
            );


        const cutoff =
            Date.now()
            -
            (
                safeDays
                *
                24
                *
                60
                *
                60
                *
                1000
            );


        return events.filter(
            event => {

                const timestamp =
                    new Date(
                        event.timestamp
                    ).getTime();


                return timestamp >= cutoff;

            }
        );

    }


    // ========================================================
    // GENERATE SUMMARY
    // ========================================================

    function generateSummary(
        events = []
    ) {

        const safeEvents =
            Array.isArray(events)
                ? events
                : [];


        const summary = {

            totalEvents:
                safeEvents.length,

            todayEvents:
                getTodayEvents(
                    safeEvents
                ).length,

            categoryCounts: {},

            highRiskEvents:
                0,

            criticalRiskEvents:
                0,

            mediumRiskEvents:
                0,

            lowRiskEvents:
                0,

            averageRisk:
                0,

            highestRisk:
                0,

            totalRisk:
                0

        };


        let totalRisk = 0;


        safeEvents.forEach(
            event => {

                // --------------------------------------------
                // Category statistics
                // --------------------------------------------

                if (
                    Array.isArray(
                        event.categories
                    )
                ) {

                    event.categories.forEach(
                        category => {

                            if (
                                !summary
                                    .categoryCounts[
                                        category
                                    ]
                            ) {

                                summary
                                    .categoryCounts[
                                        category
                                    ] = 0;

                            }


                            summary
                                .categoryCounts[
                                    category
                                ]++;

                        }
                    );

                }


                // --------------------------------------------
                // Risk statistics
                // --------------------------------------------

                const score =
                    Number(
                        event.riskScore
                    ) || 0;


                totalRisk += score;


                summary.highestRisk =
                    Math.max(
                        summary.highestRisk,
                        score
                    );


                if (
                    event.riskLevel ===
                    "Critical"
                ) {

                    summary
                        .criticalRiskEvents++;

                }

                else if (
                    event.riskLevel ===
                    "High"
                ) {

                    summary
                        .highRiskEvents++;

                }

                else if (
                    event.riskLevel ===
                    "Medium"
                ) {

                    summary
                        .mediumRiskEvents++;

                }

                else {

                    summary
                        .lowRiskEvents++;

                }

            }
        );


        summary.totalRisk =
            totalRisk;


        if (
            safeEvents.length > 0
        ) {

            summary.averageRisk =
                Math.round(
                    totalRisk /
                    safeEvents.length
                );

        }


        return summary;

    }


    // ========================================================
    // GENERATE DAILY TREND
    // ========================================================

    function generateDailyTrend(
        events = []
    ) {

        if (!Array.isArray(events)) {

            return [];

        }


        const daily = {};


        events.forEach(
            event => {

                const date =
                    new Date(
                        event.timestamp
                    );


                if (
                    Number.isNaN(
                        date.getTime()
                    )
                ) {

                    return;

                }


                // YYYY-MM-DD

                const key =
                    date.toISOString()
                        .slice(
                            0,
                            10
                        );


                if (!daily[key]) {

                    daily[key] = {

                        date:
                            key,

                        events:
                            0,

                        totalRisk:
                            0,

                        highestRisk:
                            0,

                        categories:
                            new Set()

                    };

                }


                daily[key].events++;


                daily[key].totalRisk +=
                    Number(
                        event.riskScore
                    ) || 0;


                daily[key].highestRisk =
                    Math.max(
                        daily[key]
                            .highestRisk,

                        Number(
                            event.riskScore
                        ) || 0
                    );


                if (
                    Array.isArray(
                        event.categories
                    )
                ) {

                    event.categories
                        .forEach(
                            category => {

                                daily[key]
                                    .categories
                                    .add(
                                        category
                                    );

                            }
                        );

                }

            }
        );


        return Object.values(daily)
            .sort(
                (a, b) =>
                    a.date.localeCompare(
                        b.date
                    )
            )
            .map(
                day => ({

                    date:
                        day.date,

                    events:
                        day.events,

                    averageRisk:
                        day.events > 0
                            ? Math.round(
                                day.totalRisk /
                                day.events
                            )
                            : 0,

                    highestRisk:
                        day.highestRisk,

                    categories:
                        Array.from(
                            day.categories
                        )

                })
            );

    }


    // ========================================================
    // GET LATEST EVENT
    // ========================================================

    function getLatestEvent(
        events = []
    ) {

        if (
            !Array.isArray(events) ||
            events.length === 0
        ) {

            return null;

        }


        return sortNewestFirst(
            events
        )[0];

    }


    // ========================================================
    // GET RISK DISTRIBUTION
    // ========================================================

    function getRiskDistribution(
        events = []
    ) {

        const distribution = {

            Low: 0,

            Medium: 0,

            High: 0,

            Critical: 0

        };


        if (!Array.isArray(events)) {

            return distribution;

        }


        events.forEach(
            event => {

                if (
                    Object.prototype
                        .hasOwnProperty.call(
                            distribution,
                            event.riskLevel
                        )
                ) {

                    distribution[
                        event.riskLevel
                    ]++;

                }

            }
        );


        return distribution;

    }


    // ========================================================
    // GET CATEGORY DISTRIBUTION
    // ========================================================

    function getCategoryDistribution(
        events = []
    ) {

        const distribution = {};


        if (!Array.isArray(events)) {

            return distribution;

        }


        events.forEach(
            event => {

                if (
                    !Array.isArray(
                        event.categories
                    )
                ) {

                    return;

                }


                event.categories.forEach(
                    category => {

                        if (
                            !ALLOWED_CATEGORIES
                                .has(category)
                        ) {

                            return;

                        }


                        distribution[category] =
                            (
                                distribution[
                                    category
                                ] || 0
                            ) + 1;

                    }
                );

            }
        );


        return distribution;

    }


    // ========================================================
    // CLEAR TIMELINE
    // ========================================================

    async function clearExposureEvents() {

        try {

            await chrome.storage.local.remove(
                STORAGE_KEY
            );


            return true;

        } catch (error) {

            console.error(
                "LockLens: unable to clear exposure timeline.",
                error
            );

            return false;

        }

    }


    // ========================================================
    // EXPORT API
    // ========================================================

    window.LockLensTimeline = {

        version:
            VERSION,

        storageKey:
            STORAGE_KEY,

        maxEvents:
            MAX_EVENTS,

        categories:
            [...ALLOWED_CATEGORIES],

        recordExposure,

        securelyRecordExposure,

        createExposureEvent,

        sanitizeEvent,

        getExposureEvents,

        sortNewestFirst,

        getTodayEvents,

        getRecentEvents,

        getLatestEvent,

        generateSummary,

        generateDailyTrend,

        getRiskDistribution,

        getCategoryDistribution,

        clearExposureEvents

    };


})();