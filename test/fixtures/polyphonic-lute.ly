\version "2.24.0"
% Two-voice polyphonic passage demonstrating voice layers in French tab
\include "baroque-lute-13.ily"

upper = \relative c' {
  \key d \minor
  \time 4/4
  \voiceOne
  f4 g a bes |
  a4 g f e |
  d4 e f g |
  a2 d,2 \bar "|."
}

lower = \relative c {
  \key d \minor
  \time 4/4
  \voiceTwo
  d2 a |
  bes2 a |
  d2 c |
  f,2 d \bar "|."
}

\score {
  <<
    \new TabStaff \with {
      tablatureFormat = \luteTabFormat
      stringTunings = \luteStringTunings
      additionalBassStrings = \luteDiapasons
    } <<
      \new TabVoice = "upper" { \upper }
      \new TabVoice = "lower" { \lower }
    >>

    \new Staff <<
      \new Voice = "upper-midi" { \upper }
      \new Voice = "lower-midi" { \lower }
    >>
  >>
  \layout { }
  \midi { \tempo 4 = 84 }
}
