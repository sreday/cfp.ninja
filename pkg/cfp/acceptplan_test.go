package cfp

import (
	"strings"
	"testing"
)

func prop(id uint, status, title string, sp ...Speaker) Proposal {
	return Proposal{ID: id, EventID: 7, Status: status, Title: title, Speakers: sp}
}

func TestAcceptPlan(t *testing.T) {
	sheet := "Featured,Track,Name1,email,Name2,Title\n" +
		"No,a,Jane Doe,jane@x.com,,Chaos for agents\n" +
		"No,a,Bo Lee,bo@x.com ; ann@y.com,Ann Ray,Two of us\n" +
		"No,a,Kim Park,kim@x.com,,Kubernetes DNS chaos experiments\n" +
		"No,a,Al Smith,al@other.com,,Something\n" +
		"No,a,Nobody,none@x.com,,Fast track\n" +
		"No,a,Rex Old,rex@x.com,,Was rejected\n" +
		"No,a,Cy Done,cy@x.com,,Done already\n" +
		"No,a,Pat Two,pat@x.com,,Backups are not recovery\n" +
		",,,,,\n"
	rows, hash, err := ReadSheet(strings.NewReader("\ufeff" + sheet))
	if err != nil || len(rows) != 8 || hash == "" || len(rows[1].Emails) != 2 {
		t.Fatalf("sheet: %v %+v", err, rows)
	}
	var ps []Proposal
	ps = append(ps,
		prop(1, "submitted", "Chaos for AI agents", Speaker{Name: "Jane Doe", Email: "JANE@x.com"}),
		prop(2, "tentative", "Two of us", Speaker{Name: "Ann Ray", Email: "ann@y.com"}),
		prop(3, "submitted", "Kubernetes DNS chaos experiments in prod", Speaker{Name: "Kim Park", Email: "kim@x.com"}),
		prop(4, "submitted", "Platform teams and toil", Speaker{Name: "Kim Park", Email: "kim@x.com"}),
		prop(5, "submitted", "Something", Speaker{Name: "Al Smith", Email: "al@x.com"}),
		prop(6, "rejected", "Was rejected", Speaker{Name: "Rex Old", Email: "rex@x.com"}),
		prop(7, "accepted", "Done already", Speaker{Name: "Cy Done", Email: "cy@x.com"}),
		prop(8, "accepted", "Not in sheet", Speaker{Name: "Zed", Email: "zed@x.com"}),
	)
	ps = append(ps,
		prop(9, "submitted", "Backups are not recovery", Speaker{Name: "Pat Two", Email: "pat@x.com"}),
		prop(10, "submitted", "Backups are not recovery", Speaker{Name: "Pat Two", Email: "pat@x.com"}))
	for i := uint(100); i < 120; i++ { // the rest of the CFP
		ps = append(ps, prop(i, "submitted", "Other talk", Speaker{Name: "Someone", Email: "s@z.com"}))
	}
	pl := MakePlan(rows, ps)
	ids := func(items []PlanItem) (out []uint) {
		for _, it := range items {
			out = append(out, it.ProposalID)
		}
		return
	}
	if got := ids(pl.Accept); len(got) != 4 || got[0] != 1 || got[1] != 2 || got[2] != 3 || got[3] != 10 {
		t.Fatalf("accept: %v", got)
	}
	if got := ids(pl.Unsure); len(got) != 2 || got[0] != 5 || got[1] != 6 { // name only; rejected before
		t.Fatalf("unsure: %v %+v", got, pl.Unsure)
	}
	if len(pl.Missing) != 1 || pl.Missing[0].Name != "Nobody" || len(pl.Already) != 1 || len(pl.AcceptedNotSheet) != 1 {
		t.Fatalf("missing/already/extra: %+v %+v %+v", pl.Missing, pl.Already, pl.AcceptedNotSheet)
	}
	if err := pl.Check(); err != nil {
		t.Fatal(err)
	}
	if err := pl.Confirm([]uint{100}); err == nil {
		t.Fatal("confirmed a proposal that isn't an unsure match")
	}
	if err := pl.Confirm([]uint{5}); err != nil || len(pl.Accept) != 5 || len(pl.Unsure) != 1 {
		t.Fatalf("confirm: %v", err)
	}

	// The limits.
	big := *pl
	big.SheetRows = 3
	if big.Check() == nil {
		t.Fatal("more than the sheet's rows")
	}
	half := *pl
	half.Total = 10
	if half.Check() == nil {
		t.Fatal("more than half the proposals")
	}
	capped := *pl
	capped.Total = MaxProposalsPerRequest
	if capped.Check() == nil {
		t.Fatal("a list that may be cut short")
	}
	// Every sheet row naming everyone still can't add proposals that aren't in it.
	all := MakePlan([]SheetRow{{Name: "Someone", Emails: []string{"s@z.com"}}}, ps)
	if len(all.Accept) != 0 || len(all.Unsure) != 1 {
		t.Fatalf("one row took %d proposals", len(all.Accept))
	}
}
