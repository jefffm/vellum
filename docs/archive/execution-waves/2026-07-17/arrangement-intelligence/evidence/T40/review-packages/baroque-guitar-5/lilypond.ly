\version "2.24.0"
\include "instruments/baroque-guitar-5.ily"

\header {
  title = "Greensleeves"
  subtitle = "french stringing · instrument instance 42f991ceaf4f"
}

\score {
  \new Score <<
    \new RhythmicStaff \with {
      \override StaffSymbol.line-count = 0
      \remove "Time_signature_engraver"
      \remove "Clef_engraver"
    } {
      \autoBeamOff
      \new Voice = "rhythm" \with {
        \remove "Note_performer"
      } {
        \partial 8
        \key f \major
        \time 6/8
        c'8 |
        c'4
        c'8
        c'8.
        c'16
        c'8 |
        c'4
        c'8
        c'8.
        c'16
        c'8 |
        c'4
        c'8
        c'8.
        c'16
        c'8 |
        c'4.
        c'4
        c'8 |
        c'4
        c'8
        c'8.
        c'16
        c'8 |
        c'4
        c'8
        c'8.
        c'16
        c'8 |
        c'8.
        c'16
        c'8
        c'8.
        c'16
        c'8 |
        c'4.
        c'4
        s8 |
        c'4.
        c'8.
        c'16
        c'8 |
        c'4
        c'8
        c'8.
        c'16
        c'8 |
        c'4
        c'8
        c'8.
        c'16
        c'8 |
        c'4
        c'8
        c'4
        s8 |
        c'4.
        c'8.
        c'16
        c'8 |
        c'4
        c'8
        c'8.
        c'16
        c'8 |
        c'8.
        c'16
        c'8
        c'8.
        c'16
        c'8 |
        c'4.
        c'4
        s8 |
      }
    }
    \new TabStaff \with {
      tablatureFormat = \guitarTabFormat
      stringTunings = \guitarStringTunings
    } {
      \new TabVoice = "music" {
        \partial 8
        \key f \major
        \time 6/8
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.1") (data-measure-id . "measure.0"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.1") (data-measure-id . "measure.0"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.1") (data-measure-id . "measure.0"))
        <d'\4 a\5>8 |
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.2") (data-measure-id . "measure.1"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.2") (data-measure-id . "measure.1"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.2") (data-measure-id . "measure.1"))
        <f'\1 d'\4 a\5>4
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.3") (data-measure-id . "measure.1"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.3") (data-measure-id . "measure.1"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.3") (data-measure-id . "measure.1"))
        <g'\1 c'\2 e'\4>8
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.4") (data-measure-id . "measure.1"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.4") (data-measure-id . "measure.1"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.4") (data-measure-id . "measure.1"))
        <a'\1 c'\5 f'\4>8.
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.5") (data-measure-id . "measure.1"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.5") (data-measure-id . "measure.1"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.5") (data-measure-id . "measure.1"))
        <bes'\1 f'\4>16
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.6") (data-measure-id . "measure.1"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.6") (data-measure-id . "measure.1"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.6") (data-measure-id . "measure.1"))
        <a'\1 f'\4>8 |
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.7") (data-measure-id . "measure.2"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.7") (data-measure-id . "measure.2"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.7") (data-measure-id . "measure.2"))
        <g'\1 e'\4 c'\2>4
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.8") (data-measure-id . "measure.2"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.8") (data-measure-id . "measure.2"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.8") (data-measure-id . "measure.2"))
        <e'\4 c'\2 g\3>8
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.9") (data-measure-id . "measure.2"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.9") (data-measure-id . "measure.2"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.9") (data-measure-id . "measure.2"))
        c'8. \2
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.10") (data-measure-id . "measure.2"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.10") (data-measure-id . "measure.2"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.10") (data-measure-id . "measure.2"))
        <d'\4 c'\2>16
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.11") (data-measure-id . "measure.2"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.11") (data-measure-id . "measure.2"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.11") (data-measure-id . "measure.2"))
        <e'\1 bes\5 g\3 des'\2>8 |
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.12") (data-measure-id . "measure.3"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.12") (data-measure-id . "measure.3"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.12") (data-measure-id . "measure.3"))
        <f'\1 a\5 d'\2>4
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.13") (data-measure-id . "measure.3"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.13") (data-measure-id . "measure.3"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.13") (data-measure-id . "measure.3"))
        <d'\2 a\5>8
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.14") (data-measure-id . "measure.3"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.14") (data-measure-id . "measure.3"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.14") (data-measure-id . "measure.3"))
        <d'\2 g\3 bes\5>8.
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.15") (data-measure-id . "measure.3"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.15") (data-measure-id . "measure.3"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.15") (data-measure-id . "measure.3"))
        <des'\2 g\3 bes\5>16
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.16") (data-measure-id . "measure.3"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.16") (data-measure-id . "measure.3"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.16") (data-measure-id . "measure.3"))
        <d'\2 bes\5>8 |
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.17") (data-measure-id . "measure.4"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.17") (data-measure-id . "measure.4"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.17") (data-measure-id . "measure.4"))
        <e'\1 des'\2 a\5>4.
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.18") (data-measure-id . "measure.4"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.18") (data-measure-id . "measure.4"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.18") (data-measure-id . "measure.4"))
        a4 \5
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.19") (data-measure-id . "measure.4"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.19") (data-measure-id . "measure.4"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.19") (data-measure-id . "measure.4"))
        <d'\4 a\5>8 |
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.20") (data-measure-id . "measure.5"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.20") (data-measure-id . "measure.5"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.20") (data-measure-id . "measure.5"))
        <f'\1 d'\4 a\5>4
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.21") (data-measure-id . "measure.5"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.21") (data-measure-id . "measure.5"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.21") (data-measure-id . "measure.5"))
        <g'\1 c'\2 e'\4>8
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.22") (data-measure-id . "measure.5"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.22") (data-measure-id . "measure.5"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.22") (data-measure-id . "measure.5"))
        <a'\1 c'\5 f'\4>8.
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.23") (data-measure-id . "measure.5"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.23") (data-measure-id . "measure.5"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.23") (data-measure-id . "measure.5"))
        <bes'\1 f'\4>16
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.24") (data-measure-id . "measure.5"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.24") (data-measure-id . "measure.5"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.24") (data-measure-id . "measure.5"))
        <a'\1 f'\4>8 |
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.25") (data-measure-id . "measure.6"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.25") (data-measure-id . "measure.6"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.25") (data-measure-id . "measure.6"))
        <g'\1 e'\4 c'\2>4
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.26") (data-measure-id . "measure.6"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.26") (data-measure-id . "measure.6"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.26") (data-measure-id . "measure.6"))
        <e'\4 c'\2 g\3>8
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.27") (data-measure-id . "measure.6"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.27") (data-measure-id . "measure.6"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.27") (data-measure-id . "measure.6"))
        c'8. \2
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.28") (data-measure-id . "measure.6"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.28") (data-measure-id . "measure.6"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.28") (data-measure-id . "measure.6"))
        <d'\4 c'\2>16
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.29") (data-measure-id . "measure.6"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.29") (data-measure-id . "measure.6"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.29") (data-measure-id . "measure.6"))
        <e'\1 bes\5 g\3>8 |
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.30") (data-measure-id . "measure.7"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.30") (data-measure-id . "measure.7"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.30") (data-measure-id . "measure.7"))
        <f'\1 a\5 d'\4>8.
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.31") (data-measure-id . "measure.7"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.31") (data-measure-id . "measure.7"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.31") (data-measure-id . "measure.7"))
        <e'\1 d'\4>16
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.32") (data-measure-id . "measure.7"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.32") (data-measure-id . "measure.7"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.32") (data-measure-id . "measure.7"))
        <d'\4 bes\5 g\3>8
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.33") (data-measure-id . "measure.7"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.33") (data-measure-id . "measure.7"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.33") (data-measure-id . "measure.7"))
        <des'\2 a\3>8.
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.34") (data-measure-id . "measure.7"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.34") (data-measure-id . "measure.7"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.34") (data-measure-id . "measure.7"))
        <b\2 a\3>16
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.35") (data-measure-id . "measure.7"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.35") (data-measure-id . "measure.7"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.35") (data-measure-id . "measure.7"))
        <des'\2 a\5>8 |
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.36") (data-measure-id . "measure.8"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.36") (data-measure-id . "measure.8"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.36") (data-measure-id . "measure.8"))
        <d'\2 a\5>4.
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.37") (data-measure-id . "measure.8"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.37") (data-measure-id . "measure.8"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.37") (data-measure-id . "measure.8"))
        <d'\2 a\5>4
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.38") (data-measure-id . "measure.8"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.38") (data-measure-id . "measure.8"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.38") (data-measure-id . "measure.8"))
        r8 |
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.39") (data-measure-id . "measure.9"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.39") (data-measure-id . "measure.9"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.39") (data-measure-id . "measure.9"))
        <c''\1 e'\2 a\5>4.
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.40") (data-measure-id . "measure.9"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.40") (data-measure-id . "measure.9"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.40") (data-measure-id . "measure.9"))
        <c''\1 a\5 f'\2>8.
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.41") (data-measure-id . "measure.9"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.41") (data-measure-id . "measure.9"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.41") (data-measure-id . "measure.9"))
        <b'\1 g\3 f'\2>16
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.42") (data-measure-id . "measure.9"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.42") (data-measure-id . "measure.9"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.42") (data-measure-id . "measure.9"))
        <a'\1 f'\2 c'\5>8 |
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.43") (data-measure-id . "measure.10"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.43") (data-measure-id . "measure.10"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.43") (data-measure-id . "measure.10"))
        <g'\1 e'\2 c'\5>4
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.44") (data-measure-id . "measure.10"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.44") (data-measure-id . "measure.10"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.44") (data-measure-id . "measure.10"))
        <e'\1 c'\5 g\3>8
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.45") (data-measure-id . "measure.10"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.45") (data-measure-id . "measure.10"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.45") (data-measure-id . "measure.10"))
        c'8. \2
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.46") (data-measure-id . "measure.10"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.46") (data-measure-id . "measure.10"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.46") (data-measure-id . "measure.10"))
        <d'\4 c'\2>16
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.47") (data-measure-id . "measure.10"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.47") (data-measure-id . "measure.10"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.47") (data-measure-id . "measure.10"))
        <e'\1 bes\5 g\3 des'\2>8 |
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.48") (data-measure-id . "measure.11"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.48") (data-measure-id . "measure.11"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.48") (data-measure-id . "measure.11"))
        <f'\1 a\5 d'\2>4
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.49") (data-measure-id . "measure.11"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.49") (data-measure-id . "measure.11"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.49") (data-measure-id . "measure.11"))
        <d'\2 a\5>8
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.50") (data-measure-id . "measure.11"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.50") (data-measure-id . "measure.11"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.50") (data-measure-id . "measure.11"))
        <d'\2 g\3 bes\5>8.
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.51") (data-measure-id . "measure.11"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.51") (data-measure-id . "measure.11"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.51") (data-measure-id . "measure.11"))
        <des'\2 g\3 bes\5>16
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.52") (data-measure-id . "measure.11"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.52") (data-measure-id . "measure.11"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.52") (data-measure-id . "measure.11"))
        <d'\2 bes\5>8 |
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.53") (data-measure-id . "measure.12"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.53") (data-measure-id . "measure.12"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.53") (data-measure-id . "measure.12"))
        <e'\1 des'\2 a\5>4
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.54") (data-measure-id . "measure.12"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.54") (data-measure-id . "measure.12"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.54") (data-measure-id . "measure.12"))
        <des'\2 a\5>8
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.55") (data-measure-id . "measure.12"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.55") (data-measure-id . "measure.12"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.55") (data-measure-id . "measure.12"))
        a4 \3
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.56") (data-measure-id . "measure.12"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.56") (data-measure-id . "measure.12"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.56") (data-measure-id . "measure.12"))
        r8 |
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.57") (data-measure-id . "measure.13"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.57") (data-measure-id . "measure.13"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.57") (data-measure-id . "measure.13"))
        <c''\1 e'\2 a\5>4.
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.58") (data-measure-id . "measure.13"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.58") (data-measure-id . "measure.13"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.58") (data-measure-id . "measure.13"))
        <c''\1 a\5 f'\2>8.
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.59") (data-measure-id . "measure.13"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.59") (data-measure-id . "measure.13"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.59") (data-measure-id . "measure.13"))
        <bes'\1 g\3 c'\5 f'\4>16
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.60") (data-measure-id . "measure.13"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.60") (data-measure-id . "measure.13"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.60") (data-measure-id . "measure.13"))
        <a'\1 f'\4 c'\5>8 |
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.61") (data-measure-id . "measure.14"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.61") (data-measure-id . "measure.14"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.61") (data-measure-id . "measure.14"))
        <g'\1 e'\4 c'\2>4
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.62") (data-measure-id . "measure.14"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.62") (data-measure-id . "measure.14"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.62") (data-measure-id . "measure.14"))
        <e'\4 c'\2 g\3>8
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.63") (data-measure-id . "measure.14"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.63") (data-measure-id . "measure.14"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.63") (data-measure-id . "measure.14"))
        c'8. \2
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.64") (data-measure-id . "measure.14"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.64") (data-measure-id . "measure.14"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.64") (data-measure-id . "measure.14"))
        <d'\4 c'\2>16
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.65") (data-measure-id . "measure.14"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.65") (data-measure-id . "measure.14"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.65") (data-measure-id . "measure.14"))
        <e'\1 bes\5 g\3 des'\2>8 |
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.66") (data-measure-id . "measure.15"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.66") (data-measure-id . "measure.15"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.66") (data-measure-id . "measure.15"))
        <f'\1 a\5 d'\2>8.
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.67") (data-measure-id . "measure.15"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.67") (data-measure-id . "measure.15"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.67") (data-measure-id . "measure.15"))
        <e'\1 d'\2>16
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.68") (data-measure-id . "measure.15"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.68") (data-measure-id . "measure.15"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.68") (data-measure-id . "measure.15"))
        <d'\2 bes\5 g\3>8
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.69") (data-measure-id . "measure.15"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.69") (data-measure-id . "measure.15"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.69") (data-measure-id . "measure.15"))
        <des'\2 a\3>8.
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.70") (data-measure-id . "measure.15"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.70") (data-measure-id . "measure.15"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.70") (data-measure-id . "measure.15"))
        <b\2 a\3>16
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.71") (data-measure-id . "measure.15"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.71") (data-measure-id . "measure.15"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.71") (data-measure-id . "measure.15"))
        <des'\2 a\3>8 |
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.72") (data-measure-id . "measure.16"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.72") (data-measure-id . "measure.16"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.72") (data-measure-id . "measure.16"))
        <d'\2 a\3>4.
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.73") (data-measure-id . "measure.16"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.73") (data-measure-id . "measure.16"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.73") (data-measure-id . "measure.16"))
        <d'\2 a\3>4
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.74") (data-measure-id . "measure.16"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.74") (data-measure-id . "measure.16"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.source-coverage.74") (data-measure-id . "measure.16"))
        r8 |
      }
    }
  >>
  \layout { }
  \midi { \tempo 4 = 70 }
}
