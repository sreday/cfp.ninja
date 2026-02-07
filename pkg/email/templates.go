package email

import (
	"bytes"
	"embed"
	"fmt"
	htmltemplate "html/template"
	texttemplate "text/template"
)

//go:embed templates/*.html templates/*.txt
var templateFS embed.FS

var (
	htmlTemplates *htmltemplate.Template
	textTemplates *texttemplate.Template
)

func init() {
	htmlTemplates = htmltemplate.Must(htmltemplate.ParseFS(templateFS, "templates/*.html"))
	textTemplates = texttemplate.Must(texttemplate.ParseFS(templateFS, "templates/*.txt"))
}

// Render executes the named template pair and returns HTML and plain text bodies.
func Render(name string, data interface{}) (html string, text string, err error) {
	var htmlBuf, textBuf bytes.Buffer

	if err := htmlTemplates.ExecuteTemplate(&htmlBuf, name+".html", data); err != nil {
		return "", "", fmt.Errorf("render html %s: %w", name, err)
	}
	if err := textTemplates.ExecuteTemplate(&textBuf, name+".txt", data); err != nil {
		return "", "", fmt.Errorf("render text %s: %w", name, err)
	}

	return htmlBuf.String(), textBuf.String(), nil
}
