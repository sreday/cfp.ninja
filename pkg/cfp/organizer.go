package cfp

import (
	"encoding/json"
	"fmt"
)

// Organizer calls: an event's proposals, a proposal's status, and the
// event's cap on accepted proposals.

// MaxProposalsPerRequest mirrors the server's cap (pkg/api MaxProposalsPerPage):
// a reply this long may be cut short.
const MaxProposalsPerRequest = 500

// EventProposals lists every proposal of an event you organize.
func (c *Client) EventProposals(eventID uint) ([]Proposal, error) {
	data, err := c.doRequest("GET", fmt.Sprintf("/api/v0/events/%d/proposals", eventID), nil)
	if err != nil {
		return nil, err
	}
	var ps []Proposal
	if err := json.Unmarshal(data, &ps); err != nil {
		return nil, fmt.Errorf("failed to parse proposals: %w", err)
	}
	return ps, nil
}

// SetProposalStatus changes a proposal's status. The server emails the
// speakers about it.
func (c *Client) SetProposalStatus(id uint, status string) error {
	_, err := c.doRequest("PUT", fmt.Sprintf("/api/v0/proposals/%d/status", id), map[string]string{"status": status})
	return err
}

// SetMaxAccepted caps how many proposals the event can accept (the server
// refuses any acceptance past it).
func (c *Client) SetMaxAccepted(eventID uint, n int) error {
	_, err := c.doRequest("PUT", fmt.Sprintf("/api/v0/events/%d", eventID), map[string]int{"max_accepted": n})
	return err
}
