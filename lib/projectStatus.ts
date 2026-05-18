import { fastModeEnabled } from "@/lib/config";
import { allScenesHaveMedia } from "@/lib/sceneMedia";
import type { Project, ProjectStatus, RenderChecklist } from "@/types";

export function emptyChecklist(): RenderChecklist {
  return {
    scriptOriginal: false,
    voiceOriginalOrLicensed: false,
    visualsOriginalOrLicensed: false,
    musicOriginalOrLicensed: false,
    noThirdPartyClips: false,
    noCopyrightedSong: false,
    notSpammy: false,
    disclosureNoted: false,
  };
}

export function deriveStatus(p: Project): ProjectStatus {
  if (p.exportApproved && p.render.status === "done") return "Approved";
  if (p.render.status === "done") return "Rendered";
  if (p.render.status === "running") return "Rendering";
  const visualsOk = p.scenes.length === 5 && allScenesHaveMedia(p);
  if (visualsOk && p.generatedScript) return "Visuals Ready";
  if (p.voiceover.fileRelativePath && p.generatedScript) return "Voice Ready";
  if (p.generatedScript) return "Script Ready";
  return "Draft";
}

export function displayProjectState(p: Project): string {
  if (p.render.status === "error") return "Render error";
  return deriveStatus(p);
}

export function canRender(p: Project): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const fast = fastModeEnabled();
  if (!fast && !p.rights.allMediaRightsConfirmed) {
    reasons.push('Confirm "I own or have commercial rights to all uploaded media."');
  }
  if (!p.generatedScript) reasons.push("Generate a script first.");
  if (!p.voiceover.fileRelativePath) {
    reasons.push("Provide a voiceover file (upload or server-side TTS).");
  }
  if (!fast) {
    const c = p.renderChecklist;
    const usingMusic = Boolean(p.music.fileRelativePath);
    const musicChecklistOk = !usingMusic || c.musicOriginalOrLicensed;
    const musicRightsOk = !usingMusic || p.music.rightsConfirmed;
    const checklistDone =
      c.scriptOriginal &&
      c.voiceOriginalOrLicensed &&
      c.visualsOriginalOrLicensed &&
      musicChecklistOk &&
      musicRightsOk &&
      c.noThirdPartyClips &&
      c.noCopyrightedSong &&
      c.notSpammy &&
      c.disclosureNoted;
    if (!checklistDone) {
      if (usingMusic && !p.music.rightsConfirmed) {
        reasons.push("Confirm you have a commercial license for uploaded background music.");
      } else if (usingMusic && !c.musicOriginalOrLicensed) {
        reasons.push("Confirm the music checklist item for licensed background audio.");
      } else {
        reasons.push("Complete the human review checklist.");
      }
    }
  }
  if (p.safetyReport?.overall === "block") {
    reasons.push("Fix script items flagged as high risk before rendering.");
  }
  if (p.scenes.length !== 5) {
    reasons.push("Scenes must be configured (5 scenes).");
  } else if (!allScenesHaveMedia(p)) {
    reasons.push(
      "Generate Sora video (or upload image/video) for every scene — animated backgrounds render as solid colors only.",
    );
  }
  return { ok: reasons.length === 0, reasons };
}
