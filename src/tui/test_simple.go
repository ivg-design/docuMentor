package main

import (
	"github.com/rivo/tview"
)

func main() {
	app := tview.NewApplication()
	box := tview.NewBox().SetBorder(true).SetTitle("Test TUI")
	if err := app.SetRoot(box, true).Run(); err != nil {
		panic(err)
	}
}