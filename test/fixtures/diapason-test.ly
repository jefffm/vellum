\version "2.24.0"
% Baroque lute passage using open diapason bass strings below the French tab staff
\include "baroque-lute-13.ily"

melody = \relative c' {
  \key d \minor
  \time 4/4
  f4 g a f |
  e4 f g e |
  d4 e f d |
  a'2 f \bar "|."
}

bass = {
  d,2 g, |
  f,2 ees, |
  d,2 c, |
  g,2 d, \bar "|."
}

\score {
  <<
    \new TabStaff \with {
      tablatureFormat = \luteTabFormat
      stringTunings = \luteStringTunings
      additionalBassStrings = \luteDiapasons
    } <<
      \new TabVoice = "melody" { \voiceOne \melody }
      \new TabVoice = "diapasons" { \voiceTwo \bass }
    >>

    \new Staff <<
      \new Voice = "melody-midi" { \voiceOne \melody }
      \new Voice = "bass-midi" { \voiceTwo \bass }
    >>
  >>
  \layout { }
  \midi { \tempo 4 = 72 }
}
