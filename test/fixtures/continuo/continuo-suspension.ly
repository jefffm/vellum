\version "2.24.0"

\header {
  title = "Continuo Suspension Exercise"
  subtitle = "Golden fixture for Vellum"
  composer = "Vellum project fixture (CC0)"
  tagline = ##f
}

soprano = \fixed c' {
  \key c \major
  \time 4/4
  f'1 |
  f'2 e'2 |
  d'1 |
  c'1 \bar "|."
}

bass = \fixed c {
  \key c \major
  \time 4/4
  d1 |
  c1 |
  g,1 |
  c1
}

continuoFigures = \figuremode {
  <6>1 |
  <4>2 <3>2 |
  <7>1 |
  <5 3>1
}

\score {
  <<
    \new Staff = "soprano" \with { instrumentName = "Soprano" } {
      \clef treble
      \soprano
    }
    \new Staff = "continuo" \with { instrumentName = "Continuo" } {
      \clef bass
      \bass
    }
    \new FiguredBass { \continuoFigures }
  >>
  \layout { }
}
