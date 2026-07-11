\version "2.24.0"

\header {
  title = "Three-Voice Imitative Passage"
  subtitle = "Golden fixture for Vellum"
  composer = "Vellum project fixture (CC0)"
  tagline = ##f
}

VoiceOne = {
  \key c \major
  \time 4/4
  c'4 d' e' g' |
  a'2 g' |
  g'2 f' |
  e'1 \bar "|."
}

VoiceTwo = {
  \key c \major
  \time 4/4
  r1 |
  g4 a b d' |
  e'2 d' |
  c'1 \bar "|."
}

VoiceThree = {
  \key c \major
  \time 4/4
  r1 |
  r1 |
  c4 d e g |
  g2 c2 \bar "|."
}

\score {
  \new StaffGroup <<
    \new Staff \with { instrumentName = "Voice I" } { \clef treble \VoiceOne }
    \new Staff \with { instrumentName = "Voice II" } { \clef treble \VoiceTwo }
    \new Staff \with { instrumentName = "Voice III" } { \clef bass \VoiceThree }
  >>
  \layout { }
}
