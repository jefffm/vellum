\version "2.24.0"
% Vocal melody with lyrics above lute or guitar tablature.
\include "../instruments/classical-guitar-6.ily"

melody = \relative c' {
  \key c \major
  \time 4/4
  c4 d e f
  g2 g
}

lyricsText = \lyricmode {
  Sing now a sim -- ple song
}

lute = \relative c' {
  c4 e g c
  b4 g e c
}

\score {
  <<
    \new Staff = "voice" <<
      \new Voice = "melody" { \melody }
    >>
    \new Lyrics \lyricsto "melody" { \lyricsText }

    \new TabStaff \with {
      tablatureFormat = \classicalGuitarTabFormat
      stringTunings = \classicalGuitarStringTunings
    } \lute
  >>
  \layout { }
  \midi { \tempo 4 = 72 }
}
