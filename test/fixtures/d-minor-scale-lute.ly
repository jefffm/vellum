\version "2.24.0"
% D minor scale for baroque lute, French tab notation
\include "baroque-lute-13.ily"

scaleMusic = \relative c' {
  \key d \minor
  \time 4/4
  d4 e f g a bes cis d \bar "|."
}

rhythm = { c4 c c c c c c c }

\score {
  <<
    \new RhythmicStaff \with {
      \override StaffSymbol.line-count = 0
      \remove "Time_signature_engraver"
      \remove "Clef_engraver"
      \autoBeamOff
    } \rhythm

    \new TabStaff \with {
      tablatureFormat = \luteTabFormat
      stringTunings = \luteStringTunings
      additionalBassStrings = \luteDiapasons
    } \scaleMusic

    \new Staff \with {
      \remove "Staff_symbol_engraver"
      \remove "Clef_engraver"
      \remove "Time_signature_engraver"
      \override NoteHead.transparent = ##t
      \override Rest.transparent = ##t
      \override Stem.transparent = ##t
      \override Dots.transparent = ##t
      \override Beam.transparent = ##t
    } \scaleMusic
  >>
  \layout { }
  \midi { \tempo 4 = 72 }
}
