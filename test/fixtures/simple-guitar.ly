\version "2.24.0"
% Simple passage for classical guitar using number tablature
\include "classical-guitar-6.ily"

guitarMusic = \relative c' {
  \key c \major
  \time 4/4
  c8 e g e c e g e |
  d8 f a f d f a f |
  e8 g c g e g c g |
  c,4 e g c \bar "|."
}

\score {
  <<
    \new Staff \guitarMusic
    \new TabStaff \with {
      tablatureFormat = \classicalGuitarTabFormat
      stringTunings = \classicalGuitarStringTunings
    } \guitarMusic
  >>
  \layout { }
  \midi { \tempo 4 = 88 }
}
