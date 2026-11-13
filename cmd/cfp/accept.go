package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/spf13/cobra"
	"github.com/sreday/cfp.ninja/pkg/cfp"
	"golang.org/x/term"
)

var acceptCmd = &cobra.Command{
	Use:   "accept",
	Short: "Accept the speakers in your lineup sheet (organizers)",
	Long: `Accept the proposals that match your lineup sheet, in two steps.

"cfp accept plan" reads the sheet (a CSV with email and name1 columns) and the
event's proposals, matches them, prints what it would do and saves the plan.
It changes nothing.

"cfp accept apply" carries out a saved plan. It only runs at a real terminal
and asks you to type how many talks you're accepting. Before accepting, it
caps the event's accepted talks on cfp.ninja at exactly what the plan needs,
so the server itself refuses anything more.

There is no way to accept proposals that aren't in the sheet. Every accepted
speaker gets cfp.ninja's acceptance email.`,
}

var acceptPlanCmd = &cobra.Command{
	Use:   "plan <event id or name> <sheet.csv>",
	Short: "Match the sheet to the proposals and save the plan (changes nothing)",
	Example: `  cfp accept plan "Chaos Engineering 2026" chaos2026.csv
  cfp accept plan 42 chaos2026.csv --confirm 1234,1240`,
	Args: cobra.ExactArgs(2),
	RunE: runAcceptPlan,
}

var acceptApplyCmd = &cobra.Command{
	Use:   "apply <plan.json>",
	Short: "Accept the proposals in a saved plan (at a terminal, you type the count)",
	Args:  cobra.ExactArgs(1),
	RunE:  runAcceptApply,
}

var (
	acceptConfirm string
	acceptOut     string
)

func init() {
	acceptPlanCmd.Flags().StringVar(&acceptConfirm, "confirm", "", "Comma-separated ids of unsure matches you checked and want accepted")
	acceptPlanCmd.Flags().StringVar(&acceptOut, "out", "", "Where to save the plan (default: next to the sheet, <sheet>.plan.json)")
	acceptCmd.AddCommand(acceptPlanCmd, acceptApplyCmd)
}

// findEvent: one event you organize, by id or (part of) its name.
func findEvent(client *cfp.Client, q string) (*cfp.ManagingEvent, error) {
	mine, err := client.GetMyEvents()
	if err != nil {
		return nil, err
	}
	var hits []cfp.ManagingEvent
	for _, e := range mine.Managing {
		if strconv.FormatUint(uint64(e.ID), 10) == q || strings.EqualFold(e.Name, q) {
			return &e, nil
		}
		if strings.Contains(strings.ToLower(e.Name), strings.ToLower(q)) {
			hits = append(hits, e)
		}
	}
	switch len(hits) {
	case 1:
		return &hits[0], nil
	case 0:
		return nil, fmt.Errorf("no event you organize matches %q", q)
	}
	var names []string
	for _, e := range hits {
		names = append(names, fmt.Sprintf("%d %s", e.ID, e.Name))
	}
	return nil, fmt.Errorf("%q matches several events, use the id:\n  %s", q, strings.Join(names, "\n  "))
}

func runAcceptPlan(cmd *cobra.Command, args []string) error {
	client, err := getClient()
	if err != nil {
		return err
	}
	ev, err := findEvent(client, args[0])
	if err != nil {
		return err
	}
	f, err := os.Open(args[1])
	if err != nil {
		return err
	}
	rows, hash, err := cfp.ReadSheet(f)
	f.Close()
	if err != nil {
		return err
	}
	ps, err := client.EventProposals(ev.ID)
	if err != nil {
		return err
	}
	pl := cfp.MakePlan(rows, ps)
	pl.EventID, pl.EventName, pl.Made, pl.Sheet, pl.SheetHash = ev.ID, ev.Name, time.Now().UTC(), filepath.Base(args[1]), hash
	if acceptConfirm != "" {
		var ids []uint
		for _, s := range strings.Split(acceptConfirm, ",") {
			n, err := strconv.ParseUint(strings.TrimSpace(s), 10, 32)
			if err != nil {
				return fmt.Errorf("--confirm: %q is not a proposal id", s)
			}
			ids = append(ids, uint(n))
		}
		if err := pl.Confirm(ids); err != nil {
			return err
		}
	}
	printPlan(pl)
	if err := pl.Check(); err != nil {
		return err
	}
	out := acceptOut
	if out == "" {
		out = strings.TrimSuffix(args[1], filepath.Ext(args[1])) + ".plan.json"
	}
	data, _ := json.MarshalIndent(pl, "", "  ")
	if err := os.WriteFile(out, data, 0o600); err != nil {
		return err
	}
	fmt.Printf("\nSaved the plan: %s\nNothing changed on cfp.ninja. To accept these %d, run this yourself in a terminal:\n  cfp accept apply %s\n", out, len(pl.Accept), out)
	return nil
}

func printPlan(pl *cfp.Plan) {
	fmt.Printf("%s (event %d): %d talks in the sheet, %d proposals on cfp.ninja\n", pl.EventName, pl.EventID, pl.SheetRows, pl.Total)
	section := func(head string, items []cfp.PlanItem) {
		if len(items) == 0 {
			return
		}
		fmt.Printf("\n%s (%d)\n", head, len(items))
		for _, it := range items {
			fmt.Printf("  %-6d %-28s %-10s %s\n", it.ProposalID, clipStr(it.Speakers, 28), it.Status, clipStr(it.Title, 70))
			if it.Why != "" && it.Why != "email" {
				fmt.Printf("         ^ %s (sheet line %d: %s, %q)\n", it.Why, it.Row.Line, it.Row.Name, clipStr(it.Row.Title, 60))
			}
		}
	}
	section("ACCEPT", pl.Accept)
	section("ALREADY ACCEPTED", pl.Already)
	section("UNSURE, LEFT OUT (check, then --confirm <id>)", pl.Unsure)
	if len(pl.Missing) > 0 {
		fmt.Printf("\nIN THE SHEET, NOT ON CFP.NINJA (%d): nothing to do there\n", len(pl.Missing))
		for _, r := range pl.Missing {
			fmt.Printf("  line %-3d %-28s %s\n", r.Line, clipStr(r.Name, 28), clipStr(r.Title, 70))
		}
	}
	section("ACCEPTED ON CFP.NINJA, NOT IN THE SHEET (flag only, nothing changes)", pl.AcceptedNotSheet)
}

func clipStr(s string, n int) string {
	if r := []rune(s); len(r) > n {
		return string(r[:n-1]) + "…"
	}
	return s
}

func runAcceptApply(cmd *cobra.Command, args []string) error {
	// A person at a keyboard, not a script or an agent: stdin must be an
	// interactive terminal (a pipe or the null device won't do).
	if !term.IsTerminal(int(os.Stdin.Fd())) {
		return fmt.Errorf("refusing: \"cfp accept apply\" only runs in an interactive terminal, typed by a person")
	}
	data, err := os.ReadFile(args[0])
	if err != nil {
		return err
	}
	var saved cfp.Plan
	if err := json.Unmarshal(data, &saved); err != nil {
		return fmt.Errorf("reading the plan: %w", err)
	}
	if err := saved.Check(); err != nil {
		return err
	}
	client, err := getClient()
	if err != nil {
		return err
	}
	// Fresh data: every proposal must still be there, unchanged since the plan.
	ps, err := client.EventProposals(saved.EventID)
	if err != nil {
		return err
	}
	now := map[uint]cfp.Proposal{}
	accepted := 0
	for _, p := range ps {
		now[p.ID] = p
		if p.Status == "accepted" {
			accepted++
		}
	}
	for _, it := range saved.Accept {
		p, ok := now[it.ProposalID]
		if !ok || p.EventID != saved.EventID {
			return fmt.Errorf("refusing: proposal %d is no longer in %s; make a new plan", it.ProposalID, saved.EventName)
		}
		if p.Status != it.Status {
			return fmt.Errorf("refusing: proposal %d is %q now, %q in the plan; make a new plan", it.ProposalID, p.Status, it.Status)
		}
	}
	fresh := saved
	fresh.Total = len(ps)
	if err := fresh.Check(); err != nil {
		return err
	}

	fmt.Printf("%s: accept these %d proposals (sheet %s, plan made %s).\n", saved.EventName, len(saved.Accept), saved.Sheet, saved.Made.Local().Format("2 Jan 15:04"))
	for _, it := range saved.Accept {
		fmt.Printf("  %-6d %-28s %s\n", it.ProposalID, clipStr(it.Speakers, 28), clipStr(it.Title, 70))
	}
	fmt.Printf("\nEach speaker gets cfp.ninja's acceptance email. Type %d to accept them, anything else to stop: ", len(saved.Accept))
	answer, _ := bufio.NewReader(os.Stdin).ReadString('\n')
	if strings.TrimSpace(answer) != strconv.Itoa(len(saved.Accept)) {
		fmt.Println("Stopped. Nothing changed.")
		return nil
	}

	logPath := strings.TrimSuffix(args[0], ".json") + ".log"
	logf, err := os.OpenFile(logPath, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o600)
	if err != nil {
		return err
	}
	defer logf.Close()
	logLine := func(v map[string]interface{}) {
		v["at"] = time.Now().UTC().Format(time.RFC3339)
		b, _ := json.Marshal(v)
		logf.Write(append(b, '\n'))
	}

	// The server's own limit: no more acceptances than this plan needs.
	limit := accepted + len(saved.Accept)
	if err := client.SetMaxAccepted(saved.EventID, limit); err != nil {
		return fmt.Errorf("setting the event's cap on accepted talks to %d: %w (nothing accepted)", limit, err)
	}
	logLine(map[string]interface{}{"event": saved.EventID, "max_accepted": limit})

	done := 0
	for _, it := range saved.Accept {
		if err := client.SetProposalStatus(it.ProposalID, "accepted"); err != nil {
			logLine(map[string]interface{}{"proposal": it.ProposalID, "error": err.Error()})
			fmt.Printf("  %d FAILED: %v\n", it.ProposalID, err)
			continue
		}
		done++
		logLine(map[string]interface{}{"proposal": it.ProposalID, "speakers": it.Speakers, "before": it.Status, "after": "accepted"})
		fmt.Printf("  %d accepted: %s\n", it.ProposalID, it.Speakers)
	}

	// Read back.
	ps, err = client.EventProposals(saved.EventID)
	if err != nil {
		return fmt.Errorf("accepted %d, but reading them back failed: %w", done, err)
	}
	check := map[uint]string{}
	for _, p := range ps {
		check[p.ID] = p.Status
	}
	ok := 0
	for _, it := range saved.Accept {
		if check[it.ProposalID] == "accepted" {
			ok++
		}
	}
	fmt.Printf("\nDone: %d of %d accepted, %d confirmed on cfp.ninja. Log: %s\n", done, len(saved.Accept), ok, logPath)
	if ok != len(saved.Accept) {
		return fmt.Errorf("%d proposals are not accepted on cfp.ninja, see the log", len(saved.Accept)-ok)
	}
	return nil
}
