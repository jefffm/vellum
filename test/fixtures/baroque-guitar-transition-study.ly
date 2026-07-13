\version "2.24.0"
% SPDX-License-Identifier: CC0-1.0
% Original Vellum evaluation fixture; dedicated to the public domain.
% A compact melody-and-chord study for transition and alfabeto evaluation.
\include "baroque-guitar-5.ily"

upper = \relative c'' {
  \key g \major
  \time 4/4
  \voiceOne
  g4 a b d |
  c4 b a g |
  fis4 g a fis |
  g1 \bar "|."
}

lower = \relative c' {
  \key g \major
  \time 4/4
  \voiceTwo
  <g b d>2 <c e g> |
  <d fis a>2 <g b d> |
  <e g b>2 <d fis a> |
  <g b d>1 \bar "|."
}

\score {
  <<
    \new Staff <<
      \new Voice = "upper-midi" { \upper }
      \new Voice = "lower-midi" { \lower }
    >>
    \new TabStaff \with {
      tablatureFormat = \guitarTabFormat
      stringTunings = \guitarStringTunings
    } <<
      \new TabVoice = "upper" { \upper }
      \new TabVoice = "lower" { \lower }
    >>
  >>
  \layout { }
  \midi { \tempo 4 = 80 }
}
