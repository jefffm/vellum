\version "2.24.0"
% Piano grand staff with treble and bass staves.
\include "../instruments/piano.ily"

upper = \relative c'' {
  \key c \major
  \time 4/4
  c4 e g c
  b4 a g f
}

lower = \relative c {
  \key c \major
  \time 4/4
  c4 g a f
  e4 f g c,
}

\score {
  \new PianoStaff <<
    \new Staff = "upper" { \clef treble \upper }
    \new Staff = "lower" { \clef bass \lower }
  >>
  \layout { }
  \midi { \tempo 4 = 72 }
}
