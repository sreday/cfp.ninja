package cfp

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"time"
)

// OAuthResult represents the result of an OAuth flow
type OAuthResult struct {
	Token string
	Error error
}

// OAuthServer handles the local OAuth callback
type OAuthServer struct {
	Port       int
	ResultChan chan OAuthResult
	server     *http.Server
	listener   net.Listener
}

// StartOAuthServer starts a local HTTP server to receive the OAuth callback
func StartOAuthServer() (*OAuthServer, error) {
	// Find an available port
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return nil, fmt.Errorf("failed to start listener: %w", err)
	}

	port := listener.Addr().(*net.TCPAddr).Port
	resultChan := make(chan OAuthResult, 1)

	mux := http.NewServeMux()
	server := &http.Server{Handler: mux}

	oauth := &OAuthServer{
		Port:       port,
		ResultChan: resultChan,
		server:     server,
		listener:   listener,
	}

	mux.HandleFunc("/callback", func(w http.ResponseWriter, r *http.Request) {
		token := r.URL.Query().Get("token")
		if token == "" {
			errMsg := r.URL.Query().Get("error")
			if errMsg == "" {
				errMsg = "no token received"
			}
			resultChan <- OAuthResult{Error: fmt.Errorf("%s", errMsg)}
			w.Header().Set("Content-Type", "text/html")
			w.WriteHeader(http.StatusBadRequest)
			fmt.Fprintf(w, `<!DOCTYPE html>
<html>
<head><title>Authentication Failed</title></head>
<body style="font-family: sans-serif; text-align: center; padding: 50px;">
<h1>Authentication Failed</h1>
<p>%s</p>
<p>You can close this tab.</p>
</body>
</html>`, errMsg)
			return
		}

		resultChan <- OAuthResult{Token: token}

		w.Header().Set("Content-Type", "text/html")
		w.WriteHeader(http.StatusOK)
		fmt.Fprint(w, `<!DOCTYPE html>
<html>
<head><title>Authentication Successful</title></head>
<body style="font-family: sans-serif; text-align: center; padding: 50px;">
<h1>Authentication Successful!</h1>
<p>You can close this tab and return to the terminal.</p>
<script>window.close();</script>
</body>
</html>`)
	})

	// Start the server in a goroutine
	go func() {
		server.Serve(listener)
	}()

	return oauth, nil
}

// BuildAuthURL constructs the OAuth initiation URL
func BuildAuthURL(server string, port int, provider string) string {
	return fmt.Sprintf("%s/api/v0/auth/%s?cli=true&redirect_port=%d", server, provider, port)
}

// WaitForToken waits for the OAuth callback or timeout
func (o *OAuthServer) WaitForToken(timeout time.Duration) (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()
	defer o.Shutdown()

	select {
	case result := <-o.ResultChan:
		if result.Error != nil {
			return "", result.Error
		}
		return result.Token, nil
	case <-ctx.Done():
		return "", fmt.Errorf("authentication timed out after %v", timeout)
	}
}

// Shutdown gracefully shuts down the OAuth server
func (o *OAuthServer) Shutdown() {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	o.server.Shutdown(ctx)
}
