// LockLens Privacy Guard: inspect form metadata only, never form values or keystrokes.
(() => {
    const warningId = "locklens-privacy-warning";
    let scheduled = false;
    let dismissedSignature = null;

    const detectRequestedCategories = () => {
        const categories = new Set();
        document.querySelectorAll("input, textarea, select").forEach((field) => {
            const type = (field.type || "").toLowerCase();
            const autocomplete = (field.autocomplete || "").toLowerCase();
            const metadata = [field.name, field.id, autocomplete, field.placeholder, field.getAttribute("aria-label")]
                .filter(Boolean).join(" ").toLowerCase();
            if (type === "email" || metadata.includes("email")) categories.add("Email address");
            if (type === "tel" || /phone|mobile|telephone/.test(metadata)) categories.add("Phone number");
            if (/address|postcode|postal|zip/.test(metadata) || autocomplete.includes("street-address")) categories.add("Address");
            if (/\b(name|first-name|last-name|fullname)\b/.test(metadata) || autocomplete.includes("name")) categories.add("Name");
            if (type === "date" || autocomplete.includes("bday")) categories.add("Personal date");
            if (type === "password") categories.add("Password field");
        });
        return [...categories];
    };

    const levelFor = (categories) => categories.includes("Password field") || categories.length >= 4
        ? "high" : categories.length >= 2 ? "moderate" : "low";
    const removeWarning = () => document.getElementById(warningId)?.remove();

    const dismissWarning = (signature) => {
        dismissedSignature = signature;
        removeWarning();
    };

    const showWarning = (categories, level) => {
        const signature = categories.join("|");
        const existing = document.getElementById(warningId);
        if (!categories.length || dismissedSignature === signature || existing?.dataset.signature === signature) return;
        removeWarning();

        const banner = document.createElement("aside");
        banner.id = warningId;
        banner.dataset.level = level;
        banner.dataset.signature = signature;
        banner.setAttribute("role", "alert");
        banner.setAttribute("aria-live", "polite");

        const content = document.createElement("div");
        content.className = "locklens-warning-content";
        const copy = document.createElement("div");
        const heading = document.createElement("strong");
        const summary = document.createElement("p");
        const note = document.createElement("small");
        const dismiss = document.createElement("button");
        heading.textContent = "LockLens Privacy Guard";
        summary.textContent = `This page requests: ${categories.join(", ")}. Review whether each item is necessary before submitting.`;
        note.textContent = "LockLens checks field labels and types only. Typed values are never read or stored.";
        dismiss.id = "locklens-dismiss-warning";
        dismiss.type = "button";
        dismiss.setAttribute("aria-label", "Close privacy warning");
        dismiss.textContent = String.fromCharCode(215);
        dismiss.addEventListener("click", () => dismissWarning(signature));

        copy.append(heading, summary, note);
        content.append(copy, dismiss);
        banner.append(content);
        document.documentElement.append(banner);
    };

    const runPrivacyGuard = async () => {
        const { privacyGuardEnabled = false } = await chrome.storage.local.get("privacyGuardEnabled");
        if (!privacyGuardEnabled) {
            dismissedSignature = null;
            removeWarning();
            return;
        }
        const categories = detectRequestedCategories();
        const signature = categories.join("|");
        if (dismissedSignature && dismissedSignature !== signature) dismissedSignature = null;
        const level = levelFor(categories);
        showWarning(categories, level);
        await chrome.storage.local.set({ lockLensGuardLastResult: { categories, level, timestamp: Date.now(), page: location.hostname } });
    };

    const scheduleRun = () => {
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(() => { scheduled = false; runPrivacyGuard(); });
    };

    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === "local" && changes.privacyGuardEnabled) scheduleRun();
    });
    new MutationObserver(scheduleRun).observe(document.documentElement, { childList: true, subtree: true });
    runPrivacyGuard();
})();
