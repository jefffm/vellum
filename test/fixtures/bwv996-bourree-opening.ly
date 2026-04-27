\version "2.24.0"
% Opening phrase inspired by J.S. Bach, BWV 996 Bourree (public domain)
\include "baroque-lute-13.ily"

bourree = \relative c' {
  \key e \minor
  \time 4/4
  \partial 4 e4 |
  g8 fis e4 b'4 e, |
  fis8 e dis4 b'4 dis, |
  e8 fis g4 a8 g fis4 |
  g8 a b4 e,2 |
  b'8 a g4 fis8 e dis4 |
  e8 fis g4 a8 b c4 |
  b8 a g fis e4 dis |
  e2. \bar "|."
}

\score {
  <<
    \new TabStaff \with {
      tablatureFormat = \luteTabFormat
      stringTunings = \luteStringTunings
      additionalBassStrings = \luteDiapasons
    } \bourree
    \new Staff \bourree
  >>
  \layout { }
  \midi { \tempo 4 = 96 }
}
