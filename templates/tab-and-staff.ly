\version "2.24.0"
% Standard notation staff paired with guitar number tablature.
\include "../instruments/classical-guitar-6.ily"

music = \relative c' {
  \key c \major
  \time 4/4
  e4 g b e
  d4 c b a
}

\score {
  <<
    \new Staff {
      \clef "treble_8"
      \music
    }

    \new TabStaff \with {
      tablatureFormat = \classicalGuitarTabFormat
      stringTunings = \classicalGuitarStringTunings
    } \music
  >>
  \layout { }
  \midi { \tempo 4 = 72 }
}
