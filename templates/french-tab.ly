\version "2.24.0"
\include "../instruments/baroque-lute-13.ily"

% ============================================
% French Letter Tablature Template
% Uses fret-letter-tablature-format via luteTabFormat.
% 13-Course Baroque Lute, d-minor accord
% ============================================

% Placeholder variables — the agent replaces these with actual music
rhythm = { s1 }
music = { a4 d' f a, }

\score {
  <<
    % Staff 1: Rhythm flags above tablature
    \new RhythmicStaff \with {
      \override StaffSymbol.line-count = 0
      \remove "Time_signature_engraver"
      \remove "Clef_engraver"
      \autoBeamOff
    } \rhythm

    % Staff 2: French letter tablature
    \new TabStaff \with {
      tablatureFormat = \luteTabFormat
      stringTunings = \luteStringTunings
      additionalBassStrings = \luteDiapasons
    } \music

    % Staff 3: Hidden pitch staff for MIDI output
    \new Staff \with {
      \remove "Staff_symbol_engraver"
      \remove "Clef_engraver"
      \remove "Time_signature_engraver"
      \override NoteHead.transparent = ##t
      \override Rest.transparent = ##t
      \override Stem.transparent = ##t
      \override Dots.transparent = ##t
      \override Beam.transparent = ##t
    } \music
  >>
  \layout { }
  \midi { \tempo 4 = 72 }
}
