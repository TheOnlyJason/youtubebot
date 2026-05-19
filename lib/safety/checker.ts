import type { GeneratedScript, SafetyFinding, SafetyLevel, SafetyReport } from "@/types";

/** Phrases that often imply risky / third-party reuse */
const RISKY_PHRASES: { re: RegExp; code: string; message: string; level: SafetyLevel }[] = [
  {
    re: /\buse clips from\b/i,
    code: "reuse_instruction",
    message: 'Phrases like "use clips from" often imply unlicensed third-party footage.',
    level: "block",
  },
  {
    re: /\b(movie|anime|tv|television|sports|football|highlights|tiktok|instagram|compilation|music video|celebrity song)\b/i,
    code: "third_party_reference",
    message:
      "Content references third-party or high-risk media types. Ensure you are not implying reused protected footage.",
    level: "review",
  },
  {
    re: /\b(copyrighted song|chart hit|official music)\b/i,
    code: "music_risk",
    message: "Avoid copyrighted commercial music unless you have a license.",
    level: "block",
  },
];

/** Famous lyric snippets — heuristic only */
const LYRIC_SNIPPETS = [
  /\bnever gonna give you up\b/i,
  /\bbohemian rhapsody\b/i,
  /\bimagine all the people\b/i,
  /\bshape of you\b/i,
  /\bblinding lights\b/i,
];

const SENSITIVE_VERTICALS: {
  re: RegExp;
  code: string;
  message: string;
  level: SafetyLevel;
}[] = [
  {
    re: /\b(cure|treat|diagnose|guaranteed|miracle supplement|lose \d+ lbs in \d+ days)\b/i,
    code: "health_claim",
    message: "Health claims may be sensitive for monetization. Prefer cautious, evidence-aligned language.",
    level: "review",
  },
  {
    re: /\b(guaranteed returns|get rich quick|no risk investment|double your money)\b/i,
    code: "finance_claim",
    message: "Finance / investment claims can be high risk for policy and accuracy.",
    level: "review",
  },
  {
    re: /\b(legal advice|lawsuit strategy|tax evasion)\b/i,
    code: "legal_sensitive",
    message: "Legal or tax evasion framing is sensitive. Avoid presenting opinions as professional advice.",
    level: "review",
  },
  {
    re: /\b(definitely (won|will) win the election|rigged election)\b/i,
    code: "political_sensitive",
    message: "Political absolutes or election claims can be policy-sensitive.",
    level: "review",
  },
];

function maxLevel(a: SafetyLevel, b: SafetyLevel): SafetyLevel {
  const order: SafetyLevel[] = ["low", "review", "block"];
  return order[Math.max(order.indexOf(a), order.indexOf(b))];
}

export function scanTopicForRiskyKeywords(topic: string): string[] {
  const topicLower = topic.toLowerCase();
  const triggers = [
    "movie clip",
    "anime clip",
    "football highlights",
    "tiktok compilation",
    "celebrity song",
    "music video",
    "instagram reel",
    "youtube compilation",
    "nba highlights",
    "tv show clip",
  ];
  return triggers.filter((t) => topicLower.includes(t));
}

export function runSafetyCheck(
  script: GeneratedScript,
  topic: string,
): SafetyReport {
  const findings: SafetyFinding[] = [];
  const beatText =
    script.skitBeats?.flatMap((b) => [b.action, b.dialogue, b.visual]) ?? [];
  const lyricText =
    script.lyricsSections?.flatMap((s) => [...s.lines, s.visual]) ?? [];
  const blob = [
    script.title,
    script.description,
    script.skitConcept,
    script.castDescription,
    script.settingAndProps,
    script.fullVoiceoverScript,
    script.hook,
    ...script.mainPoints,
    script.ending,
    script.ctaLine,
    ...beatText,
    script.fullLyrics,
    ...lyricText,
    ...script.captionLines.map((c) => c.text),
  ].join("\n");

  for (const rule of RISKY_PHRASES) {
    if (rule.re.test(blob)) {
      findings.push({ code: rule.code, message: rule.message, level: rule.level });
    }
  }

  for (const line of LYRIC_SNIPPETS) {
    if (line.test(blob)) {
      findings.push({
        code: "possible_lyrics",
        message: "Text resembles well-known song lyrics. Reword to be safe.",
        level: "block",
      });
    }
  }

  for (const rule of SENSITIVE_VERTICALS) {
    if (rule.re.test(blob)) {
      findings.push({ code: rule.code, message: rule.message, level: rule.level });
    }
  }

  const keywordWarnings = scanTopicForRiskyKeywords(topic);

  let overall: SafetyLevel = "low";
  for (const f of findings) {
    overall = maxLevel(overall, f.level);
  }
  if (keywordWarnings.length) {
    overall = maxLevel(overall, "review");
  }

  return { overall, findings, keywordWarnings };
}
