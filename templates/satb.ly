\version "2.24.0"
% Four-part SATB choral score on two staves.
\include "../instruments/voice.ily"

soprano = \relative c'' {
  \key c \major
  \time 4/4
  g4 a g f
  e2 d
}

alto = \relative c' {
  \key c \major
  \time 4/4
  e4 f e d
  c2 b
}

tenor = \relative c' {
  \key c \major
  \time 4/4
  c4 d c b
  g2 g
}

bass = \relative c {
  \key c \major
  \time 4/4
  c4 f e g
  c,2 g'
}

\score {
  <<
    \new Staff = "women" <<
      \clef treble
      \new Voice = "soprano" { \voiceOne \soprano }
      \new Voice = "alto" { \voiceTwo \alto }
    >>

    \new Staff = "men" <<
      \clef bass
      \new Voice = "tenor" { \voiceOne \tenor }
      \new Voice = "bass" { \voiceTwo \bass }
    >>
  >>
  \layout { }
  \midi { \tempo 4 = 72 }
}
