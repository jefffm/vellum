\version "2.24.0"
% SPDX-License-Identifier: CC0-1.0
% Original Vellum evaluation fixture; dedicated to the public domain.
% Two independent voices for classical-guitar duration and fingering evaluation.
\include "classical-guitar-6.ily"

upper = \relative c' {
  \key c \major
  \time 4/4
  \voiceOne
  e4 g c b |
  a2 g |
  f4 a g f |
  e1 \bar "|."
}

lower = \relative c {
  \key c \major
  \time 4/4
  \voiceTwo
  c2 e |
  f2 c |
  d2 b |
  c1 \bar "|."
}

\score {
  <<
    \new Staff <<
      \new Voice = "upper-midi" { \upper }
      \new Voice = "lower-midi" { \lower }
    >>
    \new TabStaff \with {
      tablatureFormat = \classicalGuitarTabFormat
      stringTunings = \classicalGuitarStringTunings
    } <<
      \new TabVoice = "upper" { \upper }
      \new TabVoice = "lower" { \lower }
    >>
  >>
  \layout { }
  \midi { \tempo 4 = 72 }
}
