package main

import (
	"testing"

	"github.com/sreday/cfp.ninja/pkg/cfp"
)

func TestProposalFromTalkUsesSpeakerDefaults(t *testing.T) {
	talk := &cfp.Talk{
		Title:        "Saved talk",
		Abstract:     "Talk abstract",
		Format:       "talk",
		Duration:     45,
		Level:        "intermediate",
		Tags:         "architecture",
		SpeakerNotes: "Private notes",
	}
	user := &cfp.UserInfo{
		Name:     "Speaker Name",
		Email:    "speaker@example.com",
		Bio:      "Speaker bio",
		JobTitle: "Staff Engineer",
		Company:  "Acme",
		LinkedIn: "https://linkedin.com/in/speaker",
		Timezone: "America/Sao_Paulo",
	}

	proposal := proposalFromTalk(talk, user)
	if proposal.Title != talk.Title || proposal.Abstract != talk.Abstract {
		t.Fatalf("talk content was not copied: %#v", proposal)
	}
	if len(proposal.Speakers) != 1 {
		t.Fatalf("expected one speaker, got %d", len(proposal.Speakers))
	}
	speaker := proposal.Speakers[0]
	if speaker.Name != user.Name || speaker.Email != user.Email || speaker.LinkedIn != user.LinkedIn {
		t.Fatalf("speaker identity was not copied: %#v", speaker)
	}
	if speaker.Bio != user.Bio || speaker.JobTitle != user.JobTitle || speaker.Company != user.Company {
		t.Fatalf("speaker defaults were not copied: %#v", speaker)
	}
	if !speaker.Primary || speaker.Timezone != user.Timezone {
		t.Fatalf("speaker metadata was not copied: %#v", speaker)
	}
}
