\version "2.24.0"
\include "instruments/baroque-lute-13.ily"

\header {
  title = "Greensleeves"
  subtitle = "d_minor configuration · instrument instance 97b4d2fe93a7"
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
        \key d \major
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
      tablatureFormat = \luteTabFormat
      stringTunings = \luteStringTunings
      additionalBassStrings = \stringTuning <a,, bes,, c, d, ees, f, g,>
    } {
      \new TabVoice = "music" {
        \partial 8
        \key d \major
        \time 6/8
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.1") (data-measure-id . "measure.0"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.1") (data-measure-id . "measure.0"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.1") (data-measure-id . "measure.0"))
        b8 \3 |
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.2") (data-measure-id . "measure.1"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.2") (data-measure-id . "measure.1"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.2") (data-measure-id . "measure.1"))
        <d'\2 b\3>4
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.3") (data-measure-id . "measure.1"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.3") (data-measure-id . "measure.1"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.3") (data-measure-id . "measure.1"))
        e'8 \2
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.4") (data-measure-id . "measure.1"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.4") (data-measure-id . "measure.1"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.4") (data-measure-id . "measure.1"))
        <ges'\1 d\5>8.
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.5") (data-measure-id . "measure.1"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.5") (data-measure-id . "measure.1"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.5") (data-measure-id . "measure.1"))
        g'16 \1
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.6") (data-measure-id . "measure.1"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.6") (data-measure-id . "measure.1"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.6") (data-measure-id . "measure.1"))
        ges'8 \1 |
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.7") (data-measure-id . "measure.2"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.7") (data-measure-id . "measure.2"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.7") (data-measure-id . "measure.2"))
        e'4 \2
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.8") (data-measure-id . "measure.2"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.8") (data-measure-id . "measure.2"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.8") (data-measure-id . "measure.2"))
        des'8 \3
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.9") (data-measure-id . "measure.2"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.9") (data-measure-id . "measure.2"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.9") (data-measure-id . "measure.2"))
        a8. \4
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.10") (data-measure-id . "measure.2"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.10") (data-measure-id . "measure.2"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.10") (data-measure-id . "measure.2"))
        <b\3 a\4>16
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.11") (data-measure-id . "measure.2"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.11") (data-measure-id . "measure.2"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.11") (data-measure-id . "measure.2"))
        <des'\3 g\4 bes,,\12>8 |
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.12") (data-measure-id . "measure.3"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.12") (data-measure-id . "measure.3"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.12") (data-measure-id . "measure.3"))
        <d'\3 ges\4>4
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.13") (data-measure-id . "measure.3"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.13") (data-measure-id . "measure.3"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.13") (data-measure-id . "measure.3"))
        b8 \3
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.14") (data-measure-id . "measure.3"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.14") (data-measure-id . "measure.3"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.14") (data-measure-id . "measure.3"))
        b8. \3
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.15") (data-measure-id . "measure.3"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.15") (data-measure-id . "measure.3"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.15") (data-measure-id . "measure.3"))
        bes16 \3
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.16") (data-measure-id . "measure.3"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.16") (data-measure-id . "measure.3"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.16") (data-measure-id . "measure.3"))
        b8 \3 |
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.17") (data-measure-id . "measure.4"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.17") (data-measure-id . "measure.4"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.17") (data-measure-id . "measure.4"))
        <des'\3 ges\4>4.
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.18") (data-measure-id . "measure.4"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.18") (data-measure-id . "measure.4"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.18") (data-measure-id . "measure.4"))
        ges4 \4
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.19") (data-measure-id . "measure.4"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.19") (data-measure-id . "measure.4"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.19") (data-measure-id . "measure.4"))
        b8 \3 |
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.20") (data-measure-id . "measure.5"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.20") (data-measure-id . "measure.5"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.20") (data-measure-id . "measure.5"))
        <d'\2 b\3>4
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.21") (data-measure-id . "measure.5"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.21") (data-measure-id . "measure.5"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.21") (data-measure-id . "measure.5"))
        e'8 \2
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.22") (data-measure-id . "measure.5"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.22") (data-measure-id . "measure.5"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.22") (data-measure-id . "measure.5"))
        <ges'\1 d\5>8.
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.23") (data-measure-id . "measure.5"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.23") (data-measure-id . "measure.5"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.23") (data-measure-id . "measure.5"))
        g'16 \1
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.24") (data-measure-id . "measure.5"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.24") (data-measure-id . "measure.5"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.24") (data-measure-id . "measure.5"))
        ges'8 \1 |
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.25") (data-measure-id . "measure.6"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.25") (data-measure-id . "measure.6"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.25") (data-measure-id . "measure.6"))
        e'4 \2
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.26") (data-measure-id . "measure.6"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.26") (data-measure-id . "measure.6"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.26") (data-measure-id . "measure.6"))
        des'8 \3
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.27") (data-measure-id . "measure.6"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.27") (data-measure-id . "measure.6"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.27") (data-measure-id . "measure.6"))
        a8. \4
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.28") (data-measure-id . "measure.6"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.28") (data-measure-id . "measure.6"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.28") (data-measure-id . "measure.6"))
        <b\3 a\4>16
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.29") (data-measure-id . "measure.6"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.29") (data-measure-id . "measure.6"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.29") (data-measure-id . "measure.6"))
        <des'\3 g\4>8 |
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.30") (data-measure-id . "measure.7"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.30") (data-measure-id . "measure.7"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.30") (data-measure-id . "measure.7"))
        <d'\3 ges\4>8.
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.31") (data-measure-id . "measure.7"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.31") (data-measure-id . "measure.7"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.31") (data-measure-id . "measure.7"))
        des'16 \3
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.32") (data-measure-id . "measure.7"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.32") (data-measure-id . "measure.7"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.32") (data-measure-id . "measure.7"))
        b8 \3
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.33") (data-measure-id . "measure.7"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.33") (data-measure-id . "measure.7"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.33") (data-measure-id . "measure.7"))
        bes8. \3
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.34") (data-measure-id . "measure.7"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.34") (data-measure-id . "measure.7"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.34") (data-measure-id . "measure.7"))
        aes16 \4
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.35") (data-measure-id . "measure.7"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.35") (data-measure-id . "measure.7"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.35") (data-measure-id . "measure.7"))
        bes8 \3 |
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.36") (data-measure-id . "measure.8"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.36") (data-measure-id . "measure.8"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.36") (data-measure-id . "measure.8"))
        b4. \3
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.37") (data-measure-id . "measure.8"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.37") (data-measure-id . "measure.8"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.37") (data-measure-id . "measure.8"))
        b4 \3
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.38") (data-measure-id . "measure.8"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.38") (data-measure-id . "measure.8"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.38") (data-measure-id . "measure.8"))
        r8 |
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.39") (data-measure-id . "measure.9"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.39") (data-measure-id . "measure.9"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.39") (data-measure-id . "measure.9"))
        <a'\1 ges\4>4.
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.40") (data-measure-id . "measure.9"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.40") (data-measure-id . "measure.9"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.40") (data-measure-id . "measure.9"))
        <a'\1 ges\4>8.
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.41") (data-measure-id . "measure.9"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.41") (data-measure-id . "measure.9"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.41") (data-measure-id . "measure.9"))
        <aes'\1 a\3 d'\2>16
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.42") (data-measure-id . "measure.9"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.42") (data-measure-id . "measure.9"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.42") (data-measure-id . "measure.9"))
        <ges'\1 d'\2 a\3>8 |
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.43") (data-measure-id . "measure.10"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.43") (data-measure-id . "measure.10"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.43") (data-measure-id . "measure.10"))
        <e'\2 a\3>4
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.44") (data-measure-id . "measure.10"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.44") (data-measure-id . "measure.10"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.44") (data-measure-id . "measure.10"))
        des'8 \3
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.45") (data-measure-id . "measure.10"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.45") (data-measure-id . "measure.10"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.45") (data-measure-id . "measure.10"))
        a8. \4
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.46") (data-measure-id . "measure.10"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.46") (data-measure-id . "measure.10"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.46") (data-measure-id . "measure.10"))
        <b\3 a\4>16
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.47") (data-measure-id . "measure.10"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.47") (data-measure-id . "measure.10"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.47") (data-measure-id . "measure.10"))
        <des'\3 g\4 bes,,\12>8 |
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.48") (data-measure-id . "measure.11"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.48") (data-measure-id . "measure.11"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.48") (data-measure-id . "measure.11"))
        <d'\3 ges\4>4
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.49") (data-measure-id . "measure.11"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.49") (data-measure-id . "measure.11"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.49") (data-measure-id . "measure.11"))
        b8 \3
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.50") (data-measure-id . "measure.11"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.50") (data-measure-id . "measure.11"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.50") (data-measure-id . "measure.11"))
        b8. \3
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.51") (data-measure-id . "measure.11"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.51") (data-measure-id . "measure.11"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.51") (data-measure-id . "measure.11"))
        bes16 \3
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.52") (data-measure-id . "measure.11"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.52") (data-measure-id . "measure.11"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.52") (data-measure-id . "measure.11"))
        b8 \3 |
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.53") (data-measure-id . "measure.12"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.53") (data-measure-id . "measure.12"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.53") (data-measure-id . "measure.12"))
        <des'\3 ges\4>4
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.54") (data-measure-id . "measure.12"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.54") (data-measure-id . "measure.12"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.54") (data-measure-id . "measure.12"))
        <bes\3 ges\4>8
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.55") (data-measure-id . "measure.12"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.55") (data-measure-id . "measure.12"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.55") (data-measure-id . "measure.12"))
        ges4 \4
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.56") (data-measure-id . "measure.12"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.56") (data-measure-id . "measure.12"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.56") (data-measure-id . "measure.12"))
        r8 |
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.57") (data-measure-id . "measure.13"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.57") (data-measure-id . "measure.13"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.57") (data-measure-id . "measure.13"))
        <a'\1 ges\4>4.
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.58") (data-measure-id . "measure.13"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.58") (data-measure-id . "measure.13"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.58") (data-measure-id . "measure.13"))
        <a'\1 ges\4>8.
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.59") (data-measure-id . "measure.13"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.59") (data-measure-id . "measure.13"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.59") (data-measure-id . "measure.13"))
        <g'\1 a\3 d'\2>16
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.60") (data-measure-id . "measure.13"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.60") (data-measure-id . "measure.13"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.60") (data-measure-id . "measure.13"))
        <ges'\1 d'\2 a\3>8 |
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.61") (data-measure-id . "measure.14"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.61") (data-measure-id . "measure.14"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.61") (data-measure-id . "measure.14"))
        <e'\2 a\3>4
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.62") (data-measure-id . "measure.14"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.62") (data-measure-id . "measure.14"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.62") (data-measure-id . "measure.14"))
        des'8 \3
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.63") (data-measure-id . "measure.14"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.63") (data-measure-id . "measure.14"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.63") (data-measure-id . "measure.14"))
        a8. \4
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.64") (data-measure-id . "measure.14"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.64") (data-measure-id . "measure.14"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.64") (data-measure-id . "measure.14"))
        <b\3 a\4>16
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.65") (data-measure-id . "measure.14"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.65") (data-measure-id . "measure.14"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.65") (data-measure-id . "measure.14"))
        <des'\3 g\4 bes,,\12>8 |
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.66") (data-measure-id . "measure.15"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.66") (data-measure-id . "measure.15"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.66") (data-measure-id . "measure.15"))
        <d'\3 ges\4>8.
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.67") (data-measure-id . "measure.15"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.67") (data-measure-id . "measure.15"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.67") (data-measure-id . "measure.15"))
        des'16 \3
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.68") (data-measure-id . "measure.15"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.68") (data-measure-id . "measure.15"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.68") (data-measure-id . "measure.15"))
        b8 \3
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.69") (data-measure-id . "measure.15"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.69") (data-measure-id . "measure.15"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.69") (data-measure-id . "measure.15"))
        bes8. \3
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.70") (data-measure-id . "measure.15"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.70") (data-measure-id . "measure.15"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.70") (data-measure-id . "measure.15"))
        aes16 \4
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.71") (data-measure-id . "measure.15"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.71") (data-measure-id . "measure.15"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.71") (data-measure-id . "measure.15"))
        bes8 \3 |
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.72") (data-measure-id . "measure.16"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.72") (data-measure-id . "measure.16"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.72") (data-measure-id . "measure.16"))
        b4. \3
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.73") (data-measure-id . "measure.16"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.73") (data-measure-id . "measure.16"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.73") (data-measure-id . "measure.16"))
        b4 \3
        \once \override NoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.74") (data-measure-id . "measure.16"))
        \once \override TabNoteHead.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.74") (data-measure-id . "measure.16"))
        \once \override Rest.output-attributes = #'((class . "vellum-score-event") (data-arrangement-event-id . "arrangement-event.economical-fingering.74") (data-measure-id . "measure.16"))
        r8 |
      }
    }
  >>
  \layout { }
  \midi { \tempo 4 = 70 }
}
