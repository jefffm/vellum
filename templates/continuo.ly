\version "2.24.0"
% Figured bass continuo stub with bass line and figures.

bass = \relative c {
  \clef bass
  \key c \major
  \time 4/4
  c4 g a f
  e4 f g c,
}

continuoFigures = \figuremode {
  <5>4 <6> <6 5> <_+>
  <6>4 <5> <_+> <5>
}

\score {
  <<
    \new FiguredBass { \continuoFigures }
    \new Staff { \bass }
  >>
  \layout { }
  \midi { \tempo 4 = 72 }
}
