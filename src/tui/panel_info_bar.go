package main

import (
	"fmt"

	"github.com/gdamore/tcell/v2"
	"github.com/rivo/tview"
)

// InfoBarPanel displays phase and stats in a single line
type InfoBarPanel struct {
	*tview.Box
	
	// Phase info
	currentPhase int
	totalPhases  int
	phaseName    string
	
	// File stats
	filesProcessed int
	filesTotal     int
	queueCurrent   int
	queueTotal     int
	errors         int
	docsComplete   int
	docsTotal      int
}

// NewInfoBarPanel creates a new info bar panel
func NewInfoBarPanel() *InfoBarPanel {
	panel := &InfoBarPanel{
		Box:          tview.NewBox(),
		currentPhase: 3,
		totalPhases:  9,
		phaseName:    "Analysis",
		filesProcessed: 156,
		filesTotal:    487,
		queueCurrent:  1,
		queueTotal:    323,
		errors:       2,
		docsComplete: 3,
		docsTotal:    6,
	}
	
	panel.SetBorder(true).
		SetBorderPadding(0, 0, 1, 1)
	
	return panel
}

// Draw renders the info bar
func (i *InfoBarPanel) Draw(screen tcell.Screen) {
	i.Box.DrawForSubclass(screen, i)
	x, y, width, _ := i.GetInnerRect()
	
	if width < 80 {
		return
	}
	
	// Format: PHASE [3/9] ANALYSIS  Files: 156/487  Queue: 1/323  Errors: 2  Done docs: 3/6
	// Divide width into sections for better spacing
	
	// Calculate section widths
	sectionWidth := width / 5  // 5 sections: phase, files, queue, errors, docs
	
	// Phase section (takes 1.5x space)
	phaseText := fmt.Sprintf("PHASE [%d/%d] %s", i.currentPhase, i.totalPhases, i.phaseName)
	tview.Print(screen, phaseText, x, y, sectionWidth + sectionWidth/2, tview.AlignLeft, tcell.ColorAqua)
	col := sectionWidth + sectionWidth/2
	
	// Files section - centered in its section
	filesStart := col + (sectionWidth - 15) / 2  // Center in section
	filesColor := tcell.ColorYellow
	if i.filesProcessed == i.filesTotal {
		filesColor = tcell.ColorGreen
	}
	tview.Print(screen, "Files: ", filesStart, y, 7, tview.AlignLeft, tcell.ColorWhite)
	tview.Print(screen, fmt.Sprintf("%d/%d", i.filesProcessed, i.filesTotal), 
		filesStart+7, y, 10, tview.AlignLeft, filesColor)
	col += sectionWidth
	
	// Queue section - centered in its section
	queueStart := col + (sectionWidth - 15) / 2
	queueColor := tcell.ColorGreen
	if i.queueCurrent > i.queueTotal/2 {
		queueColor = tcell.ColorYellow
	}
	tview.Print(screen, "Queue: ", queueStart, y, 7, tview.AlignLeft, tcell.ColorWhite)
	tview.Print(screen, fmt.Sprintf("%d/%d", i.queueCurrent, i.queueTotal), 
		queueStart+7, y, 10, tview.AlignLeft, queueColor)
	col += sectionWidth
	
	// Errors section - centered in its section  
	errorsStart := col + (sectionWidth - 10) / 2
	errorColor := tcell.ColorGreen
	if i.errors > 0 {
		errorColor = tcell.ColorRed
	}
	tview.Print(screen, "Errors: ", errorsStart, y, 8, tview.AlignLeft, tcell.ColorWhite)
	tview.Print(screen, fmt.Sprintf("%d", i.errors), errorsStart+8, y, 4, tview.AlignLeft, errorColor)
	col += sectionWidth/2
	
	// Done docs section - use remaining space
	docsStart := col + 2
	docsColor := tcell.ColorBlue
	if i.docsComplete == i.docsTotal {
		docsColor = tcell.ColorGreen
	}
	tview.Print(screen, "Done docs: ", docsStart, y, 11, tview.AlignLeft, tcell.ColorWhite)
	tview.Print(screen, fmt.Sprintf("%d/%d", i.docsComplete, i.docsTotal), 
		docsStart+11, y, 8, tview.AlignLeft, docsColor)
}

// UpdatePhase updates phase information
func (i *InfoBarPanel) UpdatePhase(current, total int, name string) {
	i.currentPhase = current
	i.totalPhases = total
	i.phaseName = name
}

// UpdateFiles updates file statistics
func (i *InfoBarPanel) UpdateFiles(processed, total int) {
	i.filesProcessed = processed
	i.filesTotal = total
}

// UpdateQueue updates queue information
func (i *InfoBarPanel) UpdateQueue(current, total int) {
	i.queueCurrent = current
	i.queueTotal = total
}

// UpdateErrors updates error count
func (i *InfoBarPanel) UpdateErrors(errors int) {
	i.errors = errors
}

// UpdateDocs updates document completion
func (i *InfoBarPanel) UpdateDocs(complete, total int) {
	i.docsComplete = complete
	i.docsTotal = total
}