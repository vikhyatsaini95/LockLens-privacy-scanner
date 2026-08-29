function scanPageContent(text) {
    const findings = [];

    // Detect email-like patterns
    const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
    const emails = text.match(emailPattern) || [];

    if (emails.length > 0) {
        findings.push({
            type: "email",
            label: "Email-like information",
            count: new Set(emails).size,
            points: 15
        });
    }

    // Detect phone-number-like patterns
    const phonePattern = /\b(?:\+?\d{1,3}[\s-]?)?\d{10}\b/g;
    const phones = text.match(phonePattern) || [];

    if (phones.length > 0) {
        findings.push({
            type: "phone",
            label: "Phone-number-like information",
            count: new Set(phones).size,
            points: 20
        });
    }

    // Detect date-like patterns
    const datePattern = /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g;
    const dates = text.match(datePattern) || [];

    if (dates.length > 0) {
        findings.push({
            type: "date",
            label: "Date-like information",
            count: new Set(dates).size,
            points: 10
        });
    }

    return findings;
}