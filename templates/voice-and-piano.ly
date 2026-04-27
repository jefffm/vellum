\version "2.24.0"
% Voice line above a piano grand staff.
\include "../instruments/piano.ily"
\include "../instruments/voice.ily"

melody = \relative c' {
  \key c \major
  \time 4/4
  c4 d e f
  g2 g
}

lyricsText = \lyricmode {
  Sing now a sim -- ple song
}

upper = \relative c'' {
  \key c \major
  \time 4/4
  <c e>4 <d f> <e g> <f a>
  <e g>2 <d f>
}

lower = \relative c {
  \key c \major
  \time 4/4
  c4 g a f
  c2 g
}

\score {
  <<
    \new Staff = "voice" <<
      \new Voice = "melody" { \melody }
    >>
    \new Lyrics \lyricsto "melody" { \lyricsText }

    \new PianoStaff <<
      \new Staff = "upper" { \clef treble \upper }
      \new Staff = "lower" { \clef bass \lower }
    >>
  >>
  \layout { }
  \midi { \tempo 4 = 72 }
}
