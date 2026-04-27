\version "2.24.0"
% Opening bars after John Dowland, Flow My Tears / Lachrimae (public domain)
\include "baroque-lute-13.ily"
\include "voice.ily"

melody = \relative c'' {
  \key a \minor
  \time 4/4
  a2 g4 f |
  e2 d |
  c4 d e f |
  e1 \bar "|."
}

lyricsText = \lyricmode {
  Flow my tears, fall from your springs.
}

lute = \relative c' {
  \key a \minor
  \time 4/4
  << { e4 d c d | e4 f e d | c4 d e f | e1 }
     \\ { a,2 d | c2 g | a2 d | a1 } >> \bar "|."
}

\score {
  <<
    \new Staff = "voice" \with { instrumentName = "Voice" } <<
      \new Voice = "melody" { \melody }
    >>
    \new Lyrics \lyricsto "melody" { \lyricsText }
    \new TabStaff \with {
      tablatureFormat = \luteTabFormat
      stringTunings = \luteStringTunings
      additionalBassStrings = \luteDiapasons
    } \lute
  >>
  \layout { }
  \midi { \tempo 4 = 60 }
}
