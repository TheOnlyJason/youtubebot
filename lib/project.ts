import { randomUUID } from "node:crypto";
import type { Project, ProjectForm } from "@/types";
import { emptyChecklist } from "@/lib/projectStatus";

const defaultForm: ProjectForm = {
  niche: "facts",
  topic: "",
  tone: "friendly",
  duration: 30,
  voiceStyle: "calm",
  visualStyle: "realistic",
  cta: "subscribe",
  targetAudience: "curious beginners",
  language: "English",
};

export function createNewProject(partial?: Partial<ProjectForm>): Project {
  const id = randomUUID();
  const now = new Date().toISOString();
  const form = { ...defaultForm, ...partial };
  return {
    id,
    createdAt: now,
    updatedAt: now,
    status: "Draft",
    form,
    scenes: [],
    voiceover: { mode: "none" },
    music: { rightsConfirmed: false, volumePercent: 12 },
    voiceVolume: 1,
    musicVolume: 0.12,
    renderChecklist: emptyChecklist(),
    rights: { allMediaRightsConfirmed: false },
    render: { status: "idle" },
    exportApproved: false,
  };
}
