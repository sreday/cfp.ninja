package cfp

import (
	"crypto/sha256"
	"encoding/csv"
	"encoding/hex"
	"fmt"
	"io"
	"regexp"
	"sort"
	"strings"
	"time"
)

// Accepting speakers from the organizers' lineup sheet.
//
// The sheet is the only way in: a proposal can be accepted only when a row of
// the sheet matches it. "Plan" reads the sheet and the event's proposals and
// changes nothing; "apply" (cmd/cfp/accept.go) carries out a saved plan, and
// only for a person at a terminal. There is no "accept all" anywhere.

// SheetRow is one talk in the lineup sheet.
type SheetRow struct {
	Line   int      `json:"line"`
	Name   string   `json:"name"`
	Name2  string   `json:"name2,omitempty"`
	Emails []string `json:"emails"`
	Title  string   `json:"title"`
}

// PlanItem is one proposal the plan will accept, or one that needs a look.
type PlanItem struct {
	ProposalID uint     `json:"proposal_id"`
	Title      string   `json:"title"`
	Speakers   string   `json:"speakers"`
	Status     string   `json:"status"` // on cfp.ninja when the plan was made
	Row        SheetRow `json:"row"`
	Why        string   `json:"why,omitempty"`
}

// Plan is what "cfp accept plan" saves and "cfp accept apply" carries out.
type Plan struct {
	EventID   uint      `json:"event_id"`
	EventName string    `json:"event_name"`
	Made      time.Time `json:"made"`
	Sheet     string    `json:"sheet"`      // file name
	SheetHash string    `json:"sheet_hash"` // sha256 of its bytes
	SheetRows int       `json:"sheet_rows"`
	Total     int       `json:"total_proposals"`

	Accept           []PlanItem `json:"accept"`             // will be accepted
	Already          []PlanItem `json:"already_accepted"`   // nothing to do
	Unsure           []PlanItem `json:"unsure"`             // left out until confirmed by id
	Missing          []SheetRow `json:"missing"`            // in the sheet, not on cfp.ninja
	AcceptedNotSheet []PlanItem `json:"accepted_not_sheet"` // accepted on cfp.ninja, not in the sheet (flag only)
}

var splitEmails = regexp.MustCompile(`[;,\s]+`)

// ReadSheet reads a CSV with a header row. It needs an email column and a
// name column ("name1" or "name"); "name2" and "title" are used when there.
// Rows with neither a name nor an email are skipped.
func ReadSheet(r io.Reader) ([]SheetRow, string, error) {
	raw, err := io.ReadAll(r)
	if err != nil {
		return nil, "", err
	}
	sum := sha256.Sum256(raw)
	cr := csv.NewReader(strings.NewReader(strings.TrimPrefix(string(raw), "\ufeff")))
	cr.FieldsPerRecord = -1
	recs, err := cr.ReadAll()
	if err != nil {
		return nil, "", fmt.Errorf("reading the sheet: %w", err)
	}
	if len(recs) < 2 {
		return nil, "", fmt.Errorf("the sheet has no rows")
	}
	col := map[string]int{}
	for i, h := range recs[0] {
		h = strings.ToLower(strings.TrimSpace(h))
		if _, ok := col[h]; !ok && h != "" {
			col[h] = i
		}
	}
	get := func(rec []string, names ...string) string {
		for _, n := range names {
			if i, ok := col[n]; ok && i < len(rec) {
				return strings.TrimSpace(rec[i])
			}
		}
		return ""
	}
	if _, ok := col["email"]; !ok {
		return nil, "", fmt.Errorf("the sheet needs an \"email\" column")
	}
	if _, ok := col["name1"]; !ok {
		if _, ok := col["name"]; !ok {
			return nil, "", fmt.Errorf("the sheet needs a \"name1\" or \"name\" column")
		}
	}
	var rows []SheetRow
	for i, rec := range recs[1:] {
		row := SheetRow{Line: i + 2, Name: get(rec, "name1", "name"), Name2: get(rec, "name2"), Title: get(rec, "title")}
		for _, e := range splitEmails.Split(strings.ToLower(get(rec, "email")), -1) {
			if strings.Contains(e, "@") {
				row.Emails = append(row.Emails, e)
			}
		}
		if row.Name == "" && len(row.Emails) == 0 {
			continue
		}
		rows = append(rows, row)
	}
	return rows, hex.EncodeToString(sum[:]), nil
}

var nonWord = regexp.MustCompile(`[^\p{L}\p{N}]+`)

func words(s string) map[string]bool {
	out := map[string]bool{}
	for _, w := range nonWord.Split(strings.ToLower(s), -1) {
		if len(w) > 2 {
			out[w] = true
		}
	}
	return out
}

// TitleSimilarity: shared words over all words (0..1).
func TitleSimilarity(a, b string) float64 {
	wa, wb := words(a), words(b)
	if len(wa) == 0 || len(wb) == 0 {
		return 0
	}
	both := 0
	for w := range wa {
		if wb[w] {
			both++
		}
	}
	return float64(both) / float64(len(wa)+len(wb)-both)
}

func normName(s string) string {
	return strings.Join(nonWord.Split(strings.ToLower(strings.TrimSpace(s)), -1), " ")
}

func speakerLine(p Proposal) string {
	var names []string
	for _, s := range p.Speakers {
		names = append(names, s.Name)
	}
	return strings.Join(names, " & ")
}

func item(p Proposal, row SheetRow, why string) PlanItem {
	return PlanItem{ProposalID: p.ID, Title: p.Title, Speakers: speakerLine(p), Status: p.Status, Row: row, Why: why}
}

// MakePlan matches the sheet to the proposals. Only sure matches go in
// Accept: the speaker's email, and the title when one email has several
// proposals. A name-only match, a previously rejected proposal or two rows
// on one proposal go to Unsure.
func MakePlan(rows []SheetRow, ps []Proposal) *Plan {
	pl := &Plan{SheetRows: len(rows), Total: len(ps)}
	byEmail := map[string][]int{}
	byName := map[string][]int{}
	for i, p := range ps {
		for _, s := range p.Speakers {
			if e := strings.ToLower(strings.TrimSpace(s.Email)); e != "" {
				byEmail[e] = append(byEmail[e], i)
			}
			if n := normName(s.Name); n != "" {
				byName[n] = append(byName[n], i)
			}
		}
	}
	used := map[uint]bool{} // proposals a row already took
	for _, row := range rows {
		seen := map[int]bool{}
		var cands []int
		for _, e := range row.Emails {
			for _, i := range byEmail[e] {
				if !seen[i] {
					seen[i] = true
					cands = append(cands, i)
				}
			}
		}
		how := "email"
		if len(cands) == 0 {
			how = "name only"
			for _, n := range []string{row.Name, row.Name2} {
				for _, i := range byName[normName(n)] {
					if n != "" && !seen[i] {
						seen[i] = true
						cands = append(cands, i)
					}
				}
			}
		}
		if len(cands) == 0 {
			pl.Missing = append(pl.Missing, row)
			continue
		}
		pick, sure := cands[0], how == "email"
		if len(cands) > 1 {
			// Several proposals from this speaker: the title decides, clearly or not at all.
			sort.SliceStable(cands, func(a, b int) bool {
				return TitleSimilarity(row.Title, ps[cands[a]].Title) > TitleSimilarity(row.Title, ps[cands[b]].Title)
			})
			pick = cands[0]
			best, next := TitleSimilarity(row.Title, ps[cands[0]].Title), TitleSimilarity(row.Title, ps[cands[1]].Title)
			dupes := 0 // the same talk submitted again: accept one, the newest
			for _, i := range cands[1:] {
				if normName(ps[i].Title) == normName(ps[cands[0]].Title) && ps[i].Status != "accepted" {
					dupes++
					if ps[i].ID > ps[pick].ID {
						pick = i
					}
				}
			}
			if dupes > 0 && best >= 0.5 && (len(cands) == dupes+1 || best-TitleSimilarity(row.Title, ps[cands[dupes+1]].Title) >= 0.2) {
				how += fmt.Sprintf(" + title (submitted %d times, the newest picked)", dupes+1)
			} else if best < 0.5 || best-next < 0.2 {
				pick = cands[0]
				sure = false
				var alts []string
				for _, i := range cands {
					alts = append(alts, fmt.Sprintf("%d %q (%s)", ps[i].ID, ps[i].Title, ps[i].Status))
				}
				how = fmt.Sprintf("%d proposals from this speaker, the title doesn't settle it: %s", len(cands), strings.Join(alts, "; "))
			} else {
				how += " + title"
			}
		}
		p := ps[pick]
		switch {
		case used[p.ID]:
			pl.Unsure = append(pl.Unsure, item(p, row, "another sheet row matched this proposal too"))
		case p.Status == "accepted":
			used[p.ID] = true
			pl.Already = append(pl.Already, item(p, row, how))
		case !sure:
			pl.Unsure = append(pl.Unsure, item(p, row, how))
		case p.Status == "rejected":
			pl.Unsure = append(pl.Unsure, item(p, row, "rejected on cfp.ninja before"))
		default:
			used[p.ID] = true
			pl.Accept = append(pl.Accept, item(p, row, how))
		}
	}
	inSheet := map[uint]bool{}
	for _, it := range append(append([]PlanItem{}, pl.Accept...), append(pl.Already, pl.Unsure...)...) {
		inSheet[it.ProposalID] = true
	}
	for _, p := range ps {
		if p.Status == "accepted" && !inSheet[p.ID] {
			pl.AcceptedNotSheet = append(pl.AcceptedNotSheet, item(p, SheetRow{}, ""))
		}
	}
	return pl
}

// Confirm moves unsure proposals, by id, into Accept (Marek looked at each).
func (pl *Plan) Confirm(ids []uint) error {
	for _, id := range ids {
		found := false
		for i, it := range pl.Unsure {
			if it.ProposalID == id {
				for _, a := range pl.Accept {
					if a.ProposalID == id {
						return fmt.Errorf("proposal %d is in the plan already", id)
					}
				}
				it.Why += " (confirmed)"
				pl.Accept = append(pl.Accept, it)
				pl.Unsure = append(pl.Unsure[:i], pl.Unsure[i+1:]...)
				found = true
				break
			}
		}
		if !found {
			return fmt.Errorf("proposal %d is not among the unsure matches: only those can be confirmed", id)
		}
	}
	return nil
}

// Check is the hard limits; apply runs it again against fresh data.
func (pl *Plan) Check() error {
	if len(pl.Accept) == 0 {
		return fmt.Errorf("nothing to accept")
	}
	if len(pl.Accept)+len(pl.Already) > pl.SheetRows {
		return fmt.Errorf("refusing: %d to accept + %d accepted already is more than the sheet's %d rows", len(pl.Accept), len(pl.Already), pl.SheetRows)
	}
	if pl.Total >= MaxProposalsPerRequest {
		return fmt.Errorf("refusing: cfp.ninja returned %d proposals, its per-request cap, so the list may be cut short", pl.Total)
	}
	seen := map[uint]bool{}
	for _, it := range pl.Accept {
		if seen[it.ProposalID] {
			return fmt.Errorf("proposal %d is in the plan twice", it.ProposalID)
		}
		seen[it.ProposalID] = true
	}
	return nil
}
