\version "2.24.0"
% Simple guitar number tablature with hidden MIDI staff.
\include "../instruments/classical-guitar-6.ily"

music = \relative c' {
  \time 4/4
  e4 fis g a
  b4 c d e
}

\score {
  <<
    \new TabStaff \with {
      tablatureFormat = \classicalGuitarTabFormat
      stringTunings = \classicalGuitarStringTunings
    } \music

    \new Staff \with {
      \remove "Staff_symbol_engraver"
      \remove "Clef_engraver"
      \remove "Time_signature_engraver"
      \override NoteHead.transparent = ##t
      \override Rest.transparent = ##t
      \override Stem.transparent = ##t
      \override Dots.transparent = ##t
      \override Beam.transparent = ##t
    } \music
  >>
  \layout { }
  \midi { \tempo 4 = 72 }
}
