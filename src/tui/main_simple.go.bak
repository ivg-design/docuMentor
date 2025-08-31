package main

import (
	"flag"
	"fmt"
	"os"
	"time"

	"github.com/gdamore/tcell/v2"
	"github.com/rivo/tview"
)

func main() {
	var testMode bool
	flag.BoolVar(&testMode, "test", false, "Run in test mode")
	flag.Parse()

	app := tview.NewApplication()

	// Create header as simple TextView
	header := tview.NewTextView().
		SetDynamicColors(true).
		SetTextAlign(tview.AlignCenter).
		SetText("[yellow]DocuMentor TUI v3.0 - Ultra Pipeline[white]\nProject: ~/github/docuMentor | PID: " + fmt.Sprintf("%d", os.Getpid()))
	header.SetBorder(true)

	// Create info bar
	infoBar := tview.NewTextView().
		SetDynamicColors(true).
		SetText("PHASE [3/9] Analysis  Files: 156/487  Queue: 1/323  Errors: 2  Done docs: 3/6")
	infoBar.SetBorder(true)

	// Create workers grid
	worker1 := tview.NewTextView().SetText("[W1] IDLE\nReady").SetBorder(true)
	worker2 := tview.NewTextView().SetText("[W2] BUSY\nsrc/index.ts\nprocessing...").SetBorder(true)
	worker3 := tview.NewTextView().SetText("[W3] IDLE\nReady").SetBorder(true)
	worker4 := tview.NewTextView().SetText("[W4] IDLE\nReady").SetBorder(true)

	workersGrid := tview.NewGrid().
		SetRows(0).
		SetColumns(0, 0, 0, 0).
		AddItem(worker1, 0, 0, 1, 1, 0, 0, false).
		AddItem(worker2, 0, 1, 1, 1, 0, 0, false).
		AddItem(worker3, 0, 2, 1, 1, 0, 0, false).
		AddItem(worker4, 0, 3, 1, 1, 0, 0, false)

	// Create controls
	controls := tview.NewTextView().
		SetDynamicColors(true).
		SetTextAlign(tview.AlignCenter).
		SetText("[yellow](H)[white] Help  [yellow](P)[white] Pause  [yellow](R)[white] Resume  [yellow](V)[white] RAW  [yellow](D)[white] Debug  [yellow](Esc)[white] Exit")

	// Create logs
	logs := tview.NewTextView().
		SetDynamicColors(true).
		SetScrollable(true).
		SetText("[gray]08:54:17[white] [green]INFO[white] Starting document processing\n[gray]08:54:18[white] [green]INFO[white] Found 487 files\n")
	logs.SetBorder(true).SetTitle(" Logs ")

	// Create performance bar
	performance := tview.NewTextView().
		SetDynamicColors(true).
		SetText("CPU: [green]████████░░[white] 78%  MEM: [blue]███░░░░░░░[white] 28%  DISK: 45MB/s  NET: 128KB/s")
	performance.SetBorder(true)

	// Create status bar
	status := tview.NewTextView().
		SetDynamicColors(true).
		SetText("STATUS: Processing src/index.ts → index.md")
	status.SetBorder(true)

	// Create main layout
	mainGrid := tview.NewGrid().
		SetRows(3, 1, 4, 1, 0, 1, 1).
		SetColumns(0).
		AddItem(header, 0, 0, 1, 1, 0, 0, false).
		AddItem(infoBar, 1, 0, 1, 1, 0, 0, false).
		AddItem(workersGrid, 2, 0, 1, 1, 0, 0, false).
		AddItem(controls, 3, 0, 1, 1, 0, 0, false).
		AddItem(logs, 4, 0, 1, 1, 0, 0, false).
		AddItem(performance, 5, 0, 1, 1, 0, 0, false).
		AddItem(status, 6, 0, 1, 1, 0, 0, false)

	// Set up keyboard handlers
	app.SetInputCapture(func(event *tcell.EventKey) *tcell.EventKey {
		if event.Key() == tcell.KeyEscape || event.Rune() == 'q' || event.Rune() == 'Q' {
			app.Stop()
			return nil
		}
		return event
	})

	// Add test mode updates
	if testMode {
		go func() {
			ticker := time.NewTicker(2 * time.Second)
			counter := 0
			for range ticker.C {
				counter++
				app.QueueUpdateDraw(func() {
					logs.SetText(logs.GetText(false) + fmt.Sprintf("[gray]%s[white] [green]INFO[white] Processing file %d\n",
						time.Now().Format("15:04:05"), counter))
					logs.ScrollToEnd()
				})
			}
		}()
	}

	// Run the app
	if err := app.SetRoot(mainGrid, true).Run(); err != nil {
		panic(err)
	}
}