/**
 * Shared email classification used by Brevo cleanup and CSV cleaning.
 * Categories: KEEP | REVIEW | REMOVE
 */

const REMOVE_LOCAL_PARTS = new Set([
    "noreply",
    "no-reply",
    "no_reply",
    "donotreply",
    "do-not-reply",
    "do_not_reply",
    "notifications",
    "notification",
    "mailer",
    "mailers",
    "automated",
    "automation",
    "system",
    "alerts",
    "alert",
    "security",
    "bounce",
    "bounces",
    "daemon",
    "postmaster",
    "webmaster",
    "wordpress",
    "newsletter",
    "newsletters",
    "updates",
    "update",
    "billing",
    "invoices",
    "invoice",
    "receipts",
    "receipt",
    "orders",
    "order",
    "tracking",
    "unsubscribe",
    "invitations",
    "pageupdates",
    "reminders",
]);

const REVIEW_LOCAL_PARTS = new Set([
    "info",
    "information",
    "contact",
    "hello",
    "hi",
    "office",
    "admin",
    "administrator",
    "support",
    "help",
    "helpdesk",
    "sales",
    "marketing",
    "business",
    "team",
    "service",
    "customerservice",
    "customer.service",
    "customersupport",
    "customer.support",
    "care",
    "enquiries",
    "enquiry",
    "inquiries",
    "inquiry",
    "reception",
    "onboarding",
    "events",
    "news",
    "announcements",
    "press",
    "media",
    "partners",
    "partnerships",
]);

const STRONG_REMOVE_WORDS = [
    "noreply",
    "no-reply",
    "no_reply",
    "donotreply",
    "do-not-reply",
    "do_not_reply",
    "notification",
    "notifications",
    "automated",
    "automation",
    "mailer",
    "system",
    "alerts",
    "bounce",
    "unsubscribe",
];

const DISPOSABLE_DOMAINS = new Set([
    "mailinator.com",
    "guerrillamail.com",
    "10minutemail.com",
    "tempmail.com",
    "temp-mail.org",
    "yopmail.com",
    "sharklasers.com",
    "guerrillamailblock.com",
    "getnada.com",
    "trashmail.com",
    "maildrop.cc",
    "dispostable.com",
    "tmail.com",
    "test.com",
    "example.com",
    "example.org",
    "example.net",
    "localhost",
    "invalid",
    "local",
]);

const REMOVE_EXACT_DOMAINS = new Set([
    "offline-members-wix.com",
    "wixforms.com",
    "wixsiteautomations.com",
    "facebookmail.com",
    "quora.com",
    "linkedin.com",
    "mailchimp.com",
    "send.zapier.com",
    "notice.alibaba.com",
    "service.alibaba.com",
    "engage.canva.com",
    "email.submittable.com",
    "newsletter.zeffy.com",
    "marketing.descript.com",
    "mail.descript.com",
    "notifications.intuit.com",
    "notification.intuit.com",
    "mkt.intuit.com",
    "eq.intuit.com",
    "appcenter.intuit.com",
    "quickbooks.intuit.com",
    "notifications.t-mobile.com",
    "feedback.t-mobile.com",
    "tmobiz.t-mobile.com",
    "e.godaddy.com",
    "e.techsoup.org",
    "email.aarp.org",
    "email.anthropic.com",
    "email.alibaba.com",
    "email.upwork.com",
    "email.musicarts.com",
    "t.upwork.com",
    "mail-relay.blinq.me",
    "blog.wixnotifications.com",
    "emails.wix.com",
    "messages.wix.com",
    "notification.wix.com",
    "notifications.wix.com",
    "team.wix.com",
    "mail.beehiiv.com",
    "mailgun.waiverforever.com",
    "notifybf2.hubspot.com",
    "pb07.wixemails.com",
    "communications.paypal.com",
]);

const REMOVE_DOMAIN_SUFFIXES = [
    ".myactivecampaign.com",
    ".mailchimpapp.com",
    ".wixemails.com",
    ".wixnotifications.com",
    ".mailchimp.com",
    ".sendgrid.net",
    ".amazonses.com",
    ".mailgun.org",
    ".intercom-mail.com",
    ".klaviyomail.com",
];

const REMOVE_DOMAIN_CONTAINS = [
    "offline-members-wix",
    "wixforms",
    "wixsiteautomations",
    "wixnotifications",
    "wixemails",
    "mailchimpapp",
    "myactivecampaign",
    "facebookmail",
    "mail-relay",
    "privaterelay.appleid",
];

const REMOVE_SUBDOMAIN_PREFIXES = [
    "notifications.",
    "notification.",
    "noreply.",
    "no-reply.",
    "donotreply.",
    "bounce.",
    "bounces.",
    "mailer.",
    "email.",
    "emails.",
    "newsletter.",
    "newsletters.",
    "marketing.",
    "engage.",
    "notice.",
    "send.",
    "updates.",
    "messages.",
    "em.",
    "e.",
];

const UUID_LOCAL_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const NOREPLY_IN_LOCAL_RE =
    /(^|[+._-])(no[_-]?reply|do[_-]?not[_-]?reply|donotreply)([+._-]|$)/;

function domainMatchesRemoveRules(domain) {
    if (REMOVE_EXACT_DOMAINS.has(domain)) {
        return `Platform/system domain: ${domain}`;
    }

    for (const suffix of REMOVE_DOMAIN_SUFFIXES) {
        if (domain.endsWith(suffix) || domain === suffix.slice(1)) {
            return `Platform/system domain suffix: ${suffix}`;
        }
    }

    for (const piece of REMOVE_DOMAIN_CONTAINS) {
        if (domain.includes(piece)) {
            return `Platform/system domain pattern: ${piece}`;
        }
    }

    for (const prefix of REMOVE_SUBDOMAIN_PREFIXES) {
        if (domain.startsWith(prefix)) {
            return `Marketing/notification subdomain: ${prefix}*`;
        }
    }

    return null;
}

function classifyEmail(email) {
    if (!email || typeof email !== "string") {
        return {
            category: "REMOVE",
            reason: "Missing email",
        };
    }

    email = email.trim().toLowerCase();

    const parts = email.split("@");

    if (parts.length !== 2 || !parts[0] || !parts[1]) {
        return {
            category: "REMOVE",
            reason: "Invalid email format",
        };
    }

    const local = parts[0];
    const domain = parts[1];

    if (DISPOSABLE_DOMAINS.has(domain)) {
        return {
            category: "REMOVE",
            reason: "Disposable/fake email domain",
        };
    }

    const domainReason = domainMatchesRemoveRules(domain);
    if (domainReason) {
        return {
            category: "REMOVE",
            reason: domainReason,
        };
    }

    if (UUID_LOCAL_RE.test(local)) {
        return {
            category: "REMOVE",
            reason: "UUID/machine-generated mailbox",
        };
    }

    if (
        local.startsWith("reply-to+") ||
        local.startsWith("reply+") ||
        local.startsWith("connect+")
    ) {
        return {
            category: "REMOVE",
            reason: "Form/relay reply address",
        };
    }

    if (NOREPLY_IN_LOCAL_RE.test(local)) {
        return {
            category: "REMOVE",
            reason: "Noreply/do-not-reply mailbox",
        };
    }

    if (
        domain === "quora.com" ||
        local.endsWith("-space") ||
        local.endsWith("-digest") ||
        local.includes("-quora-digest")
    ) {
        if (domain === "quora.com" || local.includes("quora")) {
            return {
                category: "REMOVE",
                reason: "Quora digest/space mailbox",
            };
        }
    }

    if (REMOVE_LOCAL_PARTS.has(local)) {
        return {
            category: "REMOVE",
            reason: `Automated/system mailbox: ${local}`,
        };
    }

    for (const word of STRONG_REMOVE_WORDS) {
        if (
            local === word ||
            local.startsWith(`${word}.`) ||
            local.startsWith(`${word}-`) ||
            local.startsWith(`${word}_`) ||
            local.endsWith(`-${word}`) ||
            local.endsWith(`.${word}`) ||
            local.endsWith(`_${word}`) ||
            local.includes(`-${word}-`) ||
            local.includes(`.${word}.`) ||
            local.includes(`_${word}_`) ||
            local.includes(`+${word}`)
        ) {
            return {
                category: "REMOVE",
                reason: `Automated/system pattern: ${word}`,
            };
        }
    }

    if (REVIEW_LOCAL_PARTS.has(local)) {
        return {
            category: "REVIEW",
            reason: `Generic/role mailbox: ${local}`,
        };
    }

    const genericPatterns = [
        /^support\d*$/,
        /^sales\d*$/,
        /^info\d*$/,
        /^contact\d*$/,
        /^admin\d*$/,
        /^help\d*$/,
        /^service\d*$/,
        /^marketing\d*$/,
        /^team\d*$/,
        /^office\d*$/,
        /^news\d*$/,
        /^events\d*$/,
    ];

    if (genericPatterns.some((pattern) => pattern.test(local))) {
        return {
            category: "REVIEW",
            reason: `Generic role mailbox: ${local}`,
        };
    }

    return {
        category: "KEEP",
        reason: "Looks like an individual mailbox",
    };
}

module.exports = { classifyEmail };
